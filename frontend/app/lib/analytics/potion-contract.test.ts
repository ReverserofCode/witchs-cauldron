import { describe, expect, it } from "vitest";

import { validatePotionPayload } from "./potion-contract";

const SITE_ACTIVE = {
  schema_version: 1,
  visitor_id: "2197e2ee-e965-471b-bf69-af674815133a",
  event_id: "c998b107-d983-4422-8015-83ba78b3dc54",
  type: "site_active",
} as const;

const GAME_START = {
  ...SITE_ACTIVE,
  type: "game_start",
  run_id: "87f4e0d5-58a0-4ef4-ad81-172e3311bc48",
  mode: "daily",
  rule_version: "potion-v1",
} as const;

describe("validatePotionPayload", () => {
  it("accepts the exact site_active contract and rejects event-specific extra fields", () => {
    expect(validatePotionPayload(SITE_ACTIVE)).toEqual({ ok: true, value: SITE_ACTIVE });
    expect(validatePotionPayload({ ...SITE_ACTIVE, score: 500 }).ok).toBe(false);
    expect(validatePotionPayload({ ...SITE_ACTIVE, run_id: SITE_ACTIVE.event_id }).ok).toBe(false);
  });

  it("accepts each supported game mode for start and complete events", () => {
    for (const type of ["game_start", "game_complete"] as const) {
      for (const mode of ["daily", "practice", "slow-practice"] as const) {
        const payload = { ...GAME_START, type, mode };
        expect(validatePotionPayload(payload)).toEqual({ ok: true, value: payload });
      }
    }
  });

  it("rejects non-objects, arrays, unknown keys, and wrong event field combinations", () => {
    for (const input of [null, [], "payload", 1]) {
      expect(validatePotionPayload(input).ok).toBe(false);
    }

    expect(validatePotionPayload({ ...GAME_START, unexpected: true }).ok).toBe(false);
    expect(validatePotionPayload({ ...GAME_START, mode: undefined }).ok).toBe(false);
    expect(validatePotionPayload({ ...GAME_START, type: "site_active" }).ok).toBe(false);
    expect(validatePotionPayload({ ...SITE_ACTIVE, type: "game_start" }).ok).toBe(false);
  });

  it("requires schema version 1 and canonical UUID identifiers", () => {
    expect(validatePotionPayload({ ...SITE_ACTIVE, schema_version: 2 }).ok).toBe(false);
    expect(validatePotionPayload({ ...SITE_ACTIVE, visitor_id: "unknown" }).ok).toBe(false);
    expect(validatePotionPayload({ ...SITE_ACTIVE, event_id: "00000000-0000-0000-0000-000000000000" }).ok).toBe(false);
    expect(validatePotionPayload({ ...GAME_START, run_id: "87f4e0d558a04ef4ad81172e3311bc48" }).ok).toBe(false);
    expect(validatePotionPayload({ ...SITE_ACTIVE, visitor_id: SITE_ACTIVE.visitor_id.toUpperCase() }).ok).toBe(false);
  });

  it("rejects unsupported event, mode, and rule version values", () => {
    expect(validatePotionPayload({ ...SITE_ACTIVE, type: "pageview" }).ok).toBe(false);
    expect(validatePotionPayload({ ...GAME_START, mode: "ranked" }).ok).toBe(false);
    expect(validatePotionPayload({ ...GAME_START, rule_version: "potion-v2" }).ok).toBe(false);
  });
});
