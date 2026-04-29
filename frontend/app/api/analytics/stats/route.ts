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

function ratio(value: number, total: number, precision = 2) {
  if (total <= 0) return 0;
  const factor = 10 ** precision;
  return Math.round((value / total) * factor) / factor;
}

function percent(value: number, total: number) {
  return Math.round(ratio(value, total, 3) * 1000) / 10;
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
  const [
    rangeResult,
    retentionResult,
    dailyResult,
    sectionViewsResult,
    menuResult,
    topPathsResult,
    topReferrersResult,
    scrollDepthResult,
    dwellTimeResult,
    deviceCategoryResult,
    eventTypesResult,
    topInteractionsResult,
  ] = await Promise.all([
    pool.query(
    `
      SELECT
        COUNT(DISTINCT COALESCE(session_id::text, ip)) FILTER (WHERE event_type = 'pageview') AS visitors,
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks,
        COUNT(*) FILTER (WHERE event_type = 'content_click') AS content_clicks,
        COUNT(*) FILTER (WHERE event_type = 'section_view') AS section_views,
        COUNT(*) FILTER (WHERE event_type = 'scroll_depth') AS scroll_depth_hits,
        COUNT(*) FILTER (WHERE event_type = 'page_exit') AS page_exits,
        COUNT(*) AS total_events
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      WITH range_visitors AS (
        SELECT
          COALESCE(session_id::text, ip) AS visitor_key,
          MIN(created_at) AS first_in_range
        FROM analytics_events
        WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
        GROUP BY visitor_key
      )
      SELECT
        COUNT(*) AS visitors,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1
            FROM analytics_events previous
            WHERE previous.event_type = 'pageview'
              AND COALESCE(previous.session_id::text, previous.ip) = range_visitors.visitor_key
              AND previous.created_at < range_visitors.first_in_range
              AND previous.created_at >= ($1::timestamptz - interval '30 days')
          )
        ) AS returning_visitors
      FROM range_visitors
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      WITH days AS (
        SELECT generate_series(
          $1::timestamptz,
          ($2::timestamptz - interval '1 day'),
          interval '1 day'
        ) AS day
      ),
      daily_events AS (
        SELECT
          date_trunc('day', created_at) AS day,
          COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
          COUNT(DISTINCT COALESCE(session_id::text, ip)) FILTER (WHERE event_type = 'pageview') AS unique_visitors,
          COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks,
          COUNT(*) FILTER (WHERE event_type = 'content_click') AS content_clicks,
          COUNT(*) FILTER (WHERE event_type = 'section_view') AS section_views,
          COUNT(*) FILTER (WHERE event_type = 'page_exit') AS page_exits
        FROM analytics_events
        WHERE created_at >= $1 AND created_at < $2
        GROUP BY day
      )
      SELECT
        days.day,
        COALESCE(daily_events.pageviews, 0) AS pageviews,
        COALESCE(daily_events.unique_visitors, 0) AS unique_visitors,
        COALESCE(daily_events.menu_clicks, 0) AS menu_clicks,
        COALESCE(daily_events.content_clicks, 0) AS content_clicks,
        COALESCE(daily_events.section_views, 0) AS section_views,
        COALESCE(daily_events.page_exits, 0) AS page_exits
      FROM days
      LEFT JOIN daily_events ON daily_events.day = days.day
      ORDER BY days.day ASC
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        COALESCE(element_id, '(unknown)') AS element_id,
        element_label,
        COUNT(*) AS views,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type = 'section_view' AND created_at >= $1 AND created_at < $2
      GROUP BY element_id, element_label
      ORDER BY views DESC
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        COALESCE(element_id, '(unknown)') AS element_id,
        element_label,
        COALESCE(element_type, 'link') AS element_type,
        COALESCE(metadata->>'location', 'unknown') AS location,
        COUNT(*) AS clicks,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type = 'menu_click' AND created_at >= $1 AND created_at < $2
      GROUP BY element_id, element_label, element_type, location
      ORDER BY clicks DESC
      LIMIT 10
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        COALESCE(path, '(unknown)') AS path,
        COUNT(*) AS views,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT referrer_host AS referrer, SUM(cnt) AS visits, SUM(visitor_count) AS visitors
      FROM (
        SELECT
          CASE
            WHEN referrer IS NULL OR referrer = '' THEN '(direct)'
            WHEN referrer NOT LIKE '%://%' THEN '(direct)'
            WHEN referrer LIKE 'android-app://%'
              THEN 'android-app://' || split_part(split_part(referrer, '://', 2), '/', 1)
            ELSE COALESCE(NULLIF(split_part(split_part(referrer, '://', 2), '/', 1), ''), '(direct)')
          END AS referrer_host,
          COUNT(*) AS cnt,
          COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitor_count
        FROM analytics_events
        WHERE event_type = 'pageview' AND created_at >= $1 AND created_at < $2
        GROUP BY referrer
      ) sub
      GROUP BY referrer_host
      ORDER BY visits DESC
      LIMIT 10
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        (metadata->>'threshold')::int AS threshold,
        COUNT(*) AS hits,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type = 'scroll_depth' AND created_at >= $1 AND created_at < $2
        AND metadata->>'threshold' IS NOT NULL
        AND metadata->>'threshold' ~ '^[0-9]+$'
      GROUP BY threshold
      ORDER BY threshold ASC
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      WITH exits AS (
        SELECT
          (metadata->>'dwell_seconds')::numeric AS dwell_seconds,
          CASE
            WHEN metadata->>'max_scroll_depth' ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (metadata->>'max_scroll_depth')::numeric
            ELSE NULL
          END AS max_scroll_depth
        FROM analytics_events
        WHERE event_type = 'page_exit' AND created_at >= $1 AND created_at < $2
          AND metadata->>'dwell_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
      )
      SELECT
        ROUND(AVG(dwell_seconds)) AS avg_dwell,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dwell_seconds)) AS median_dwell,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dwell_seconds)) AS p75_dwell,
        ROUND(AVG(max_scroll_depth)) AS avg_exit_scroll_depth,
        COUNT(*) AS exits,
        COUNT(*) FILTER (WHERE dwell_seconds <= 10 AND COALESCE(max_scroll_depth, 0) < 25) AS quick_exits
      FROM exits
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        COALESCE(metadata->>'device_type', metadata->>'device_category', 'unknown') AS category,
        COUNT(*) AS events,
        COUNT(*) FILTER (WHERE event_type = 'pageview') AS pageviews,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) FILTER (WHERE event_type = 'pageview') AS visitors,
        COUNT(*) FILTER (WHERE event_type = 'menu_click') AS menu_clicks
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY category
      ORDER BY visitors DESC, events DESC
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        event_type,
        COUNT(*) AS events,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY event_type
      ORDER BY events DESC
    `,
    [fromIso, toExclusiveIso]
  ),

    pool.query(
    `
      SELECT
        event_type,
        COALESCE(element_type, 'unknown') AS element_type,
        COALESCE(element_id, '(unknown)') AS element_id,
        element_label,
        COALESCE(metadata->>'location', 'unknown') AS location,
        COUNT(*) AS events,
        COUNT(DISTINCT COALESCE(session_id::text, ip)) AS visitors
      FROM analytics_events
      WHERE event_type IN ('menu_click', 'content_click') AND created_at >= $1 AND created_at < $2
      GROUP BY event_type, element_type, element_id, element_label, location
      ORDER BY events DESC
      LIMIT 12
    `,
    [fromIso, toExclusiveIso]
  ),
  ]);

  const row = rangeResult.rows[0] ?? {};
  const retentionRow = retentionResult.rows[0] ?? {};
  const dwellRow = dwellTimeResult.rows[0] ?? {};
  const totals = {
    visitors: Number(row.visitors ?? 0),
    returningVisitors: Number(retentionRow.returning_visitors ?? 0),
    newVisitors: Math.max(0, Number(row.visitors ?? 0) - Number(retentionRow.returning_visitors ?? 0)),
    pageviews: Number(row.pageviews ?? 0),
    menuClicks: Number(row.menu_clicks ?? 0),
    contentClicks: Number(row.content_clicks ?? 0),
    sectionViews: Number(row.section_views ?? 0),
    scrollDepthHits: Number(row.scroll_depth_hits ?? 0),
    pageExits: Number(row.page_exits ?? 0),
    totalEvents: Number(row.total_events ?? 0),
  };
  const deepScrollVisitors = scrollDepthResult.rows
    .filter((entry: { threshold: number }) => Number(entry.threshold) >= 75)
    .reduce((max: number, entry: { visitors: string | number | null }) => Math.max(max, Number(entry.visitors ?? 0)), 0);
  const quickExits = Number(dwellRow.quick_exits ?? 0);

  return NextResponse.json({
    range: {
      from: from.toISOString(),
      to: toInclusive.toISOString(),
      toExclusive: toExclusiveIso,
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
      quickExitRate: percent(quickExits, Number(dwellRow.exits ?? 0)),
    },
    daily: dailyResult.rows.map(
      (entry: {
        day: string;
        pageviews: string | number | null;
        unique_visitors: string | number | null;
        menu_clicks: string | number | null;
        content_clicks: string | number | null;
        section_views: string | number | null;
        page_exits: string | number | null;
      }) => ({
      day: entry.day,
      pageviews: Number(entry.pageviews ?? 0),
      uniqueVisitors: Number(entry.unique_visitors ?? 0),
      menuClicks: Number(entry.menu_clicks ?? 0),
      contentClicks: Number(entry.content_clicks ?? 0),
      sectionViews: Number(entry.section_views ?? 0),
      pageExits: Number(entry.page_exits ?? 0),
      })
    ),
    topMenuClicks: menuResult.rows.map((entry: {
      element_id: string;
      element_label: string | null;
      element_type: string | null;
      location: string | null;
      clicks: string | number | null;
      visitors: string | number | null;
    }) => ({
      elementId: entry.element_id,
      label: entry.element_label,
      elementType: entry.element_type,
      location: entry.location,
      clicks: Number(entry.clicks ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    sectionViews: sectionViewsResult.rows.map((entry: { element_id: string; element_label: string | null; views: string | number | null; visitors: string | number | null }) => ({
      sectionId: entry.element_id,
      label: entry.element_label,
      views: Number(entry.views ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    topPaths: topPathsResult.rows.map((entry: { path: string; views: string | number | null; visitors: string | number | null }) => ({
      path: entry.path,
      views: Number(entry.views ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    topReferrers: topReferrersResult.rows.map((entry: { referrer: string; visits: string | number | null; visitors: string | number | null }) => ({
      referrer: entry.referrer,
      visits: Number(entry.visits ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    scrollDepth: scrollDepthResult.rows.map((entry: { threshold: number; hits: string | number | null; visitors: string | number | null }) => ({
      threshold: Number(entry.threshold),
      hits: Number(entry.hits ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    dwellTime: {
      avgSeconds: Number(dwellRow.avg_dwell ?? 0),
      medianSeconds: Number(dwellRow.median_dwell ?? 0),
      p75Seconds: Number(dwellRow.p75_dwell ?? 0),
      avgExitScrollDepth: Number(dwellRow.avg_exit_scroll_depth ?? 0),
      totalExits: Number(dwellRow.exits ?? 0),
      quickExits,
    },
    deviceCategories: deviceCategoryResult.rows.map((entry: {
      category: string;
      events: string | number | null;
      pageviews: string | number | null;
      visitors: string | number | null;
      menu_clicks: string | number | null;
    }) => ({
      category: entry.category,
      events: Number(entry.events ?? 0),
      pageviews: Number(entry.pageviews ?? 0),
      visitors: Number(entry.visitors ?? 0),
      menuClicks: Number(entry.menu_clicks ?? 0),
      clickThroughRate: percent(Number(entry.menu_clicks ?? 0), Number(entry.pageviews ?? 0)),
    })),
    eventTypes: eventTypesResult.rows.map((entry: { event_type: string; events: string | number | null; visitors: string | number | null }) => ({
      eventType: entry.event_type,
      events: Number(entry.events ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
    topInteractions: topInteractionsResult.rows.map((entry: {
      event_type: string;
      element_type: string | null;
      element_id: string;
      element_label: string | null;
      location: string | null;
      events: string | number | null;
      visitors: string | number | null;
    }) => ({
      eventType: entry.event_type,
      elementType: entry.element_type,
      elementId: entry.element_id,
      label: entry.element_label,
      location: entry.location,
      events: Number(entry.events ?? 0),
      visitors: Number(entry.visitors ?? 0),
    })),
  });
}
