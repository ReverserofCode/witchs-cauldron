import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// The actual client/provider run in a loopback-only React fixture. Only Next's
// pathname hook and the dormant pilot configuration are substituted.
const root = fileURLToPath(new URL('../', import.meta.url)).replaceAll('\\', '/');
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {PathContext} from 'next/navigation';
import {PotionRetentionProvider} from '/app/components/analytics/PotionRetentionProvider.tsx';
import {excludePilot} from '/app/lib/analytics/potion-client.ts';
let elapsed = 0;
Object.defineProperty(performance, 'now', {value: () => elapsed});
let visibility = 'visible';
Object.defineProperty(document, 'visibilityState', {get: () => visibility, configurable: true});
const root = createRoot(document.getElementById('root'));
const render = pathname => flushSync(() => root.render(React.createElement(PathContext.Provider,
  {value: pathname}, React.createElement(PotionRetentionProvider))));
window.fixture = {
  send(kind, runId = 'fb9a5d4f-1b9a-43c2-9f7a-464a5c5c682e') {
    window.dispatchEvent(new CustomEvent('wc:potion-activity:v1', {detail: {kind, runId, mode:'daily', rulesVersion:'potion-v1'}}));
  },
  navigate(path) { history.pushState(null, '', path); render(path); },
  visibility(value) { visibility=value; document.dispatchEvent(new Event('visibilitychange')); },
  advance(ms) { elapsed += ms; },
  activity() { document.dispatchEvent(new PointerEvent('pointerdown')); },
  exclude() { return excludePilot(localStorage); },
  unmount() { flushSync(() => root.unmount()); },
};
render(location.pathname);
window.fixture.ready = true;
`;

const vite = await createServer({
  configFile: false, root, logLevel: 'error',
  resolve: { alias: { '@': root } },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react-dom/client'] },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null },
  plugins: [{
    name: 'potion-browser-fixture', enforce: 'pre',
    resolveId(source) {
      if (source === 'virtual:potion-fixture') return '\0potion-fixture';
      if (source === 'next/navigation') return '\0potion-navigation';
      if (source.endsWith('/potion-config')) return '\0potion-config';
    },
    load(id) {
      if (id === '\0potion-fixture') return entry;
      if (id === '\0potion-navigation') return `import {createContext,useContext} from 'react';
        export const PathContext=createContext('/'); export const usePathname=()=>useContext(PathContext);`;
      if (id === '\0potion-config') return 'export const POTION_PILOT_WINDOW={enrollFromMs:0,enrollUntilMs:9999999999999,observeUntilMs:9999999999999};';
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.headers.accept?.includes('text/html')) return next();
        const html = await server.transformIndexHtml(request.url, '<!doctype html><html><body><div id="root"></div><script type="module" src="/@id/__x00__potion-fixture"></script></body></html>');
        response.setHeader('Content-Type', 'text/html');
        response.end(html);
      });
    },
  }],
});

let browser;
async function waitFor(predicate, label) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, label);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

try {
  await vite.listen();
  const address = vite.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  const now = Date.parse('2026-09-15T14:59:30Z');
  const scenarios = [];
  async function fixture(blockStorage = false) {
    const context = await browser.newContext();
    const events = [];
    const errors = [];
    let serverNow = now;
    let probes = 0;
    await context.route('**/api/analytics/**', async route => {
      if (new URL(route.request().url()).pathname === '/api/analytics/track') {
        probes++;
        return route.fulfill({ status: 204 });
      }
      events.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, serverNowMs: serverNow, expiresAtMs: now + 45 * 86400000,
        dayKst: new Date(serverNow + 9 * 3600000).toISOString().slice(0, 10),
      }) });
    });
    if (blockStorage) await context.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocked', 'SecurityError'); }});
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/fixture`);
    await page.waitForFunction(() => window.fixture?.ready);
    const probeStatus = await page.evaluate(async () => (await fetch('/api/analytics/track', {method:'POST',body:'{}'})).status);
    assert.equal(probeStatus, 204);
    assert.equal(probes, 1, 'legacy analytics interception must be installed');
    return { context, page, events, errors, setTime(value) { serverNow = value; } };
  }

  const main = await fixture();
  await main.page.evaluate(() => {
    window.fixture.activity();
    window.fixture.visibility('hidden');
    window.fixture.send('game_start');
    window.fixture.visibility('visible');
    window.fixture.navigate('/admin/analytics');
    window.fixture.send('game_start');
  });
  assert.equal(main.events.length, 0, 'plain visits, hidden, and admin must not enroll');
  assert.equal(await main.page.evaluate(() => localStorage.getItem('wc_potion_pilot_v1')), null);
  scenarios.push('nonparticipant/hidden/admin: zero events');
  await main.page.evaluate(() => {
    window.fixture.navigate('/games/potion-timing');
    window.fixture.send('game_start');
    window.fixture.send('game_start');
    window.fixture.send('game_complete');
  });
  await waitFor(() => main.events.length === 2, 'start then completion should arrive');
  assert.deepEqual(main.events.map(event => event.type), ['game_start', 'game_complete']);
  scenarios.push('duplicate start suppressed; completion chained');
  await main.page.waitForTimeout(100);
  main.setTime(now + 60000);
  await main.page.evaluate(() => window.fixture.advance(60000));
  assert.equal(main.events.length, 2, 'clock alone must not create activity');
  await main.page.evaluate(() => window.fixture.activity());
  await waitFor(() => main.events.length === 3, 'next day actual activity should arrive');
  await main.page.waitForTimeout(100);
  await main.page.evaluate(() => window.fixture.activity());
  assert.equal(main.events.length, 3, 'same day activity should deduplicate');
  scenarios.push('KST midnight: actual activity only, once per day');
  await main.page.evaluate(() => {
    window.fixture.exclude();
    window.fixture.send('game_start', crypto.randomUUID());
    window.fixture.activity();
  });
  assert.equal(main.events.length, 3);
  assert.equal(await main.page.evaluate(() => localStorage.getItem('wc_potion_pilot_v1')), null);
  scenarios.push('opt-out stops events and removes own identity');
  assert.deepEqual(main.errors, []);
  await main.context.close();

  const blocked = await fixture(true);
  await blocked.page.evaluate(() => { window.fixture.send('game_start'); window.fixture.activity(); });
  assert.equal(blocked.events.length, 0);
  assert.deepEqual(blocked.errors, []);
  await blocked.context.close();
  scenarios.push('blocked storage: zero events and no crash');

  const lifecycle = await fixture();
  await lifecycle.page.evaluate(() => window.fixture.unmount());
  await lifecycle.page.evaluate(() => {
    window.fixture.send('game_start');
    window.fixture.activity();
    window.dispatchEvent(new Event('pageshow'));
  });
  assert.equal(lifecycle.events.length, 0);
  assert.deepEqual(lifecycle.errors, []);
  await lifecycle.context.close();
  scenarios.push('provider unmount removes listeners');
  console.log(JSON.stringify({ ok: true, fixture: 'loopback React provider; pilot config mocked active', scenarios }, null, 2));
} finally {
  await browser?.close();
  await vite.close();
}
