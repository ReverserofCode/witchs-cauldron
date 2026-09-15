import { describe, expect, it } from "vitest";

import { getDailyChallenge, parseDailyResponse } from "./daily";

describe("daily potion challenges", () => {
  it("rolls at KST 09:00, not KST midnight", () => {
    const before = getDailyChallenge(Date.parse("2026-09-15T08:59:59.999+09:00"));
    const after = getDailyChallenge(Date.parse("2026-09-15T09:00:00+09:00"));

    expect(before.date).toBe("2026-09-14");
    expect(after.date).toBe("2026-09-15");
    expect(after.startsAtMs).toBe(Date.parse("2026-09-15T00:00:00Z"));
    expect(after.endsAtMs - after.startsAtMs).toBe(86_400_000);
  });

  it("rejects a non-finite server clock", () => {
    expect(() => getDailyChallenge(Number.NaN)).toThrowError("invalid_clock");
  });

  it("parses a complete valid response", () => {
    const serverNowMs = Date.parse("2026-09-15T12:34:56Z");
    const challenge = getDailyChallenge(serverNowMs);

    expect(parseDailyResponse({ serverNowMs, challenge })).toEqual({ serverNowMs, challenge });
  });

  it("rejects inconsistent identity, timing, version, and round bounds", () => {
    const serverNowMs = Date.parse("2026-09-15T12:34:56Z");
    const challenge = getDailyChallenge(serverNowMs);
    const invalidChallenges = [
      { ...challenge, rulesVersion: "potion-v2" },
      { ...challenge, date: "2026-9-15" },
      { ...challenge, date: "2026-02-30", challengeId: "potion-v1:2026-02-30:daily" },
      { ...challenge, challengeId: "wrong" },
      { ...challenge, startsAtMs: Number.NaN },
      { ...challenge, endsAtMs: challenge.startsAtMs + 1 },
      { ...challenge, rounds: challenge.rounds.slice(0, 4) },
      {
        ...challenge,
        rounds: [
          { center: 5, halfWidth: 10, periodMs: 4000 },
          ...challenge.rounds.slice(1),
        ],
      },
    ];

    expect(parseDailyResponse({ serverNowMs: Number.NaN, challenge })).toBeNull();
    for (const invalid of invalidChallenges) {
      expect(parseDailyResponse({ serverNowMs, challenge: invalid })).toBeNull();
    }
    expect(parseDailyResponse(null)).toBeNull();
  });
});
