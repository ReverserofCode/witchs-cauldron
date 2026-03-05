import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "../db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  await ensureSchema();

  const url = new URL(request.url);
  const today = startOfDayUTC(new Date());
  const defaultFrom = new Date(today);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 6);
  const defaultToInclusive = new Date(today);

  const from = parseDateParam(url.searchParams.get("from"), defaultFrom);
  const toInclusive = parseDateParam(url.searchParams.get("to"), defaultToInclusive);
  if (toInclusive < from) {
    toInclusive.setTime(from.getTime());
  }

  const toExclusive = new Date(toInclusive);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const fromIso = from.toISOString();
  const toExclusiveIso = toExclusive.toISOString();

  const pool = await getPool();
  const rangeResult = await pool.query(
    `
      SELECT
        (SELECT COUNT(DISTINCT COALESCE(session_id::text, ip)) FROM analytics_events WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2) AS visitors,
        (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2) AS pageviews,
        (SELECT COUNT(*) FROM analytics_events WHERE event_type = 'menu_click' AND created_at >= $1 AND created_at < $2) AS menu_clicks
    `,
    [fromIso, toExclusiveIso]
  );

  const dailyResult = await pool.query(
    `
      SELECT
        date_trunc('day', created_at) AS day,
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) FILTER (WHERE event_type = 'pageview') AS unique_visitors,
        COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY day
      ORDER BY day ASC
    `,
    [fromIso, toExclusiveIso]
  );

  const sectionViewsResult = await pool.query(
    `
      SELECT element_id, element_label, COUNT(*) AS views
      FROM analytics_events
      WHERE event_type = 'section_view' AND created_at >= $1 AND created_at < $2
      GROUP BY element_id, element_label
      ORDER BY views DESC
    `,
    [fromIso, toExclusiveIso]
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
    [fromIso, toExclusiveIso]
  );

  const topPathsResult = await pool.query(
    `
      SELECT COALESCE(path, '(unknown)') AS path, COUNT(*) AS views
      FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `,
    [fromIso, toExclusiveIso]
  );

  const topReferrersResult = await pool.query(
    `
      SELECT referrer_host AS referrer, SUM(cnt) AS visits
      FROM (
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
            WHEN referrer NOT LIKE '%://%' THEN '(direct)'
            WHEN referrer LIKE 'android-app://%'
              THEN 'android-app://' || split_part(split_part(referrer, '://', 2), '/', 1)
            ELSE COALESCE(NULLIF(split_part(split_part(referrer, '://', 2), '/', 1), ''), '(direct)')
          END AS referrer_host,
          COUNT(*) AS cnt
        FROM analytics_events
        WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
        GROUP BY referrer
      ) sub
      GROUP BY referrer_host
      ORDER BY visits DESC
      LIMIT 10
    `,
    [fromIso, toExclusiveIso]
  );

  const scrollDepthResult = await pool.query(
    `
      SELECT
        (metadata->>'threshold')::int AS threshold,
        COUNT(*) AS hits
      FROM analytics_events
      WHERE event_type = 'scroll_depth' AND created_at >= $1 AND created_at < $2
        AND metadata->>'threshold' IS NOT NULL
      GROUP BY threshold
      ORDER BY threshold ASC
    `,
    [fromIso, toExclusiveIso]
  );

  const dwellTimeResult = await pool.query(
    `
      SELECT
        ROUND(AVG((metadata->>'dwell_seconds')::numeric)) AS avg_dwell,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (metadata->>'dwell_seconds')::numeric)) AS median_dwell,
        COUNT(*) AS exits
      FROM analytics_events
      WHERE event_type = 'page_exit' AND created_at >= $1 AND created_at < $2
        AND metadata->>'dwell_seconds' IS NOT NULL
    `,
    [fromIso, toExclusiveIso]
  );

  const deviceCategoryResult = await pool.query(
    `
      SELECT
        COALESCE(metadata->>'device_type', metadata->>'device_category', 'unknown') AS category,
        COUNT(*) AS events,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
      GROUP BY category
      ORDER BY visitors DESC
    `,
    [fromIso, toExclusiveIso]
  );

  const row = rangeResult.rows[0] ?? {};
  return NextResponse.json({
    range: {
      from: from.toISOString(),
      to: toInclusive.toISOString(),
      toExclusive: toExclusiveIso,
    },
    totals: {
      visitors: Number(row.visitors ?? 0),
      pageviews: Number(row.pageviews ?? 0),
      menuClicks: Number(row.menu_clicks ?? 0),
    },
    daily: dailyResult.rows.map(
      (entry: { day: string; pageviews: string | number | null; unique_visitors: string | number | null; menu_clicks: string | number | null }) => ({
      day: entry.day,
      pageviews: Number(entry.pageviews ?? 0),
      uniqueVisitors: Number(entry.unique_visitors ?? 0),
      menuClicks: Number(entry.menu_clicks ?? 0),
      })
    ),
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
    topPaths: topPathsResult.rows.map((entry: { path: string; views: string | number | null }) => ({
      path: entry.path,
      views: Number(entry.views ?? 0),
    })),
    topReferrers: topReferrersResult.rows.map((entry: { referrer: string; visits: string | number | null }) => ({
      referrer: entry.referrer,
      visits: Number(entry.visits ?? 0),
    })),
    scrollDepth: scrollDepthResult.rows.map((entry: { threshold: number; hits: string | number | null }) => ({
      threshold: Number(entry.threshold),
      hits: Number(entry.hits ?? 0),
    })),
    dwellTime: {
      avgSeconds: Number(dwellTimeResult.rows[0]?.avg_dwell ?? 0),
      medianSeconds: Number(dwellTimeResult.rows[0]?.median_dwell ?? 0),
      totalExits: Number(dwellTimeResult.rows[0]?.exits ?? 0),
    },
    deviceCategories: deviceCategoryResult.rows.map((entry: { category: string; events: string | number | null; visitors: string | number | null }) => ({
      category: entry.category,
      events: Number(entry.events ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
  });
}
