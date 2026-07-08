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
const ALLOWED_EVENT_TYPES = ["pageview", "menu_click", "content_click", "section_view", "scroll_depth", "page_exit"];

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
  const detail =
    lastError && typeof lastError === "object"
      ? [lastError.code, lastError.hostname, lastError.message].filter(Boolean).join(" ")
      : "";
  throw new Error(`analytics_db_unreachable${detail ? `: ${detail}` : ""}`);
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

async function scrubIp(pool) {
  const scrubbedEvents = await pool.query(
    `
      UPDATE analytics_events
      SET ip = 'redacted'
      WHERE ip IS NOT NULL
        AND ip <> ''
        AND ip NOT IN ('redacted', 'unknown')
        AND visitor_key IS NOT NULL
        AND visitor_key <> ''
        AND ip_hash IS NOT NULL
        AND ip_hash <> ''
        AND event_date_kst IS NOT NULL
    `
  );
  const scrubbedSessions = await pool.query(
    `
      UPDATE analytics_sessions
      SET ip = 'redacted'
      WHERE ip IS NOT NULL
        AND ip <> ''
        AND ip NOT IN ('redacted', 'unknown')
    `
  );

  console.log(
    `[analytics-maintenance] scrub-ip ok events=${scrubbedEvents.rowCount ?? 0} sessions=${
      scrubbedSessions.rowCount ?? 0
    }`
  );
}

function profileFindings(overview) {
  const rows = Number(overview.rows ?? 0);
  const rate = (value) => (rows > 0 ? Number(value ?? 0) / rows : 0);
  const findings = [];

  if (Number(overview.events_24h ?? 0) === 0) {
    findings.push({
      severity: "high",
      message: "최근 24시간 이벤트가 없어 수집 중단 가능성이 있습니다.",
    });
  }

  if (Number(overview.missing_visitor_key ?? 0) > 0 || Number(overview.missing_event_date_kst ?? 0) > 0) {
    findings.push({
      severity: "high",
      message: "visitor_key 또는 event_date_kst 누락으로 운영 통계 기준이 흔들릴 수 있습니다.",
    });
  }

  if (Number(overview.raw_ip_rows ?? 0) > 0) {
    findings.push({
      severity: rate(overview.raw_ip_rows) >= 0.1 ? "high" : "medium",
      message: "실제 raw IP로 보이는 값이 남아 있어 개인정보 최소화 관점에서 별도 scrub 정책 검토가 필요합니다.",
    });
  }

  if (Number(overview.unknown_events ?? 0) > 0) {
    findings.push({
      severity: rate(overview.unknown_events) >= 0.05 ? "high" : "medium",
      message: "허용되지 않은 event_type이 있어 track contract와 클라이언트 수집 코드를 맞춰야 합니다.",
    });
  }

  if (Number(overview.duplicate_event_ids ?? 0) > 0) {
    findings.push({
      severity: rate(overview.duplicate_event_ids) >= 0.05 ? "high" : "medium",
      message: "event_id 중복이 있어 재전송 또는 중복 삽입 방지 정책을 확인해야 합니다.",
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "low",
      message: "핵심 품질 규칙에서 즉시 조치할 이상은 확인되지 않았습니다.",
    });
  }

  return findings;
}

async function profile(pool) {
  const [overviewResult, eventTypeResult, dailyResult, referrerResult, metadataKeyResult, deviceResult] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*)::int AS rows,
          MIN(created_at) AS min_created_at,
          MAX(created_at) AS max_created_at,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::int AS events_24h,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS events_7d,
          COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::int AS events_30d,
          COUNT(*) FILTER (WHERE created_at > now() + interval '5 minutes')::int AS future_events,
          COUNT(*) FILTER (WHERE NOT (event_type = ANY($1::text[])))::int AS unknown_events,
          GREATEST(
            0,
            COUNT(*) FILTER (WHERE event_id IS NOT NULL) - COUNT(DISTINCT event_id) FILTER (WHERE event_id IS NOT NULL)
          )::int AS duplicate_event_ids,
          COUNT(*) FILTER (WHERE visitor_key IS NULL OR visitor_key = '')::int AS missing_visitor_key,
          COUNT(*) FILTER (WHERE event_date_kst IS NULL)::int AS missing_event_date_kst,
          COUNT(*) FILTER (WHERE ip_hash IS NULL OR ip_hash = '')::int AS missing_ip_hash,
          COUNT(*) FILTER (
            WHERE ip IS NOT NULL
              AND ip <> ''
              AND ip NOT IN ('redacted', 'unknown')
          )::int AS raw_ip_rows,
          COUNT(*) FILTER (WHERE ip = 'redacted')::int AS redacted_ip_rows,
          COUNT(*) FILTER (WHERE ip = 'unknown')::int AS unknown_ip_rows,
          COUNT(*) FILTER (WHERE referrer_host IS NULL OR referrer_host = '')::int AS missing_referrer_host
        FROM analytics_events
      `,
      [ALLOWED_EVENT_TYPES]
    ),
    pool.query(
      `
        SELECT
          event_type,
          COUNT(*)::int AS events,
          COUNT(DISTINCT COALESCE(visitor_key, 'legacy:' || COALESCE(session_id::text, ip, 'unknown')))::int AS visitors
        FROM analytics_events
        GROUP BY event_type
        ORDER BY events DESC, event_type
      `
    ),
    pool.query(
      `
        SELECT
          COALESCE(event_date_kst, (created_at AT TIME ZONE 'Asia/Seoul')::date)::text AS day,
          COUNT(*)::int AS events,
          COUNT(*) FILTER (WHERE event_type = 'pageview')::int AS pageviews,
          COUNT(DISTINCT COALESCE(visitor_key, 'legacy:' || COALESCE(session_id::text, ip, 'unknown')))
            FILTER (WHERE event_type = 'pageview')::int AS visitors
        FROM analytics_events
        WHERE created_at >= now() - interval '30 days'
        GROUP BY 1
        ORDER BY 1 DESC
        LIMIT 30
      `
    ),
    pool.query(
      `
        SELECT
          COALESCE(NULLIF(referrer_host, ''), '(missing)') AS referrer_host,
          COUNT(*)::int AS events,
          COUNT(DISTINCT COALESCE(visitor_key, 'legacy:' || COALESCE(session_id::text, ip, 'unknown')))::int AS visitors
        FROM analytics_events
        WHERE event_type = 'pageview'
        GROUP BY 1
        ORDER BY visitors DESC, events DESC
        LIMIT 12
      `
    ),
    pool.query(
      `
        SELECT key, COUNT(*)::int AS rows
        FROM analytics_events, LATERAL jsonb_object_keys(COALESCE(metadata, '{}'::jsonb)) AS key
        GROUP BY key
        ORDER BY rows DESC, key
        LIMIT 50
      `
    ),
    pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE metadata ? 'device_category' OR metadata ? 'deviceCategory')::int AS rows_with_device_category,
          COUNT(*) FILTER (WHERE event_type = 'scroll_depth' AND metadata->>'threshold' IN ('25', '50', '75', '100'))::int AS valid_scroll_threshold_rows,
          COUNT(*) FILTER (WHERE event_type = 'scroll_depth')::int AS scroll_rows,
          COUNT(*) FILTER (WHERE event_type = 'page_exit' AND (metadata ? 'dwell_seconds' OR metadata ? 'durationMs' OR metadata ? 'durationSeconds'))::int AS exit_rows_with_duration,
          COUNT(*) FILTER (WHERE event_type = 'page_exit')::int AS exit_rows
        FROM analytics_events
      `
    ),
  ]);

  const overview = overviewResult.rows[0] ?? {};
  const report = {
    generatedAt: new Date().toISOString(),
    grain: "analytics_events row = one collected event",
    overview,
    metadataCoverage: deviceResult.rows[0] ?? {},
    eventTypes: eventTypeResult.rows,
    recentDaily: dailyResult.rows,
    topReferrers: referrerResult.rows,
    metadataKeys: metadataKeyResult.rows,
    findings: profileFindings(overview),
  };

  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const command = process.argv[2];
  if (!["migrate", "backfill", "retention", "scrub-ip", "profile", "all"].includes(command)) {
    console.error("Usage: node scripts/analytics-maintenance.mjs <migrate|backfill|retention|scrub-ip|profile|all>");
    process.exit(2);
  }

  const pool = await getPool();
  try {
    if (command === "migrate" || command === "all") await migrate(pool);
    if (command === "backfill" || command === "all") await backfill(pool);
    if (command === "scrub-ip" || command === "all") await scrubIp(pool);
    if (command === "retention" || command === "all") await retention(pool);
    if (command === "profile") await profile(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[analytics-maintenance] failed", error);
  process.exit(1);
});
