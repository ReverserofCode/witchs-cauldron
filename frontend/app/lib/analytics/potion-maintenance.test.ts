import { spawn } from "node:child_process";
import { createServer, type Server } from "node:net";
import { resolve } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ensurePotionSchema } from "./potion-db";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/analytics-maintenance.mjs");
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

type ScriptResult = { code: number | null; stdout: string; stderr: string };

function runMaintenance(command: string, overrides: Partial<NodeJS.ProcessEnv> = {}, timeoutMs = 12_000) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? process.env.NODE_ENV ?? "test",
  };
  delete env.POTION_TEST_DATABASE_URL;
  if (overrides.ANALYTICS_DATABASE_URL === undefined) delete env.ANALYTICS_DATABASE_URL;
  if (overrides.DATABASE_URL === undefined) delete env.DATABASE_URL;

  return new Promise<ScriptResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, command], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    const timeout = setTimeout(() => child.kill(), timeoutMs);
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      resolveResult({ code, stdout, stderr });
    });
  });
}

async function listen(server: Server) {
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveListen());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server has no TCP port");
  return address.port;
}

async function unusedLoopbackPort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise<void>((resolveClose, reject) => server.close((error) => error ? reject(error) : resolveClose()));
  return port;
}

describe("potion maintenance process contract", () => {
  it.each(["potion-profile", "potion-retention"])("fails closed when %s has no explicit database target", async (command) => {
    const result = await runMaintenance(command);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("potion_database_not_configured");
    expect(result.stdout).toBe("");
  });

  it.each(["potion-profile", "potion-retention"])("%s uses only the first explicit URL and never prints either URL or its credentials", async (command) => {
    let fallbackConnections = 0;
    const fallback = createServer((socket) => {
      fallbackConnections += 1;
      socket.destroy();
    });
    const fallbackPort = await listen(fallback);
    const primaryPort = await unusedLoopbackPort();
    const primary = `postgres://primary-user:primary-secret@127.0.0.1:${primaryPort}/potion_test`;
    const secondary = `postgres://fallback-user:fallback-secret@127.0.0.1:${fallbackPort}/potion_test`;

    try {
      const result = await runMaintenance(command, {
        ANALYTICS_DATABASE_URL: primary,
        DATABASE_URL: secondary,
      });
      const output = result.stdout + result.stderr;

      expect(result.code).toBe(1);
      expect(result.stderr).toContain("potion_database_unreachable");
      expect(fallbackConnections).toBe(0);
      expect(output).not.toContain(primary);
      expect(output).not.toContain(secondary);
      expect(output).not.toContain("primary-secret");
      expect(output).not.toContain("fallback-secret");
    } finally {
      await new Promise<void>((resolveClose) => fallback.close(() => resolveClose()));
    }
  });
});

const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const COEXISTENCE_SCHEMA = "potion_maintenance_coexistence";
const IDS = {
  expiredVisitor: "40000000-0000-4000-8000-000000000041",
  expiredEvent: "50000000-0000-4000-8000-000000000041",
  futureVisitor: "40000000-0000-4000-8000-000000000042",
  futureEvent: "50000000-0000-4000-8000-000000000042",
  generalEvent: "60000000-0000-4000-8000-000000000041",
} as const;

describeDatabase("potion maintenance against guarded PostgreSQL", () => {
  let pool: Pool;
  let coexistencePool: Pool;
  let coexistenceDatabaseUrl: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: testDatabaseUrl, max: 3 });
    await ensurePotionSchema(pool);
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${COEXISTENCE_SCHEMA}`);
    const coexistenceUrl = new URL(testDatabaseUrl);
    coexistenceUrl.searchParams.set("options", `-c search_path=${COEXISTENCE_SCHEMA}`);
    coexistenceDatabaseUrl = coexistenceUrl.toString();
    coexistencePool = new Pool({ connectionString: coexistenceDatabaseUrl, max: 3 });
    await ensurePotionSchema(coexistencePool);
    await coexistencePool.query(
      `CREATE TABLE IF NOT EXISTS analytics_events (
         event_id uuid PRIMARY KEY,
         created_at timestamptz NOT NULL
       )`
    );
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM potion_pilot_visitors WHERE visitor_id = ANY($1::uuid[])", [
      IDS.expiredVisitor,
      IDS.futureVisitor,
    ]);
    await coexistencePool.query("DELETE FROM potion_pilot_visitors WHERE visitor_id = ANY($1::uuid[])", [
      IDS.expiredVisitor,
      IDS.futureVisitor,
    ]);
    await coexistencePool.query("DELETE FROM analytics_events WHERE event_id = $1", [IDS.generalEvent]);
  });

  afterAll(async () => {
    if (coexistencePool) {
      await coexistencePool.query("DELETE FROM potion_pilot_visitors WHERE visitor_id = ANY($1::uuid[])", [
        IDS.expiredVisitor,
        IDS.futureVisitor,
      ]).catch(() => undefined);
      await coexistencePool.query("DELETE FROM analytics_events WHERE event_id = $1", [IDS.generalEvent])
        .catch(() => undefined);
      await coexistencePool.end();
    }
    if (pool) {
      await pool.query("DELETE FROM potion_pilot_visitors WHERE visitor_id = ANY($1::uuid[])", [
        IDS.expiredVisitor,
        IDS.futureVisitor,
      ]).catch(() => undefined);
      await pool.end();
    }
  });

  async function insertVisitorWithEvent(visitorId: string, eventId: string, expiresAt: string, target = pool) {
    await target.query(
      `INSERT INTO potion_pilot_visitors (visitor_id, first_started_at, first_day_kst, expires_at)
       VALUES ($1, '2026-01-01T00:00:00Z', '2026-01-01', $2::timestamptz)`,
      [visitorId, expiresAt]
    );
    await target.query(
      `INSERT INTO potion_pilot_events
       (event_id, visitor_id, event_type, run_id, mode, rule_version, occurred_at, day_kst)
       VALUES ($1, $2, 'site_active', NULL, NULL, NULL, '2026-01-01T00:00:00Z', '2026-01-01')`,
      [eventId, visitorId]
    );
  }

  it("profiles expiry only and reports an uninstalled search path without treating it as an error", async () => {
    await insertVisitorWithEvent(IDS.expiredVisitor, IDS.expiredEvent, "2026-01-02T00:00:00Z");
    await insertVisitorWithEvent(IDS.futureVisitor, IDS.futureEvent, "2100-01-01T00:00:00Z");

    const profile = await runMaintenance("potion-profile", { ANALYTICS_DATABASE_URL: testDatabaseUrl });
    expect(profile.code).toBe(0);
    const report = JSON.parse(profile.stdout);
    expect(report).toMatchObject({ installed: true });
    expect(report.expiredCount).toBeGreaterThanOrEqual(1);
    expect(report.oldestExpiry).toBe("2026-01-02T00:00:00.000Z");
    expect(report.maximumExpiry).toBe("2100-01-01T00:00:00.000Z");

    const missingSchemaUrl = new URL(testDatabaseUrl);
    missingSchemaUrl.searchParams.set("options", "-c search_path=potion_maintenance_missing");
    const uninstalled = await runMaintenance("potion-profile", {
      ANALYTICS_DATABASE_URL: missingSchemaUrl.toString(),
    });
    expect(uninstalled.code).toBe(0);
    expect(JSON.parse(uninstalled.stdout)).toMatchObject({ installed: false });
  });

  it("deletes only expired potion data while preserving future potion rows and general analytics", async () => {
    await insertVisitorWithEvent(IDS.expiredVisitor, IDS.expiredEvent, "2026-01-02T00:00:00Z", coexistencePool);
    await insertVisitorWithEvent(IDS.futureVisitor, IDS.futureEvent, "2100-01-01T00:00:00Z", coexistencePool);
    await coexistencePool.query(
      "INSERT INTO analytics_events (event_id, created_at) VALUES ($1, '2000-01-01T00:00:00Z')",
      [IDS.generalEvent]
    );

    const result = await runMaintenance("potion-retention", { ANALYTICS_DATABASE_URL: coexistenceDatabaseUrl });
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ remainingExpired: 0 });
    expect(report.deletedVisitors).toBeGreaterThanOrEqual(1);
    expect(result.stdout).not.toContain(IDS.expiredVisitor);
    expect(result.stdout).not.toContain(IDS.expiredEvent);

    const rows = await coexistencePool.query<{ visitor_id: string }>(
      "SELECT visitor_id::text FROM potion_pilot_visitors WHERE visitor_id = ANY($1::uuid[]) ORDER BY visitor_id",
      [[IDS.expiredVisitor, IDS.futureVisitor]]
    );
    expect(rows.rows).toEqual([{ visitor_id: IDS.futureVisitor }]);
    const events = await coexistencePool.query<{ event_id: string }>(
      "SELECT event_id::text FROM potion_pilot_events WHERE event_id = ANY($1::uuid[]) ORDER BY event_id",
      [[IDS.expiredEvent, IDS.futureEvent]]
    );
    expect(events.rows).toEqual([{ event_id: IDS.futureEvent }]);
    const general = await coexistencePool.query<{ event_id: string; created_at: Date }>(
      "SELECT event_id::text, created_at FROM analytics_events WHERE event_id = $1",
      [IDS.generalEvent]
    );
    expect(general.rows).toEqual([{
      event_id: IDS.generalEvent,
      created_at: new Date("2000-01-01T00:00:00.000Z"),
    }]);
  });

  it("fails rather than reporting zero deletions when potion tables are not installed", async () => {
    const missingSchemaUrl = new URL(testDatabaseUrl);
    missingSchemaUrl.searchParams.set("options", "-c search_path=potion_maintenance_missing");

    const result = await runMaintenance("potion-retention", {
      ANALYTICS_DATABASE_URL: missingSchemaUrl.toString(),
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("potion_retention_failed");
  });
});
