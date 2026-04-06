#!/usr/bin/env node
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const username = process.env.ADMIN_BASIC_AUTH_USERNAME || 'admin';
const password = process.env.ADMIN_BASIC_AUTH_PASSWORD || 'dev-password';

function analyticsFixture(from, to) {
  return {
    range: {
      from: `${from}T00:00:00.000Z`,
      to: `${to}T00:00:00.000Z`,
      toExclusive: `${to}T23:59:59.999Z`,
    },
    totals: {
      visitors: 128,
      pageviews: 364,
      menuClicks: 92,
    },
    daily: [
      { day: from, uniqueVisitors: 44, pageviews: 118, menuClicks: 28 },
      { day: to, uniqueVisitors: 84, pageviews: 246, menuClicks: 64 },
    ],
    topMenuClicks: [
      { elementId: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ', label: '유튜브', clicks: 28 },
      { elementId: '#schedule-section', label: '방송 일정', clicks: 19 },
    ],
    sectionViews: [
      { sectionId: 'featured-videos', label: '주요 영상', views: 71 },
      { sectionId: 'schedule-section', label: '방송 일정', views: 58 },
    ],
    topPaths: [
      { path: '/', views: 364 },
      { path: '/clips', views: 57 },
    ],
    topReferrers: [
      { referrer: '(direct)', visits: 74 },
      { referrer: 'cafe.naver.com', visits: 21 },
    ],
    scrollDepth: [
      { threshold: 25, hits: 110 },
      { threshold: 50, hits: 78 },
      { threshold: 75, hits: 41 },
      { threshold: 100, hits: 16 },
    ],
    dwellTime: {
      avgSeconds: 73,
      medianSeconds: 54,
      totalExits: 49,
    },
    deviceCategories: [
      { category: 'desktop', events: 188, visitors: 68 },
      { category: 'mobile', events: 176, visitors: 60 },
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
