import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import type { PilotWindow } from "./potion-config";
import type { PotionPilotEvent } from "./potion-contract";
import { ensurePotionSchema, ingestPotionEvent } from "./potion-db";

const testDatabaseUrl = process.env.POTION_TEST_DATABASE_URL?.trim() ?? "";

function isSafeTestDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && loopback && url.pathname === "/potion_test";
  } catch {
    return false;
  }
}

if (testDatabaseUrl && !isSafeTestDatabaseUrl(testDatabaseUrl)) {
  throw new Error("POTION_TEST_DATABASE_URL must target loopback database potion_test");
}

const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const NOW = Date.parse("2026-09-15T00:00:00.000Z");
const DAY_MS = 86_400_000;
const WINDOW: PilotWindow = {
  enrollFromMs: NOW - DAY_MS,
  enrollUntilMs: NOW + DAY_MS,
  observeUntilMs: NOW + 35 * DAY_MS,
};

const IDS = {
  visitor: "2197e2ee-e965-471b-bf69-af674815133a",
  visitor2: "d0e72b80-9a03-4628-b69c-8a1dbc94da35",
  run: "87f4e0d5-58a0-4ef4-ad81-172e3311bc48",
  run2: "73b79a7d-ab5d-4be7-b24d-e825172bcd63",
  event1: "c998b107-d983-4422-8015-83ba78b3dc54",
  event2: "a98226cf-cc55-46a1-9d51-7086536d9dca",
  event3: "bc0f8ec0-3be8-471c-aad7-2662175f442f",
  event4: "315069e2-2e3f-4f31-821d-34e2c1761db8",
} as const;

function gameEvent(overrides: Partial<PotionPilotEvent> = {}): PotionPilotEvent {
  return {
    schema_version: 1,
    visitor_id: IDS.visitor,
    event_id: IDS.event1,
    type: "game_start",
    run_id: IDS.run,
    mode: "daily",
    rule_version: "potion-v1",
    ...overrides,
  } as PotionPilotEvent;
}

describe("potion schema initialization", () => {
  it("retries schema creation after a failed query instead of caching the rejection", async () => {
    const query = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ rows: [] });
    const fakePool = { query } as unknown as Pool;

    await expect(ensurePotionSchema(fakePool)).rejects.toThrow("temporary failure");
    await expect(ensurePotionSchema(fakePool)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("does no database work when the pilot window is null or the server clock is outside observation", async () => {
    const unusablePool = { connect: vi.fn(() => { throw new Error("must not connect"); }) } as unknown as Pool;
    await expect(ingestPotionEvent(unusablePool, gameEvent(), NOW, null)).resolves.toEqual({ status: 204 });
    await expect(ingestPotionEvent(unusablePool, gameEvent(), WINDOW.enrollFromMs - 1, WINDOW)).resolves.toEqual({ status: 204 });
    await expect(ingestPotionEvent(unusablePool, gameEvent(), WINDOW.observeUntilMs, WINDOW)).resolves.toEqual({ status: 204 });
    await expect(ingestPotionEvent(unusablePool, gameEvent(), WINDOW.observeUntilMs + 1, WINDOW)).resolves.toEqual({ status: 204 });
    expect(unusablePool.connect).not.toHaveBeenCalled();
  });
});

describe("getPotionPool", () => {
  it("fails closed without an explicit database target", async () => {
    vi.resetModules();
    vi.stubEnv("ANALYTICS_DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL", "");
    const { getPotionPool } = await import("./potion-db");

    await expect(getPotionPool()).rejects.toThrow("potion_database_not_configured");
    vi.unstubAllEnvs();
  });

  it.runIf(Boolean(testDatabaseUrl))("uses a three-connection pool and recovers after a rejected creation promise", async () => {
    vi.resetModules();
    vi.stubEnv("ANALYTICS_DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:1/potion_test");
    vi.stubEnv("DATABASE_URL", "postgres://should-not:be-used@127.0.0.1:2/potion_test");
    const db = await import("./potion-db");

    await expect(db.getPotionPool()).rejects.toBeInstanceOf(Error);
    vi.stubEnv("ANALYTICS_DATABASE_URL", testDatabaseUrl);
    const recovered = await db.getPotionPool();
    expect(recovered.options.max).toBe(3);
    await recovered.end();
    vi.unstubAllEnvs();
  });
});

describeDatabase("potion event ingestion against PostgreSQL", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 3 });
    await ensurePotionSchema(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE potion_pilot_events, potion_pilot_visitors CASCADE");
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it("creates only the isolated tables, indexes, and database field-combination checks", async () => {
    const tables = await pool.query<{ visitor: string | null; events: string | null; general: string | null }>(
      "SELECT to_regclass('potion_pilot_visitors')::text AS visitor, to_regclass('potion_pilot_events')::text AS events, to_regclass('analytics_events')::text AS general"
    );
    expect(tables.rows[0]).toEqual({
      visitor: "potion_pilot_visitors",
      events: "potion_pilot_events",
      general: null,
    });

    const indexes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE tablename IN ('potion_pilot_visitors', 'potion_pilot_events')"
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      "potion_visitors_expiry_idx",
      "potion_events_visitor_day_idx",
      "potion_events_run_type_uq",
      "potion_events_active_day_uq",
    ]));

    await expect(pool.query(
      `INSERT INTO potion_pilot_events
       (event_id, visitor_id, event_type, run_id, mode, rule_version, occurred_at, day_kst)
       VALUES ($1, $2, 'site_active', $3, 'daily', 'potion-v1', now(), CURRENT_DATE)`,
      [IDS.event1, IDS.visitor, IDS.run]
    )).rejects.toBeInstanceOf(Error);
  });

  it("enrolls only a first game_start during enrollment without moving its first timestamp or expiry", async () => {
    const first = await ingestPotionEvent(pool, gameEvent(), NOW, WINDOW);
    expect(first).toEqual({
      status: 200,
      body: { ok: true, serverNowMs: NOW, expiresAtMs: NOW + 45 * DAY_MS, dayKst: "2026-09-15" },
    });

    const retransmission = await ingestPotionEvent(pool, gameEvent(), NOW + 1_000, WINDOW);
    expect(retransmission.status).toBe(200);
    const participant = await pool.query<{ first_started_at: Date; expires_at: Date }>(
      "SELECT first_started_at, expires_at FROM potion_pilot_visitors WHERE visitor_id = $1",
      [IDS.visitor]
    );
    expect(participant.rows[0]?.first_started_at.getTime()).toBe(NOW);
    expect(participant.rows[0]?.expires_at.getTime()).toBe(NOW + 45 * DAY_MS);
  });

  it("does not enroll from complete, site activity, or a start after enrollment", async () => {
    expect((await ingestPotionEvent(pool, gameEvent({ type: "game_complete" }), NOW, WINDOW)).status).toBe(400);
    expect((await ingestPotionEvent(pool, {
      schema_version: 1,
      visitor_id: IDS.visitor,
      event_id: IDS.event2,
      type: "site_active",
    }, NOW, WINDOW)).status).toBe(204);
    expect((await ingestPotionEvent(pool, gameEvent(), WINDOW.enrollUntilMs, WINDOW)).status).toBe(204);

    const count = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM potion_pilot_visitors");
    expect(count.rows[0]?.count).toBe(0);
  });

  it("accepts existing participants after enrollment, but excludes them at the exact 45-day expiry boundary", async () => {
    await ingestPotionEvent(pool, gameEvent(), NOW, WINDOW);
    const afterEnrollment = WINDOW.enrollUntilMs + 1;
    const activity = await ingestPotionEvent(pool, {
      schema_version: 1,
      visitor_id: IDS.visitor,
      event_id: IDS.event2,
      type: "site_active",
    }, afterEnrollment, WINDOW);
    expect(activity.status).toBe(200);

    const expiry = NOW + 45 * DAY_MS;
    const expired = await ingestPotionEvent(pool, gameEvent({ event_id: IDS.event3, run_id: IDS.run2 }), expiry, {
      ...WINDOW,
      observeUntilMs: expiry + DAY_MS,
    });
    expect(expired).toEqual({ status: 204 });
  });

  it("requires a matching start before complete and rejects valid-mode mismatches", async () => {
    await ingestPotionEvent(pool, gameEvent(), NOW, WINDOW);

    const missing = await ingestPotionEvent(pool, gameEvent({
      type: "game_complete",
      event_id: IDS.event2,
      run_id: IDS.run2,
    }), NOW + 1, WINDOW);
    expect(missing).toEqual({ status: 400, body: { error: "event_conflict" } });

    const mismatch = await ingestPotionEvent(pool, gameEvent({
      type: "game_complete",
      event_id: IDS.event3,
      mode: "practice",
    }), NOW + 2, WINDOW);
    expect(mismatch).toEqual({ status: 400, body: { error: "event_conflict" } });

    const complete = await ingestPotionEvent(pool, gameEvent({ type: "game_complete", event_id: IDS.event4 }), NOW + 3, WINDOW);
    expect(complete.status).toBe(200);
  });

  it("treats identical event IDs as idempotent and rolls back a conflicting ID without leaving a participant", async () => {
    await ingestPotionEvent(pool, gameEvent(), NOW, WINDOW);

    const identical = await ingestPotionEvent(pool, gameEvent(), NOW + 1, WINDOW);
    expect(identical.status).toBe(200);

    const conflict = await ingestPotionEvent(pool, gameEvent({ visitor_id: IDS.visitor2 }), NOW + 2, WINDOW);
    expect(conflict).toEqual({ status: 400, body: { error: "event_conflict" } });
    const missingParticipant = await pool.query("SELECT 1 FROM potion_pilot_visitors WHERE visitor_id = $1", [IDS.visitor2]);
    expect(missingParticipant.rowCount).toBe(0);
  });

  it("rejects reuse of a run/type with a new event ID and deduplicates daily site activity", async () => {
    await ingestPotionEvent(pool, gameEvent(), NOW, WINDOW);
    const reusedRun = await ingestPotionEvent(pool, gameEvent({ event_id: IDS.event2 }), NOW + 1, WINDOW);
    expect(reusedRun).toEqual({ status: 400, body: { error: "event_conflict" } });

    const active1 = await ingestPotionEvent(pool, {
      schema_version: 1,
      visitor_id: IDS.visitor,
      event_id: IDS.event3,
      type: "site_active",
    }, NOW + 2, WINDOW);
    const active2 = await ingestPotionEvent(pool, {
      schema_version: 1,
      visitor_id: IDS.visitor,
      event_id: IDS.event4,
      type: "site_active",
    }, NOW + 3, WINDOW);
    expect(active1.status).toBe(200);
    expect(active2.status).toBe(200);
    const count = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM potion_pilot_events WHERE event_type = 'site_active'"
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it("serializes concurrent first-start retries into one participant and event", async () => {
    const results = await Promise.all([
      ingestPotionEvent(pool, gameEvent(), NOW, WINDOW),
      ingestPotionEvent(pool, gameEvent(), NOW, WINDOW),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    const counts = await pool.query<{ visitors: number; events: number }>(
      `SELECT
        (SELECT COUNT(*)::int FROM potion_pilot_visitors) AS visitors,
        (SELECT COUNT(*)::int FROM potion_pilot_events) AS events`
    );
    expect(counts.rows[0]).toEqual({ visitors: 1, events: 1 });
  });
});
