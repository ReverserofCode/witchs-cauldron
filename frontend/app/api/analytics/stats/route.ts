import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "../db";
import { requireAdmin } from "../auth";

export const runtime = "nodejs";

function startOfDayUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return startOfDayUTC(parsed);
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: "unauthorized", reason: auth.reason }, { status: 401 });
  }

  await ensureSchema();

  const url = new URL(request.url);
  const today = startOfDayUTC(new Date());
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);
  const defaultTo = new Date(today);
  defaultTo.setUTCDate(defaultTo.getUTCDate() + 1);

  const from = parseDateParam(url.searchParams.get("from"), defaultFrom);
  const to = parseDateParam(url.searchParams.get("to"), defaultTo);

  const pool = getPool();
  const rangeResult = await pool.query(
    `
      WITH range_events AS (
        SELECT ip, MIN(created_at) AS first_seen
        FROM analytics_events
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY ip
      ),
      returning_ips AS (
        SELECT r.ip
        FROM range_events r
        JOIN analytics_events e
          ON e.ip = r.ip
         AND e.created_at < r.first_seen
         AND e.created_at >= r.first_seen - interval '30 days'
        GROUP BY r.ip
      )
      SELECT
        (SELECT COUNT(*) FROM range_events) AS unique_visitors,
        (SELECT COUNT(*) FROM returning_ips) AS returning_visitors,
        (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2) AS pageviews,
        (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'menu_click' AND created_at >= $1 AND created_at < $2) AS menu_clicks
    `,
    [from.toISOString(), to.toISOString()]
  );

  const dailyResult = await pool.query(
    `
      SELECT
        date_trunc('day', created_at) AS day,
        COUNT(DISTINCT ip) AS unique_visitors,
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY day
      ORDER BY day ASC
    `,
    [from.toISOString(), to.toISOString()]
  );

  const sectionViewsResult = await pool.query(
    `
      SELECT element_id, element_label, COUNT(*) AS views
      FROM analytics_events
      WHERE event_type = 'section_view' AND created_at >= $1 AND created_at < $2
      GROUP BY element_id, element_label
      ORDER BY views DESC
    `,
    [from.toISOString(), to.toISOString()]
  );

  const menuResult = await pool.query(
    `
      SELECT element_id, element_label, COUNT(*) AS clicks
      FROM analytics_events
      WHERE event_type = 'menu_click' AND created_at >= $1 AND created_at < $2
      GROUP BY element_id, element_label
      ORDER BY clicks DESC
      LIMIT 10
    `,
    [from.toISOString(), to.toISOString()]
  );

  const row = rangeResult.rows[0] ?? {};
  return NextResponse.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      uniqueVisitors: Number(row.unique_visitors ?? 0),
      returningVisitors: Number(row.returning_visitors ?? 0),
      pageviews: Number(row.pageviews ?? 0),
      menuClicks: Number(row.menu_clicks ?? 0),
    },
    daily: dailyResult.rows.map((entry: { day: string; unique_visitors: string | number | null; pageviews: string | number | null; menu_clicks: string | number | null }) => ({
      day: entry.day,
      uniqueVisitors: Number(entry.unique_visitors ?? 0),
      pageviews: Number(entry.pageviews ?? 0),
      menuClicks: Number(entry.menu_clicks ?? 0),
    })),
    topMenuClicks: menuResult.rows.map((entry: { element_id: string; element_label: string | null; clicks: string | number | null }) => ({
      elementId: entry.element_id,
      label: entry.element_label,
      clicks: Number(entry.clicks ?? 0),
    })),
    sectionViews: sectionViewsResult.rows.map((entry: { element_id: string; element_label: string | null; views: string | number | null }) => ({
      sectionId: entry.element_id,
      label: entry.element_label,
      views: Number(entry.views ?? 0),
    })),
  });
}
