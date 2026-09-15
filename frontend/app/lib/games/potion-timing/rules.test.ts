import { describe, expect, it } from "vitest";

import { isValidRoundRule, makeRounds, positionAt, scoreAt } from "./rules";

describe("potion timing rules", () => {
  it("scores known positions independently of render frequency", () => {
    const rule = { center: 50, halfWidth: 10, periodMs: 4000 };

    expect([0, 1000, 2000, 4000].map((time) => positionAt(time, 4000))).toEqual([
      0, 50, 100, 0,
    ]);
    expect([50, 45, 40, 80].map((position) => scoreAt(position, rule))).toEqual([
      100, 50, 0, 0,
    ]);
  });

  it("matches the hand-derived potion-v1 daily round fixture", () => {
    expect(makeRounds("potion-v1:2026-09-15:daily")).toEqual([
      { center: 40, halfWidth: 10, periodMs: 5600 },
      { center: 55, halfWidth: 10, periodMs: 5600 },
      { center: 70, halfWidth: 10, periodMs: 4000 },
      { center: 25, halfWidth: 14, periodMs: 4000 },
      { center: 40, halfWidth: 14, periodMs: 4000 },
    ]);
  });

  it("generates five bounded rounds and only slows their periods", () => {
    const normal = makeRounds("run-seed");
    const slow = makeRounds("run-seed", true);

    expect(normal).toHaveLength(5);
    for (const [index, rule] of normal.entries()) {
      expect(Number.isFinite(rule.center)).toBe(true);
      expect(Number.isFinite(rule.halfWidth)).toBe(true);
      expect(Number.isFinite(rule.periodMs)).toBe(true);
      expect(rule.center - rule.halfWidth).toBeGreaterThanOrEqual(0);
      expect(rule.center + rule.halfWidth).toBeLessThanOrEqual(100);
      expect(rule.periodMs).toBeGreaterThan(0);
      expect(slow[index]).toEqual({ ...rule, periodMs: rule.periodMs * 1.8 });
    }
  });

  it("rejects invalid clocks and round rules", () => {
    expect(() => positionAt(Number.NaN, 4000)).toThrowError("invalid_clock");
    expect(() => positionAt(0, 0)).toThrowError("invalid_clock");
    expect(positionAt(-50, 4000)).toBe(0);

    const valid = { center: 50, halfWidth: 10, periodMs: 4000 };
    expect(() => scoreAt(-1, valid)).toThrowError("invalid_rule");
    expect(() => scoreAt(101, valid)).toThrowError("invalid_rule");
    expect(() => scoreAt(50, { ...valid, center: Number.NaN })).toThrowError(
      "invalid_rule",
    );
    expect(() => scoreAt(50, { ...valid, center: 5, halfWidth: 10 })).toThrowError(
      "invalid_rule",
    );
    expect(() => scoreAt(50, { ...valid, center: 95, halfWidth: 10 })).toThrowError(
      "invalid_rule",
    );
    expect(() => scoreAt(50, { ...valid, periodMs: 0 })).toThrowError("invalid_rule");
  });

  it("exposes one round validity contract for every domain boundary", () => {
    expect(isValidRoundRule({ center: 50, halfWidth: 10, periodMs: 4000 })).toBe(true);
    expect(isValidRoundRule(null)).toBe(false);
    expect(isValidRoundRule({ center: 50, halfWidth: 10 })).toBe(false);
    expect(isValidRoundRule({ center: 5, halfWidth: 10, periodMs: 4000 })).toBe(false);
    expect(isValidRoundRule({ center: 95, halfWidth: 10, periodMs: 4000 })).toBe(false);
    expect(isValidRoundRule({ center: 50, halfWidth: 10, periodMs: Number.NaN })).toBe(false);
  });
});
