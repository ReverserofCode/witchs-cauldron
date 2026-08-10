#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.SNAP_BASE_URL || 'http://127.0.0.1:3000';
const outDir = process.env.SNAP_OUT_DIR || path.resolve(process.cwd(), 'playwright-snapshots');
const ts = new Date().toISOString().replace(/[:.]/g, '-');

const targets = [
  { name: 'home-desktop', url: '/', width: 1440, height: 900 },
  { name: 'home-tablet', url: '/', width: 1024, height: 1366 },
  { name: 'home-mobile', url: '/', width: 390, height: 844 },
  { name: 'analytics-desktop', url: '/admin/analytics', width: 1440, height: 900 },
];

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const adminUsername = process.env.SNAP_ADMIN_USERNAME || process.env.ADMIN_BASIC_AUTH_USERNAME;
  const adminPassword = process.env.SNAP_ADMIN_PASSWORD || process.env.ADMIN_BASIC_AUTH_PASSWORD;

  for (const t of targets) {
    const context = await browser.newContext({
      viewport: { width: t.width, height: t.height },
      ...(adminUsername && adminPassword
        ? { httpCredentials: { username: adminUsername, password: adminPassword } }
        : {}),
    });

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
      await page.goto(full, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForTimeout(500);

      const file = path.join(outDir, `${ts}-${t.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(file);
      await page.close();
    } finally {
      await context.close();
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error('[capture-screenshots] failed:', e.message);
  process.exit(1);
});
