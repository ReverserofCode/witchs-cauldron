import { NextRequest, NextResponse } from "next/server";
import {
  ANALYTICS_SCHEMA_VERSION,
  ANALYTICS_TIME_ZONE,
  RETENTION_WINDOW_DAYS,
  parseAnalyticsDateRange,
} from "../../../lib/analytics/contract";
import { ensureSchema, getPool } from "../db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ratio(value: number, total: number, precision = 2) {
  if (total <= 0) return 0;
  const factor = 10 ** precision;
  return Math.round((value / total) * factor) / factor;
}

function percent(value: number, total: number) {
  return Math.round(ratio(value, total, 3) * 1000) / 10;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asRows<T extends Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function num(value: unknown) {
  return Number(value ?? 0);
}

const STATS_SQL = `
  WITH params AS (
    SELECT $1::date AS from_date, $2::date AS to_date, $3::int AS retention_days
  ),
  base AS (
    SELECT
      events.id,
      events.event_type,
      events.path,
      events.element_type,
      events.element_id,
      events.element_label,
      events.metadata,
      events.created_at,
      COALESCE(
        events.visitor_key,
        CASE
          WHEN events.session_id IS NOT NULL THEN 'session:' || events.session_id::text
          WHEN NULLIF(events.ip, '') IS NOT NULL THEN 'legacy-ip:' || events.ip
          ELSE 'unknown'
        END
      ) AS visitor_key,
      COALESCE(events.event_date_kst, (events.created_at AT TIME ZONE 'Asia/Seoul')::date) AS event_date_kst,
      COALESCE(
        NULLIF(events.referrer_host, ''),
        CASE
          WHEN events.referrer IS NULL OR events.referrer = '' THEN '(direct)'
          WHEN events.referrer NOT LIKE '%://%' THEN '(direct)'
          WHEN events.referrer LIKE 'android-app://%'
            THEN lower('android-app://' || split_part(split_part(events.referrer, '://', 2), '/', 1))
          ELSE lower(COALESCE(NULLIF(split_part(split_part(events.referrer, '://', 2), '/', 1), ''), '(direct)'))
        END
      ) AS referrer_host
    FROM analytics_events events, params
    WHERE COALESCE(events.event_date_kst, (events.created_at AT TIME ZONE 'Asia/Seoul')::date) >= params.from_date
      AND COALESCE(events.event_date_kst, (events.created_at AT TIME ZONE 'Asia/Seoul')::date) <= params.to_date
  ),
  range_totals AS (
    SELECT
      COUNT(DISTINCT visitor_key) FILTER (WHERE event_type = 'pageview') AS visitors,
      COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
      COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks,
      COUNT(*) FILTER (WHERE event_type = 'content_click') AS content_clicks,
      COUNT(*) FILTER (WHERE event_type = 'section_view') AS section_views,
      COUNT(*) FILTER (WHERE event_type = 'scroll_depth') AS scroll_depth_hits,
      COUNT(*) FILTER (WHERE event_type = 'page_exit') AS page_exits,
      COUNT(*) AS total_events
    FROM base
  ),
  range_visitors AS (
    SELECT visitor_key, MIN(created_at) AS first_in_range
    FROM base
    WHERE event_type = 'pageview'
    GROUP BY visitor_key
  ),
  retention AS (
    SELECT
      COUNT(*) AS visitors,
      COUNT(*) FILTER (
        WHERE EXISTS (
          SELECT 1
          FROM analytics_events previous, params
          WHERE previous.event_type = 'pageview'
            AND COALESCE(
              previous.visitor_key,
              CASE
                WHEN previous.session_id IS NOT NULL THEN 'session:' || previous.session_id::text
                WHEN NULLIF(previous.ip, '') IS NOT NULL THEN 'legacy-ip:' || previous.ip
                ELSE 'unknown'
              END
            ) = range_visitors.visitor_key
            AND previous.created_at < range_visitors.first_in_range
            AND COALESCE(previous.event_date_kst, (previous.created_at AT TIME ZONE 'Asia/Seoul')::date)
              >= (params.from_date - (params.retention_days * interval '1 day'))::date
        )
      ) AS returning_visitors
    FROM range_visitors
  ),
  days AS (
    SELECT generate_series((SELECT from_date FROM params), (SELECT to_date FROM params), interval '1 day')::date AS day
  ),
  daily_events AS (
    SELECT
      event_date_kst AS day,
      COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
      COUNT(DISTINCT visitor_key) FILTER (WHERE event_type = 'pageview') AS unique_visitors,
      COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks,
      COUNT(*) FILTER (WHERE event_type = 'content_click') AS content_clicks,
      COUNT(*) FILTER (WHERE event_type = 'section_view') AS section_views,
      COUNT(*) FILTER (WHERE event_type = 'page_exit') AS page_exits
    FROM base
    GROUP BY event_date_kst
  ),
  daily_rows AS (
    SELECT
      days.day::text AS day,
      COALESCE(daily_events.pageviews, 0) AS pageviews,
      COALESCE(daily_events.unique_visitors, 0) AS unique_visitors,
      COALESCE(daily_events.menu_clicks, 0) AS menu_clicks,
      COALESCE(daily_events.content_clicks, 0) AS content_clicks,
      COALESCE(daily_events.section_views, 0) AS section_views,
      COALESCE(daily_events.page_exits, 0) AS page_exits
    FROM days
    LEFT JOIN daily_events ON daily_events.day = days.day
    ORDER BY days.day ASC
  ),
  section_view_rows AS (
    SELECT
      COALESCE(element_id, '(unknown)') AS element_id,
      element_label,
      COUNT(*) AS views,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type = 'section_view'
    GROUP BY element_id, element_label
    ORDER BY views DESC
  ),
  menu_rows AS (
    SELECT
      COALESCE(element_id, '(unknown)') AS element_id,
      element_label,
      COALESCE(element_type, 'link') AS element_type,
      COALESCE(metadata->>'location', 'unknown') AS location,
      COUNT(*) AS clicks,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type = 'menu_click'
    GROUP BY element_id, element_label, element_type, location
    ORDER BY clicks DESC
    LIMIT 10
  ),
  path_rows AS (
    SELECT
      COALESCE(path, '(unknown)') AS path,
      COUNT(*) AS views,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type = 'pageview'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 10
  ),
  referrer_rows AS (
    SELECT
      referrer_host AS referrer,
      COUNT(*) AS visits,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type = 'pageview'
    GROUP BY referrer_host
    ORDER BY visits DESC
    LIMIT 10
  ),
  scroll_rows AS (
    SELECT
      (metadata->>'threshold')::int AS threshold,
      COUNT(*) AS hits,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type = 'scroll_depth'
      AND metadata->>'threshold' IS NOT NULL
      AND metadata->>'threshold' ~ '^[0-9]+$'
    GROUP BY threshold
    ORDER BY threshold ASC
  ),
  exits AS (
    SELECT
      (metadata->>'dwell_seconds')::numeric AS dwell_seconds,
      CASE
        WHEN metadata->>'max_scroll_depth' ~ '^[0-9]+(\\.[0-9]+)?$'
          THEN (metadata->>'max_scroll_depth')::numeric
        ELSE NULL
      END AS max_scroll_depth
    FROM base
    WHERE event_type = 'page_exit'
      AND metadata->>'dwell_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
  ),
  dwell_time AS (
    SELECT
      ROUND(AVG(dwell_seconds)) AS avg_dwell,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dwell_seconds)) AS median_dwell,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dwell_seconds)) AS p75_dwell,
      ROUND(AVG(max_scroll_depth)) AS avg_exit_scroll_depth,
      COUNT(*) AS exits,
      COUNT(*) FILTER (WHERE dwell_seconds <= 10 AND COALESCE(max_scroll_depth, 0) < 25) AS quick_exits
    FROM exits
  ),
  device_rows AS (
    SELECT
      COALESCE(metadata->>'device_type', metadata->>'device_category', 'unknown') AS category,
      COUNT(*) AS events,
      COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
      COUNT(DISTINCT visitor_key) FILTER (WHERE event_type = 'pageview') AS visitors,
      COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks
    FROM base
    GROUP BY category
    ORDER BY visitors DESC, events DESC
  ),
  event_type_rows AS (
    SELECT
      event_type,
      COUNT(*) AS events,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    GROUP BY event_type
    ORDER BY events DESC
  ),
  interaction_rows AS (
    SELECT
      event_type,
      COALESCE(element_type, 'unknown') AS element_type,
      COALESCE(element_id, '(unknown)') AS element_id,
      element_label,
      COALESCE(metadata->>'location', 'unknown') AS location,
      COUNT(*) AS events,
      COUNT(DISTINCT visitor_key) AS visitors
    FROM base
    WHERE event_type IN ('menu_click', 'content_click')
    GROUP BY event_type, element_type, element_id, element_label, location
    ORDER BY events DESC
    LIMIT 12
  )
  SELECT
    (SELECT row_to_json(range_totals) FROM range_totals) AS totals,
    (SELECT row_to_json(retention) FROM retention) AS retention,
    COALESCE((SELECT json_agg(row_to_json(daily_rows)) FROM daily_rows), '[]'::json) AS daily,
    COALESCE((SELECT json_agg(row_to_json(section_view_rows)) FROM section_view_rows), '[]'::json) AS section_views,
    COALESCE((SELECT json_agg(row_to_json(menu_rows)) FROM menu_rows), '[]'::json) AS top_menu_clicks,
    COALESCE((SELECT json_agg(row_to_json(path_rows)) FROM path_rows), '[]'::json) AS top_paths,
    COALESCE((SELECT json_agg(row_to_json(referrer_rows)) FROM referrer_rows), '[]'::json) AS top_referrers,
    COALESCE((SELECT json_agg(row_to_json(scroll_rows)) FROM scroll_rows), '[]'::json) AS scroll_depth,
    (SELECT row_to_json(dwell_time) FROM dwell_time) AS dwell_time,
    COALESCE((SELECT json_agg(row_to_json(device_rows)) FROM device_rows), '[]'::json) AS device_categories,
    COALESCE((SELECT json_agg(row_to_json(event_type_rows)) FROM event_type_rows), '[]'::json) AS event_types,
    COALESCE((SELECT json_agg(row_to_json(interaction_rows)) FROM interaction_rows), '[]'::json) AS top_interactions
`;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const range = parseAnalyticsDateRange({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  if (!range.ok) {
    return NextResponse.json(
      { error: range.error, maxRangeDays: range.maxRangeDays },
      { status: range.status }
    );
  }

  await ensureSchema();
  const pool = await getPool();
  const statsResult = await pool.query(STATS_SQL, [range.from, range.to, RETENTION_WINDOW_DAYS]);
  const statsRow = statsResult.rows[0] ?? {};
  const totalsRow = asRecord(statsRow.totals);
  const retentionRow = asRecord(statsRow.retention);
  const dwellRow = asRecord(statsRow.dwell_time);

  const totals = {
    visitors: num(totalsRow.visitors),
    returningVisitors: num(retentionRow.returning_visitors),
    newVisitors: Math.max(0, num(totalsRow.visitors) - num(retentionRow.returning_visitors)),
    pageviews: num(totalsRow.pageviews),
    menuClicks: num(totalsRow.menu_clicks),
    contentClicks: num(totalsRow.content_clicks),
    sectionViews: num(totalsRow.section_views),
    scrollDepthHits: num(totalsRow.scroll_depth_hits),
    pageExits: num(totalsRow.page_exits),
    totalEvents: num(totalsRow.total_events),
  };
  const scrollDepthRows = asRows(statsRow.scroll_depth);
  const deepScrollVisitors = scrollDepthRows
    .filter((entry) => num(entry.threshold) >= 75)
    .reduce((max, entry) => Math.max(max, num(entry.visitors)), 0);
  const quickExits = num(dwellRow.quick_exits);

  return NextResponse.json({
    range: {
      from: range.from,
      to: range.to,
      toExclusive: range.toExclusiveUtcIso,
      timeZone: ANALYTICS_TIME_ZONE,
      maxRangeDays: range.maxRangeDays,
    },
    meta: {
      visitorBasis: "visitor_key",
      retentionWindowDays: RETENTION_WINDOW_DAYS,
      generatedAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
    },
    totals,
    metrics: {
      pagesPerVisitor: ratio(totals.pageviews, totals.visitors),
      clickThroughRate: percent(totals.menuClicks + totals.contentClicks, totals.pageviews),
      menuClickRate: percent(totals.menuClicks, totals.pageviews),
      returningVisitorRate: percent(totals.returningVisitors, totals.visitors),
      sectionViewsPerVisitor: ratio(totals.sectionViews, totals.visitors),
      deepScrollRate: percent(deepScrollVisitors, totals.visitors),
      exitRate: percent(totals.pageExits, totals.pageviews),
      quickExitRate: percent(quickExits, num(dwellRow.exits)),
    },
    daily: asRows(statsRow.daily).map((entry) => ({
      day: String(entry.day),
      pageviews: num(entry.pageviews),
      uniqueVisitors: num(entry.unique_visitors),
      menuClicks: num(entry.menu_clicks),
      contentClicks: num(entry.content_clicks),
      sectionViews: num(entry.section_views),
      pageExits: num(entry.page_exits),
    })),
    topMenuClicks: asRows(statsRow.top_menu_clicks).map((entry) => ({
      elementId: String(entry.element_id),
      label: entry.element_label,
      elementType: entry.element_type,
      location: entry.location,
      clicks: num(entry.clicks),
      visitors: num(entry.visitors),
    })),
    sectionViews: asRows(statsRow.section_views).map((entry) => ({
      sectionId: String(entry.element_id),
      label: entry.element_label,
      views: num(entry.views),
      visitors: num(entry.visitors),
    })),
    topPaths: asRows(statsRow.top_paths).map((entry) => ({
      path: String(entry.path),
      views: num(entry.views),
      visitors: num(entry.visitors),
    })),
    topReferrers: asRows(statsRow.top_referrers).map((entry) => ({
      referrer: String(entry.referrer),
      visits: num(entry.visits),
      visitors: num(entry.visitors),
    })),
    scrollDepth: scrollDepthRows.map((entry) => ({
      threshold: num(entry.threshold),
      hits: num(entry.hits),
      visitors: num(entry.visitors),
    })),
    dwellTime: {
      avgSeconds: num(dwellRow.avg_dwell),
      medianSeconds: num(dwellRow.median_dwell),
      p75Seconds: num(dwellRow.p75_dwell),
      avgExitScrollDepth: num(dwellRow.avg_exit_scroll_depth),
      totalExits: num(dwellRow.exits),
      quickExits,
    },
    deviceCategories: asRows(statsRow.device_categories).map((entry) => ({
      category: String(entry.category),
      events: num(entry.events),
      pageviews: num(entry.pageviews),
      visitors: num(entry.visitors),
      menuClicks: num(entry.menu_clicks),
      clickThroughRate: percent(num(entry.menu_clicks), num(entry.pageviews)),
    })),
    eventTypes: asRows(statsRow.event_types).map((entry) => ({
      eventType: String(entry.event_type),
      events: num(entry.events),
      visitors: num(entry.visitors),
    })),
    topInteractions: asRows(statsRow.top_interactions).map((entry) => ({
      eventType: String(entry.event_type),
      elementType: entry.element_type,
      elementId: String(entry.element_id),
      label: entry.element_label,
      location: entry.location,
      events: num(entry.events),
      visitors: num(entry.visitors),
    })),
  });
}
