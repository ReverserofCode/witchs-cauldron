import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright';
import { blockAnalyticsWrites, verifyAnalyticsInterception } from './smoke-analytics-guard.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3165');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'entry smoke is loopback only');
async function manifest(relativePath) {
  const context = {};
  vm.runInNewContext(await readFile(path.join(root, '.next/server/app', relativePath), 'utf8'), context, { timeout: 1000 });
  return Object.values(context.__RSC_MANIFEST)[0];
}
const home = await manifest('page_client-reference-manifest.js');
const game = await manifest('games/potion-timing/page_client-reference-manifest.js');
const isGame = key => key.endsWith('/games/potion-timing/PotionTimingGame.tsx');
assert.equal(Object.keys(home.clientModules).some(isGame), false, 'home must not import the game client component');
const gameModule = Object.entries(game.clientModules).find(([key]) => isGame(key))?.[1];
assert.ok(gameModule, 'production manifest must contain the game component');
const homeChunks = new Set(Object.values(home.clientModules).flatMap(module => module.chunks));
const gameOnlyChunks = new Set(gameModule.chunks.filter(chunk => !homeChunks.has(chunk)));
assert.ok(gameOnlyChunks.size > 0, 'game must have a route-specific client bundle');

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: {width, height:844} });
    await blockAnalyticsWrites(context);
    const requests = [];
    context.on('request', request => requests.push(new URL(request.url()).pathname));
    const page = await context.newPage();
    assert.equal((await page.goto(base.href, {waitUntil:'domcontentloaded'})).status(), 200);
    await verifyAnalyticsInterception(page);
    const card = page.locator('main a[href="/games/potion-timing"]');
    await card.waitFor({state:'visible'});
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(500);
    assert.equal(requests.some(url => gameOnlyChunks.has(url)), false, 'hover/viewport must not prefetch game chunks');
    assert.equal(requests.some(url => url.startsWith('/api/games/') || url === '/games/potion-timing'), false,
      'home must not fetch daily API or game RSC before explicit navigation');
    if (width === 390) {
      await page.getByRole('button', {name:'메뉴 열기', exact:true}).click();
      await page.locator('#mobile-community-menu a[href="/games/potion-timing"]').click();
      await page.getByRole('button', {name:'메뉴 열기', exact:true}).waitFor({state:'visible'});
    } else {
      await card.click();
    }
    await page.getByRole('heading', {name:'포션 불조절', exact:true}).waitFor();
    await page.waitForURL(url => url.pathname === '/games/potion-timing');
    assert.equal(requests.some(url => gameOnlyChunks.has(url)), true, 'explicit navigation must load the game bundle');
    await page.goBack();
    assert.equal(new URL(page.url()).pathname, '/', `back navigation must restore home at ${width}px`);
    await card.waitFor({state:'visible'});
    assert.equal((await page.goto(new URL('/broadcasts',base).href)).status(), 200);
    await context.close();
  }
  console.log(`potion entry smoke ok: desktop/mobile, ${gameOnlyChunks.size} route-only bundle(s), no home prefetch, navigation/back/broadcasts`);
} finally { await browser.close(); }
