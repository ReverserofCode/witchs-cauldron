#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.SNAP_BASE_URL || 'http://127.0.0.1:3000';
const outDir = process.env.SNAP_OUT_DIR || path.resolve(process.cwd(), 'playwright-snapshots');
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const analyticsInterceptCounts = new WeakMap();

const targets = [
  { name: 'home-desktop', url: '/', width: 1440, height: 900 },
  { name: 'home-tablet', url: '/', width: 1024, height: 1366 },
  { name: 'home-mobile', url: '/', width: 390, height: 844 },
  { name: 'analytics-desktop', url: '/admin/analytics', width: 1440, height: 900 },
];

export function resolveAdminCredentials(env = process.env) {
  const primaryUsername = env.SNAP_ADMIN_USERNAME;
  const primaryPassword = env.SNAP_ADMIN_PASSWORD;
  if (primaryUsername !== undefined || primaryPassword !== undefined) {
    if (!primaryUsername?.trim() || !primaryPassword?.trim()) {
      throw new Error(
        'SNAP_ADMIN_USERNAME and SNAP_ADMIN_PASSWORD must both be non-empty when either is set'
      );
    }
    return { username: primaryUsername, password: primaryPassword };
  }

  const fallbackUsername = env.ADMIN_BASIC_AUTH_USERNAME;
  const fallbackPassword = env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!fallbackUsername?.trim() || !fallbackPassword?.trim()) {
    throw new Error(
      'Complete non-empty SNAP_ADMIN_USERNAME/SNAP_ADMIN_PASSWORD or ADMIN_BASIC_AUTH_USERNAME/ADMIN_BASIC_AUTH_PASSWORD credentials are required'
    );
  }
  return { username: fallbackUsername, password: fallbackPassword };
}

async function createCaptureContext(browser, target, adminCredentials) {
  const context = await browser.newContext({
    viewport: { width: target.width, height: target.height },
    ...(target.url.startsWith('/admin') ? { httpCredentials: adminCredentials } : {}),
  });
  analyticsInterceptCounts.set(context, 0);
  await context.route('**/api/analytics/track', (route) => {
    analyticsInterceptCounts.set(
      context,
      (analyticsInterceptCounts.get(context) ?? 0) + 1
    );
    return route.fulfill({ status: 204, body: '' });
  });
  return context;
}

async function gotoAndAssertAnalyticsSuppressed(page, url) {
  const response = await page.goto(url, {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  const context = page.context();
  const beforeProbe = analyticsInterceptCounts.get(context);
  if (beforeProbe === undefined) {
    throw new Error('Analytics interception must be registered for the current capture context');
  }
  const probeStatus = await page.evaluate(async () => {
    const probeResponse = await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    return probeResponse.status;
  });
  if (probeStatus !== 204) {
    throw new Error(`Analytics suppression probe returned HTTP ${probeStatus}`);
  }
  if (!(analyticsInterceptCounts.get(context) > beforeProbe)) {
    throw new Error('The current capture context did not intercept the analytics probe');
  }
  return response;
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const adminCredentials = resolveAdminCredentials();

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (const t of targets) {
      const context = await createCaptureContext(browser, t, adminCredentials);

      try {
        const page = await context.newPage();
        const actualViewport = page.viewportSize();
        if (
          actualViewport?.width !== t.width ||
          actualViewport?.height !== t.height
        ) {
          throw new Error(
            `Viewport mismatch for ${t.name}: expected ${t.width}x${t.height}, got ${actualViewport?.width ?? "unknown"}x${actualViewport?.height ?? "unknown"}`
          );
        }
        const full = new URL(t.url, baseUrl).toString();
        const response = await gotoAndAssertAnalyticsSuppressed(page, full);
        if (!response?.ok()) {
          throw new Error(`${t.name} returned HTTP ${response?.status() ?? 'unknown'}`);
        }
        if (t.url.startsWith('/admin')) {
          await page.getByRole('heading', { name: 'Analytics Dashboard', exact: true }).waitFor({ state: 'visible' });
          if (await page.locator('[data-promotion-surface="banner"]').count()) {
            throw new Error('Promotion banner rendered on authenticated admin capture');
          }
        }
        await page.waitForTimeout(500);

        const file = path.join(outDir, `${ts}-${t.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(file);
        await page.close();
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((e) => {
    console.error('[capture-screenshots] failed:', e.message);
    process.exit(1);
  });
}
