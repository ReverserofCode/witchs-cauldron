#!/usr/bin/env node
import { createHmac } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_DB_URLS = [
  "postgres://analytics:analytics@analytics-db:5432/analytics",
  "postgres://analytics:analytics@localhost:5432/analytics",
];
const BATCH_SIZE = Number(process.env.ANALYTICS_MAINTENANCE_BATCH_SIZE || 500);
const RETENTION_MONTHS = Number(process.env.ANALYTICS_RETENTION_MONTHS || 13);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const migrationStatements = [
  `
    ALTER TABLE analytics_events
      ADD COLUMN IF NOT EXISTS ip_hash text,
      ADD COLUMN IF NOT EXISTS visitor_key text,
      ADD COLUMN IF NOT EXISTS referrer_host text,
      ADD COLUMN IF NOT EXISTS event_date_kst date;
  `,
  `CREATE INDEX IF NOT EXISTS analytics_events_date_type_idx ON analytics_events (event_date_kst, event_type);`,
  `CREATE INDEX IF NOT EXISTS analytics_events_type_date_idx ON analytics_events (event_type, event_date_kst);`,
  `CREATE INDEX IF NOT EXISTS analytics_events_visitor_date_idx ON analytics_events (visitor_key, event_date_kst);`,
  `CREATE INDEX IF NOT EXISTS analytics_events_referrer_date_idx ON analytics_events (referrer_host, event_date_kst);`,
  `CREATE INDEX IF NOT EXISTS analytics_events_element_date_idx ON analytics_events (event_type, element_id, event_date_kst);`,
];

function getCandidates() {
  return Array.from(
    new Set([process.env.ANALYTICS_DATABASE_URL, process.env.DATABASE_URL, ...DEFAULT_DB_URLS].filter(Boolean))
  );
}

async function getPool() {
  let lastError = null;
  for (const connectionString of getCandidates()) {
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 3000 });
    try {
      const client = await pool.connect();
      client.release();
      return pool;
    } catch (error) {
      lastError = error;
      await pool.end().catch(() => {});
    }
  }
  throw new Error(`analytics_db_unreachable${lastError instanceof Error ? `: ${lastError.message}` : ""}`);
}

function getSecret() {
  const configured = process.env.ANALYTICS_HASH_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ANALYTICS_HASH_SECRET is required for production analytics maintenance");
  }
  return "development-analytics-secret";
}

function hashIp(ip, secret) {
  return createHmac("sha256", secret).update(ip || "unknown").digest("hex");
}

function kstDate(date) {
  return new Date(new Date(date).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function normalizeReferrerHost(referrer) {
  if (!referrer || typeof referrer !== "string" || !referrer.includes("://")) return "(direct)";
  try {
    const parsed = new URL(referrer);
    if (parsed.protocol === "android-app:") return `android-app://${parsed.hostname.toLowerCase()}`;
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "(direct)";
    return parsed.hostname.toLowerCase() || "(direct)";
  } catch {
    return "(direct)";
  }
}

function visitorKey(sessionId, ipHash) {
  if (sessionId) return `session:${sessionId}`;
  return `ip:${ipHash}`;
}

async function migrate(pool) {
  for (const statement of migrationStatements) {
    await pool.query(statement);
  }
  console.log("[analytics-maintenance] migrate ok");
}

async function backfill(pool) {
  const secret = getSecret();
  let total = 0;

  for (;;) {
    const result = await pool.query(
      `
        SELECT id, session_id, ip, referrer, created_at
        FROM analytics_events
        WHERE visitor_key IS NULL
           OR ip_hash IS NULL
           OR referrer_host IS NULL
           OR event_date_kst IS NULL
        ORDER BY id ASC
        LIMIT $1
      `,
      [BATCH_SIZE]
    );

    if (result.rows.length === 0) break;

    for (const row of result.rows) {
      const ipHash = hashIp(row.ip || "unknown", secret);
      await pool.query(
        `
          UPDATE analytics_events
          SET
            ip_hash = COALESCE(ip_hash, $2),
            visitor_key = COALESCE(visitor_key, $3),
            referrer_host = COALESCE(referrer_host, $4),
            event_date_kst = COALESCE(event_date_kst, $5::date)
          WHERE id = $1
        `,
        [row.id, ipHash, visitorKey(row.session_id, ipHash), normalizeReferrerHost(row.referrer), kstDate(row.created_at)]
      );
      total += 1;
    }

    console.log(`[analytics-maintenance] backfilled ${total} rows`);
  }

  console.log(`[analytics-maintenance] backfill ok rows=${total}`);
}

async function retention(pool) {
  const deletedEvents = await pool.query(
    `
      DELETE FROM analytics_events
      WHERE created_at < now() - make_interval(months => $1::int)
    `,
    [RETENTION_MONTHS]
  );
  const deletedSessions = await pool.query(
    `
      DELETE FROM analytics_sessions sessions
      WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events events
        WHERE events.session_id = sessions.session_id
      )
    `
  );

  console.log(
    `[analytics-maintenance] retention ok events=${deletedEvents.rowCount ?? 0} orphanSessions=${
      deletedSessions.rowCount ?? 0
    } months=${RETENTION_MONTHS}`
  );
}

async function main() {
  const command = process.argv[2];
  if (!["migrate", "backfill", "retention", "all"].includes(command)) {
    console.error("Usage: node scripts/analytics-maintenance.mjs <migrate|backfill|retention|all>");
    process.exit(2);
  }

  const pool = await getPool();
  try {
    if (command === "migrate" || command === "all") await migrate(pool);
    if (command === "backfill" || command === "all") await backfill(pool);
    if (command === "retention" || command === "all") await retention(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[analytics-maintenance] failed", error);
  process.exit(1);
});
