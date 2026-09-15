import assert from 'node:assert/strict';

const base = new URL(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3165');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'endpoint smoke is loopback only');
const username = process.env.ADMIN_BASIC_AUTH_USERNAME;
const password = process.env.ADMIN_BASIC_AUTH_PASSWORD;
assert.ok(username && password, 'explicit local smoke Basic Auth credentials are required');
const auth = { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` };
const get = (pathname, headers) => fetch(new URL(pathname, base), { headers, redirect: 'manual', signal: AbortSignal.timeout(10000) });

assert.equal((await get('/api/health')).status, 200);
assert.equal((await get('/games/potion-timing')).status, 200);
const daily = await get('/api/games/potion-timing/daily');
assert.equal(daily.status, 200);
assert.match(daily.headers.get('cache-control') ?? '', /no-store/);
const payload = await daily.json();
assert.equal(payload.challenge.rounds.length, 5);
assert.equal(payload.challenge.rulesVersion, 'potion-v1');
assert.ok(payload.challenge.endsAtMs > payload.serverNowMs);
assert.ok(payload.challenge.startsAtMs <= payload.serverNowMs);
assert.match(await (await get('/sitemap.xml')).text(), /\/games\/potion-timing/);
assert.equal((await get('/admin/analytics/potion-summary?from=2026-09-15&to=2026-09-15')).status, 401);
assert.equal((await get('/admin/analytics/potion-summary?from=bad&to=bad', auth)).status, 400);

if (process.env.POTION_EXPECT_DATABASE === 'true') {
  const database = new URL(process.env.ANALYTICS_DATABASE_URL || '');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname) && database.pathname === '/potion_test',
    'database smoke requires explicit disposable loopback potion_test');
  const response = await get('/admin/analytics/potion-summary?from=2026-09-15&to=2026-09-15', auth);
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.identityBasis, 'browser-pilot-id');
  assert.equal(summary.timezone, 'Asia/Seoul');
  assert.equal(typeof summary.eligible, 'number');
  assert.equal(summary.window, null, 'release must leave the retention pilot disabled');
  console.log('potion endpoints + authenticated disposable database summary ok');
} else {
  console.log('potion endpoints + production Basic Auth boundary ok; live database summary not tested');
}
