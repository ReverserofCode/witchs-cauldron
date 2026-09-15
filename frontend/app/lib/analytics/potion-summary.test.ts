import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";

import { ensurePotionSchema } from "./potion-db";

const configState = vi.hoisted(() => ({
  window: null as null | { enrollFromMs: number; enrollUntilMs: number; observeUntilMs: number },
}));

vi.mock("./potion-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./potion-config")>();
  return {
    ...actual,
    get POTION_PILOT_WINDOW() {
      return configState.window;
    },
  };
});

import { getPotionSummary, validateCohortRange } from "./potion-summary";

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
const NOW = Date.parse("2026-09-15T12:00:00.000Z");

function parameterCheckingPool() {
  const client = {
    release: vi.fn(),
    query: vi.fn(async (sql: string, values?: unknown[]) => {
      if (!values) return { rows: [] };
      const positions = [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));
      const used = new Set(positions);
      for (let position = 1; position <= values.length; position += 1) {
        if (!used.has(position)) {
          const error = new Error(`could not determine data type of parameter $${position}`);
          Object.assign(error, { code: "42P18" });
          throw error;
        }
      }
      if (Math.max(0, ...positions) !== values.length) throw new Error("parameter_count_mismatch");
      if (sql.includes("AS eligible,")) return { rows: [{ eligible: 0, site_returned: 0, game_returned: 0 }] };
      if (sql.includes("AS immature")) return { rows: [{ immature: 0 }] };
      if (sql.includes("AS replay_visitors")) return { rows: [{ replay_visitors: 0 }] };
      if (sql.includes("AS eligible_runs")) {
        return { rows: [{ eligible_runs: 0, completed_within_24h: 0, completed_late: 0 }] };
      }
      return { rows: [] };
    }),
  };
  return { pool: { connect: vi.fn(async () => client) } as unknown as Pool, client };
}

describe("validateCohortRange", () => {
  it("round-trips real YYYY-MM-DD calendar dates including leap days", () => {
    expect(validateCohortRange("2024-02-29", "2024-03-01")).toEqual({ from: "2024-02-29", to: "2024-03-01" });
    for (const invalid of ["2023-02-29", "2026-02-30", "2026-1-01", "2026-01-1", "2026-01-01T00:00:00Z"]) {
      expect(validateCohortRange(invalid, "2026-03-01")).toBeNull();
    }
  });

  it("rejects reversed and over-45-day inclusive ranges", () => {
    expect(validateCohortRange("2026-02-01", "2026-01-31")).toBeNull();
    expect(validateCohortRange("2026-01-01", "2026-02-14")).toEqual({ from: "2026-01-01", to: "2026-02-14" });
    expect(validateCohortRange("2026-01-01", "2026-02-15")).toBeNull();
  });

  it("binds a contiguous, query-owned parameter list for every summary statement", async () => {
    const { pool, client } = parameterCheckingPool();

    await expect(getPotionSummary(pool, "2026-09-01", "2026-09-08", NOW)).resolves.toMatchObject({
      eligible: 0,
      completion: { eligibleRuns: 0 },
    });
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describeDatabase("potion cohort summary against PostgreSQL", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 3 });
    await ensurePotionSchema(pool);
  });

  beforeEach(async () => {
    configState.window = null;
    await pool.query("TRUNCATE potion_pilot_events, potion_pilot_visitors CASCADE");
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function visitor(id: string, firstStartedAt: string, firstDayKst: string, expiresAt = "2026-10-20T00:00:00Z") {
    await pool.query(
      `INSERT INTO potion_pilot_visitors (visitor_id, first_started_at, first_day_kst, expires_at)
       VALUES ($1, $2::timestamptz, $3::date, $4::timestamptz)`,
      [id, firstStartedAt, firstDayKst, expiresAt]
    );
  }

  async function event(
    eventId: string,
    visitorId: string,
    type: "game_start" | "game_complete" | "site_active",
    occurredAt: string,
    dayKst: string,
    runId: string | null = null,
    mode: "daily" | "practice" | "slow-practice" | null = null
  ) {
    await pool.query(
      `INSERT INTO potion_pilot_events
       (event_id, visitor_id, event_type, run_id, mode, rule_version, occurred_at, day_kst)
       VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::date)`,
      [eventId, visitorId, type, runId, mode, type === "site_active" ? null : "potion-v1", occurredAt, dayKst]
    );
  }

  it("returns null rates instead of manufacturing percentages for empty denominators", async () => {
    const summary = await getPotionSummary(pool, "2026-09-01", "2026-09-08", NOW);
    expect(summary.eligible).toBe(0);
    expect(summary.siteReturnRate).toBeNull();
    expect(summary.gameReturnRate).toBeNull();
    expect(summary.completion).toEqual({
      eligibleRuns: 0,
      completedWithin24h: 0,
      completedLate: 0,
      rate: null,
    });
  });

  it("uses D1 through D7 maturity, cohort membership, KST days, expiry, and 24-hour completion", async () => {
    const ids = {
      a: "10000000-0000-4000-8000-000000000001",
      b: "10000000-0000-4000-8000-000000000002",
      c: "10000000-0000-4000-8000-000000000003",
      immature: "10000000-0000-4000-8000-000000000004",
      outside: "10000000-0000-4000-8000-000000000005",
      expired: "10000000-0000-4000-8000-000000000006",
    };
    await visitor(ids.a, "2026-08-31T23:59:00Z", "2026-09-01");
    await visitor(ids.b, "2026-09-02T00:00:00Z", "2026-09-02");
    await visitor(ids.c, "2026-09-03T00:00:00Z", "2026-09-03");
    await visitor(ids.immature, "2026-09-08T00:00:00Z", "2026-09-08");
    await visitor(ids.outside, "2026-08-31T00:00:00Z", "2026-08-31");
    await visitor(ids.expired, "2026-09-01T00:00:00Z", "2026-09-01", "2026-09-15T12:00:00Z");

    await event("20000000-0000-4000-8000-000000000001", ids.a, "game_start", "2026-08-31T23:59:00Z", "2026-09-01", "30000000-0000-4000-8000-000000000001", "daily");
    await event("20000000-0000-4000-8000-000000000002", ids.a, "game_start", "2026-09-01T00:01:00Z", "2026-09-01", "30000000-0000-4000-8000-000000000002", "practice");
    await event("20000000-0000-4000-8000-000000000003", ids.a, "game_complete", "2026-09-01T00:59:00Z", "2026-09-01", "30000000-0000-4000-8000-000000000001", "daily");
    await event("20000000-0000-4000-8000-000000000004", ids.a, "site_active", "2026-09-01T15:00:00Z", "2026-09-02");

    await event("20000000-0000-4000-8000-000000000005", ids.b, "game_start", "2026-09-02T00:00:00Z", "2026-09-02", "30000000-0000-4000-8000-000000000003", "practice");
    await event("20000000-0000-4000-8000-000000000006", ids.b, "game_complete", "2026-09-03T01:00:00Z", "2026-09-03", "30000000-0000-4000-8000-000000000003", "practice");
    await event("20000000-0000-4000-8000-000000000007", ids.b, "game_start", "2026-09-08T02:00:00Z", "2026-09-09", "30000000-0000-4000-8000-000000000004", "slow-practice");

    await event("20000000-0000-4000-8000-000000000008", ids.c, "game_start", "2026-09-03T00:00:00Z", "2026-09-03", "30000000-0000-4000-8000-000000000005", "daily");
    await event("20000000-0000-4000-8000-000000000009", ids.c, "site_active", "2026-09-10T15:00:00Z", "2026-09-11");

    await event("20000000-0000-4000-8000-000000000010", ids.immature, "game_start", "2026-09-15T00:00:00Z", "2026-09-15", "30000000-0000-4000-8000-000000000006", "daily");
    await event("20000000-0000-4000-8000-000000000011", ids.outside, "game_start", "2026-08-31T00:00:00Z", "2026-08-31", "30000000-0000-4000-8000-000000000007", "daily");
    await event("20000000-0000-4000-8000-000000000012", ids.expired, "game_start", "2026-09-01T00:00:00Z", "2026-09-01", "30000000-0000-4000-8000-000000000008", "daily");

    const summary = await getPotionSummary(pool, "2026-09-01", "2026-09-08", NOW);

    expect(summary).toMatchObject({
      generatedAt: "2026-09-15T12:00:00.000Z",
      timezone: "Asia/Seoul",
      identityBasis: "browser-pilot-id",
      from: "2026-09-01",
      to: "2026-09-08",
      observedThrough: "2026-09-15",
      eligible: 3,
      immature: 1,
      siteReturned: 2,
      gameReturned: 1,
      siteReturnRate: 66.7,
      gameReturnRate: 33.3,
      d0ReplayVisitors: 1,
      completion: {
        eligibleRuns: 5,
        completedWithin24h: 1,
        completedLate: 1,
        rate: 20,
      },
      startsByMode: { daily: 3, practice: 2, "slow-practice": 1 },
      window: null,
    });
  });

  it("caps maturity and completion at the configured observation cutoff", async () => {
    configState.window = {
      enrollFromMs: Date.parse("2026-09-01T00:00:00Z"),
      enrollUntilMs: Date.parse("2026-09-02T00:00:00Z"),
      observeUntilMs: Date.parse("2026-09-10T15:00:00Z"),
    };
    const id = "10000000-0000-4000-8000-000000000011";
    await visitor(id, "2026-09-03T00:00:00Z", "2026-09-03");
    await event("20000000-0000-4000-8000-000000000021", id, "game_start", "2026-09-10T00:00:00Z", "2026-09-10", "30000000-0000-4000-8000-000000000021", "daily");

    const summary = await getPotionSummary(pool, "2026-09-01", "2026-09-08", NOW);

    expect(summary.observedThrough).toBe("2026-09-11");
    expect(summary.eligible).toBe(1);
    expect(summary.immature).toBe(0);
    expect(summary.completion.eligibleRuns).toBe(0);
    expect(summary.window).toEqual(configState.window);
  });
});
