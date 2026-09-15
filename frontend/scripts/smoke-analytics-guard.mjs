import assert from 'node:assert/strict';

const paths = ['/api/analytics/track', '/api/analytics/potion/track'];
const countsByContext = new WeakMap();

export async function blockAnalyticsWrites(context) {
  const counts = new Map(paths.map(pathname => [pathname, 0]));
  countsByContext.set(context, counts);
  for (const pathname of paths) {
    await context.route(`**${pathname}`, async route => {
      counts.set(pathname, counts.get(pathname) + 1);
      await route.fulfill({ status: 204 });
    });
  }
}

export async function verifyAnalyticsInterception(page) {
  const counts = countsByContext.get(page.context());
  assert.ok(counts, 'analytics guards must be installed before navigation');
  for (const pathname of paths) {
    const before = counts.get(pathname);
    const status = await page.evaluate(async url => (await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })).status, pathname);
    assert.equal(status, 204, `${pathname} probe must return 204`);
    assert.ok(counts.get(pathname) > before, `${pathname} probe must hit the browser interceptor`);
  }
}
