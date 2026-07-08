#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const username = process.env.ADMIN_BASIC_AUTH_USERNAME || 'admin';
const password = process.env.ADMIN_BASIC_AUTH_PASSWORD || 'dev-password';

function analyticsFixture(from, to) {
  return {
    range: {
      from,
      to,
      toExclusive: `${to}T15:00:00.000Z`,
      timeZone: 'Asia/Seoul',
      maxRangeDays: 366,
    },
    meta: {
      visitorBasis: 'visitor_key',
      retentionWindowDays: 30,
      generatedAt: new Date().toISOString(),
      schemaVersion: 2,
    },
    totals: {
      visitors: 128,
      returningVisitors: 37,
      newVisitors: 91,
      pageviews: 364,
      menuClicks: 92,
      contentClicks: 11,
      sectionViews: 129,
      scrollDepthHits: 245,
      pageExits: 49,
      totalEvents: 850,
    },
    metrics: {
      pagesPerVisitor: 2.84,
      clickThroughRate: 28.3,
      menuClickRate: 25.3,
      returningVisitorRate: 28.9,
      sectionViewsPerVisitor: 1.01,
      deepScrollRate: 32,
      exitRate: 13.5,
      quickExitRate: 8.2,
    },
    daily: [
      { day: from, uniqueVisitors: 44, pageviews: 118, menuClicks: 28, contentClicks: 4, sectionViews: 52, pageExits: 18 },
      { day: to, uniqueVisitors: 84, pageviews: 246, menuClicks: 64, contentClicks: 7, sectionViews: 77, pageExits: 31 },
    ],
    topMenuClicks: [
      { elementId: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ', label: '유튜브', clicks: 28, visitors: 22, elementType: 'quick_link', location: 'hero_quick_links' },
      { elementId: '#schedule-section', label: '방송 일정', clicks: 19, visitors: 17, elementType: 'toc_link', location: 'left_sidebar_toc' },
    ],
    sectionViews: [
      { sectionId: 'featured-videos', label: '주요 영상', views: 71, visitors: 68 },
      { sectionId: 'schedule-section', label: '방송 일정', views: 58, visitors: 51 },
    ],
    topPaths: [
      { path: '/', views: 364, visitors: 128 },
      { path: '/clips', views: 57, visitors: 31 },
    ],
    topReferrers: [
      { referrer: '(direct)', visits: 74, visitors: 70 },
      { referrer: 'cafe.naver.com', visits: 21, visitors: 20 },
    ],
    scrollDepth: [
      { threshold: 25, hits: 110, visitors: 96 },
      { threshold: 50, hits: 78, visitors: 66 },
      { threshold: 75, hits: 41, visitors: 38 },
      { threshold: 100, hits: 16, visitors: 12 },
    ],
    dwellTime: {
      avgSeconds: 73,
      medianSeconds: 54,
      p75Seconds: 96,
      avgExitScrollDepth: 58,
      totalExits: 49,
      quickExits: 4,
    },
    deviceCategories: [
      { category: 'desktop', events: 410, pageviews: 188, visitors: 68, menuClicks: 52, clickThroughRate: 27.7 },
      { category: 'mobile', events: 440, pageviews: 176, visitors: 60, menuClicks: 40, clickThroughRate: 22.7 },
    ],
    eventTypes: [
      { eventType: 'pageview', events: 364, visitors: 128 },
      { eventType: 'scroll_depth', events: 245, visitors: 96 },
      { eventType: 'section_view', events: 129, visitors: 89 },
      { eventType: 'menu_click', events: 92, visitors: 62 },
      { eventType: 'page_exit', events: 49, visitors: 49 },
    ],
    topInteractions: [
      { eventType: 'menu_click', elementType: 'quick_link', elementId: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ', label: '유튜브', location: 'hero_quick_links', events: 28, visitors: 22 },
      { eventType: 'menu_click', elementType: 'toc_link', elementId: '#schedule-section', label: '방송 일정', location: 'left_sidebar_toc', events: 19, visitors: 17 },
    ],
  };
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });

  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await publicPage.locator('body').waitFor();

  await assert.rejects(
    () => publicPage.getByRole('link', { name: '분석 대시보드' }).waitFor({ state: 'visible', timeout: 1200 }),
    /Timeout/i,
    'public home should not expose the analytics dashboard link'
  );

  const adminContext = await browser.newContext({
    httpCredentials: { username, password },
  });
  const adminPage = await adminContext.newPage();
  const requests = [];

  await adminPage.route('**/api/analytics/stats**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.toString());
    const from = url.searchParams.get('from') || '2026-04-01';
    const to = url.searchParams.get('to') || '2026-04-07';
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(analyticsFixture(from, to)),
    });
  });

  await adminPage.goto(new URL('/admin/analytics', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await adminPage.getByRole('heading', { name: 'Analytics Dashboard' }).waitFor();
  await adminPage.locator('p', { hasText: /^방문자$/ }).first().waitFor();
  await adminPage.getByRole('button', { name: '14일' }).click();
  await adminPage.getByRole('button', { name: '오늘' }).click();
  await adminPage.getByRole('button', { name: '새로고침' }).click();

  assert.ok(requests.length >= 3, `expected at least 3 analytics fetches, got ${requests.length}`);
  assert.ok(requests.some((url) => url.includes('from=') && url.includes('to=')), 'analytics requests should include date filters');

  await publicContext.close();
  await adminContext.close();
  await browser.close();

  console.log('[smoke-admin] ok');
}

main().catch((error) => {
  console.error('[smoke-admin] failed:', error);
  process.exit(1);
});
