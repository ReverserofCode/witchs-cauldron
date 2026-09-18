import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Run seed, recreate ONLY the disposable frontend container retaining its DB/volume,
// then run verify with the same unique run ID. No production URL is accepted.
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3169';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
assert.equal(process.env.FANART_SMOKE_ALLOW_WRITES, 'true');
const run = process.env.FANART_PERSISTENCE_RUN_ID;
assert.match(run || '', /^\d{10,16}$/);
const mode = process.argv[2];
assert.ok(['seed', 'verify'].includes(mode));
const authorization = `Basic ${Buffer.from(`${process.env.ADMIN_BASIC_AUTH_USERNAME || 'fanart-admin'}:${process.env.ADMIN_BASIC_AUTH_PASSWORD || 'fanart-local-only'}`).toString('base64')}`;
async function call(path, body, method = 'POST') {
  const multipart = body instanceof FormData;
  const response = await fetch(`${base}/api/admin/fanart${path}`, {
    method, headers: { authorization, origin: base, ...(!multipart && body ? { 'content-type': 'application/json' } : {}) },
    body: body ? multipart ? body : JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `admin ${method} ${path}: ${response.status}`);
  return response.json();
}
if (mode === 'seed') {
  for (const [suffix, withdraw] of [['1', false], ['2', true]]) {
    let { work } = await call('', { sourceUrl: `https://cafe.naver.com/moinge/${run}${suffix}`, title: `persistence-${run}-${suffix}`, credit: '자체 테스트 도형' });
    const date = new Date().toISOString();
    ({ work } = await call(`/${work.id}`, { version: work.version, review: {
      requested: true,
      permission: { display: true, resize: true, credit: true, confirmedAt: date, evidence: 'Self-made test shape only' },
      review: { status: 'confirmed_non_generative', creatorConfirmedAt: date, confirmedAt: date, note: '' },
    } }, 'PATCH'));
    const file = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#add8e6' } }).png().toBuffer();
    const body = new FormData(); body.set('version', String(work.version)); body.set('file', new Blob([file], { type: 'image/png' }), 'owned-test.png');
    ({ work } = await call(`/${work.id}/asset`, body));
    ({ work } = await call(`/${work.id}/publish`, { version: work.version }));
    if (withdraw) ({ work } = await call(`/${work.id}/withdraw`, { version: work.version }));
    console.log(`SEED ${work.status} ${work.id}`);
  }
} else {
  const { works } = await call('?limit=50', undefined, 'GET');
  for (const [suffix, expected] of [['1', 'published'], ['2', 'withdrawn']]) {
    const work = works.find(item => item.title === `persistence-${run}-${suffix}`);
    assert.ok(work); assert.equal(work.status, expected);
    const { events } = await call(`/${work.id}`, undefined, 'GET');
    assert.ok(events.some(event => event.type === expected));
    const media = await fetch(`${base}/media/fanart/${work.id}`);
    assert.equal(media.headers.get('cache-control'), 'no-store');
    assert.equal(media.status, expected === 'published' ? 200 : 404);
    if (expected === 'published') {
      assert.equal(createHash('sha256').update(Buffer.from(await media.arrayBuffer())).digest('hex'), work.approvedHash);
      await call(`/${work.id}/withdraw`, { version: work.version });
    }
  }
  console.log('PASS fanart persistence: published bytes/hash, withdrawn denial, versions and audit survive container recreation');
}
