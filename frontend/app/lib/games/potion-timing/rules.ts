import type { RoundRule } from "./types";

export function isValidRoundRule(value: unknown): value is RoundRule {
  if (typeof value !== "object" || value === null) return false;
  const rule = value as Record<string, unknown>;
  return (
    typeof rule.center === "number" &&
    typeof rule.halfWidth === "number" &&
    typeof rule.periodMs === "number" &&
    Number.isFinite(rule.center) &&
    Number.isFinite(rule.halfWidth) &&
    Number.isFinite(rule.periodMs) &&
    rule.halfWidth > 0 &&
    rule.periodMs > 0 &&
    rule.center - rule.halfWidth >= 0 &&
    rule.center + rule.halfWidth <= 100
  );
}

export function positionAt(elapsedMs: number, periodMs: number): number {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(periodMs) || periodMs <= 0) {
    throw new RangeError("invalid_clock");
  }

  const phase = (Math.max(0, elapsedMs) % periodMs) / periodMs;
  return 100 * (1 - Math.abs(2 * phase - 1));
}

export function scoreAt(position: number, rule: RoundRule): number {
  if (
    !Number.isFinite(position) ||
    position < 0 ||
    position > 100 ||
    !isValidRoundRule(rule)
  ) {
    throw new RangeError("invalid_rule");
  }

  const distance = Math.abs(position - rule.center);
  if (distance >= rule.halfWidth) return 0;
  return Math.min(100, Math.max(0, Math.round(100 * (1 - distance / rule.halfWidth))));
}

export function makeRounds(seedText: string, slow = false): readonly RoundRule[] {
  let seed = 2166136261;
  for (const character of seedText) {
    seed = Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0;
  }

  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const centers = [25, 40, 55, 70] as const;
  const widths = [10, 12, 14] as const;
  const periods = [4000, 4800, 5600] as const;
  const rounds = Array.from({ length: 5 }, () => ({
    center: centers[next() % centers.length],
    halfWidth: widths[next() % widths.length],
    periodMs: periods[next() % periods.length] * (slow ? 1.8 : 1),
  }));

  if (rounds.length !== 5 || rounds.some((rule) => !isValidRoundRule(rule))) {
    throw new RangeError("invalid_rule");
  }
  return rounds;
}
