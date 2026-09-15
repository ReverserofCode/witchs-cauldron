import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { blockAnalyticsWrites, verifyAnalyticsInterception } from './smoke-analytics-guard.mjs';

const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3166');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'disabled smoke is loopback only');
for (const pathname of ['/games/potion-timing', '/api/games/potion-timing/daily']) {
  assert.equal((await fetch(new URL(pathname, base))).status, 404, `${pathname} must be closed by source flag`);
}
const sitemap = await fetch(new URL('/sitemap.xml', base));
assert.equal(sitemap.status, 200);
assert.equal((await sitemap.text()).includes('/games/potion-timing'), false);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROMIUM_PATH || undefined});
try {
  const context = await browser.newContext({viewport:{width:390, height:844}});
  await blockAnalyticsWrites(context);
  const page = await context.newPage();
  await page.goto(base.href, {waitUntil:'domcontentloaded'});
  await verifyAnalyticsInterception(page);
  assert.equal(await page.locator('a[href="/games/potion-timing"]').count(), 0, 'home and desktop header must hide game');
  await page.getByRole('button', {name:'메뉴 열기', exact:true}).click();
  assert.equal(await page.locator('a[href="/games/potion-timing"]').count(), 0, 'mobile menu must hide game');
  await context.close();
  console.log('disabled-source production smoke ok: home/header/mobile/sitemap absent, page/daily 404');
} finally { await browser.close(); }
