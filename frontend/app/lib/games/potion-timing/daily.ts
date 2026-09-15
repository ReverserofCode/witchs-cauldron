import { makeRounds } from "./rules";
import type { Challenge, RoundRule } from "./types";

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type DailyChallenge = Challenge &
  Readonly<{
    startsAtMs: number;
    endsAtMs: number;
  }>;

export type DailyResponse = Readonly<{
  serverNowMs: number;
  challenge: DailyChallenge;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return false;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}

function validRule(value: unknown): value is RoundRule {
  if (!isObject(value)) return false;
  const { center, halfWidth, periodMs } = value;
  return (
    typeof center === "number" &&
    typeof halfWidth === "number" &&
    typeof periodMs === "number" &&
    Number.isFinite(center) &&
    Number.isFinite(halfWidth) &&
    Number.isFinite(periodMs) &&
    halfWidth > 0 &&
    periodMs > 0 &&
    center - halfWidth >= 0 &&
    center + halfWidth <= 100
  );
}

export function getDailyChallenge(nowMs: number): DailyChallenge {
  if (!Number.isFinite(nowMs)) throw new RangeError("invalid_clock");

  const startsAtMs = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const date = new Date(startsAtMs).toISOString().slice(0, 10);
  const challengeId = `potion-v1:${date}:daily`;
  return {
    challengeId,
    date,
    rulesVersion: "potion-v1",
    startsAtMs,
    endsAtMs: startsAtMs + DAY_MS,
    rounds: makeRounds(challengeId),
  };
}

export function parseDailyResponse(value: unknown): DailyResponse | null {
  if (!isObject(value) || typeof value.serverNowMs !== "number" || !Number.isFinite(value.serverNowMs)) {
    return null;
  }
  const challenge = value.challenge;
  if (!isObject(challenge)) return null;

  const { challengeId, date, rulesVersion, startsAtMs, endsAtMs, rounds } = challenge;
  if (
    !validDate(date) ||
    challengeId !== `potion-v1:${date}:daily` ||
    rulesVersion !== "potion-v1" ||
    typeof startsAtMs !== "number" ||
    !Number.isFinite(startsAtMs) ||
    startsAtMs !== Date.parse(`${date}T00:00:00Z`) ||
    typeof endsAtMs !== "number" ||
    !Number.isFinite(endsAtMs) ||
    endsAtMs - startsAtMs !== DAY_MS ||
    !Array.isArray(rounds) ||
    rounds.length !== 5 ||
    !rounds.every(validRule)
  ) {
    return null;
  }

  return {
    serverNowMs: value.serverNowMs,
    challenge: {
      challengeId,
      date,
      rulesVersion,
      startsAtMs,
      endsAtMs,
      rounds,
    },
  };
}
