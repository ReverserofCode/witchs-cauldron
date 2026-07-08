import { NextResponse } from "next/server";
import {
  ANALYTICS_EVENT_TYPES,
  ANALYTICS_SCHEMA_VERSION,
  ANALYTICS_TIME_ZONE,
} from "../../../lib/analytics/contract";
import { ensureSchema, getPool } from "../db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_COLUMNS = ["visitor_key", "ip_hash", "referrer_host", "event_date_kst"] as const;
const REQUIRED_INDEXES = [
  "analytics_events_date_type_idx",
  "analytics_events_type_date_idx",
  "analytics_events_visitor_date_idx",
  "analytics_events_referrer_date_idx",
  "analytics_events_element_date_idx",
] as const;

export async function GET() {
  const startedAt = Date.now();

  try {
    await ensureSchema();
    const pool = await getPool();
    const [eventsResult, columnsResult, indexesResult] = await Promise.all([
      pool.query(
        `
          SELECT
            MAX(created_at) AS latest_event_at,
            COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h,
            COUNT(*) FILTER (WHERE event_type = 'pageview' AND created_at >= now() - interval '24 hours') AS pageviews_24h,
            COUNT(*) FILTER (WHERE NOT (event_type = ANY($1::text[]))) AS unknown_events,
            COUNT(*) FILTER (WHERE visitor_key IS NULL) AS missing_visitor_key,
            COUNT(*) FILTER (WHERE event_date_kst IS NULL) AS missing_event_date_kst
          FROM analytics_events
        `,
        [ANALYTICS_EVENT_TYPES]
      ),
      pool.query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'analytics_events'
            AND column_name = ANY($1::text[])
        `,
        [REQUIRED_COLUMNS]
      ),
      pool.query(
        `
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'analytics_events'
            AND indexname = ANY($1::text[])
        `,
        [REQUIRED_INDEXES]
      ),
    ]);

    const eventRow = eventsResult.rows[0] ?? {};
    const columns = new Set(columnsResult.rows.map((row: { column_name: string }) => row.column_name));
    const indexes = new Set(indexesResult.rows.map((row: { indexname: string }) => row.indexname));
    const missingColumns = REQUIRED_COLUMNS.filter((column) => !columns.has(column));
    const missingIndexes = REQUIRED_INDEXES.filter((index) => !indexes.has(index));

    return NextResponse.json({
      ok: missingColumns.length === 0 && missingIndexes.length === 0,
      database: {
        connected: true,
        latencyMs: Date.now() - startedAt,
      },
      events: {
        latestEventAt: eventRow.latest_event_at ?? null,
        events24h: Number(eventRow.events_24h ?? 0),
        pageviews24h: Number(eventRow.pageviews_24h ?? 0),
        unknownEvents: Number(eventRow.unknown_events ?? 0),
        missingVisitorKey: Number(eventRow.missing_visitor_key ?? 0),
        missingEventDateKst: Number(eventRow.missing_event_date_kst ?? 0),
      },
      schema: {
        version: ANALYTICS_SCHEMA_VERSION,
        timeZone: ANALYTICS_TIME_ZONE,
        requiredColumns: REQUIRED_COLUMNS,
        requiredIndexes: REQUIRED_INDEXES,
        missingColumns,
        missingIndexes,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        database: {
          connected: false,
          latencyMs: Date.now() - startedAt,
        },
        error: error instanceof Error ? error.message : "analytics_health_failed",
        generatedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
