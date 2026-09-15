import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPilotIdentity, excludePilot, readPilotIdentity, trackPotionEvent } from './potion-client';

function storage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.doUnmock('./potion-config'); });

describe('potion identity', () => {
  it('keeps the original expiry and removes expired identity', () => {
    const store = storage();
    const first = createPilotIdentity(store, 1000);
    expect(first?.expiresAt).toBe(3888001000);
    expect(createPilotIdentity(store, 5000)).toEqual(first);
    expect(readPilotIdentity(store, 3888001000)).toBeNull();
    expect(store.getItem('wc_potion_pilot_v1')).toBeNull();
  });
  it('does not create identity when storage fails or user excludes it', () => {
    const store = storage();
    expect(excludePilot(store)).toBe(true);
    expect(createPilotIdentity(store, 1000)).toBeNull();
    const blocked = { ...store, getItem() { throw new Error('blocked'); } };
    expect(createPilotIdentity(blocked, 1000)).toBeNull();
  });
  it('ignores corrupted identity without touching unrelated keys', () => {
    const store = storage();
    store.setItem('broadcast-progress', 'preserve');
    store.setItem('wc_potion_pilot_v1', '{broken');
    expect(readPilotIdentity(store, 1000)).toBeNull();
    expect(store.getItem('broadcast-progress')).toBe('preserve');
  });
});

describe('potion delivery', () => {
  const event = { schema_version: 1 as const, type: 'site_active' as const,
    visitor_id: '2197e2ee-e965-471b-bf69-af674815133a',
    event_id: 'c998b107-d983-4422-8015-83ba78b3dc54' };
  const accepted = { ok: true, serverNowMs: Date.parse('2026-09-15T00:00:00Z'),
    expiresAtMs: Date.parse('2026-10-30T00:00:00Z'), dayKst: '2026-09-15' };
  it('retries a transient failure once with the same event id', async () => {
    const bodies: string[] = [];
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(String(init.body));
      return bodies.length === 1 ? new Response(null, { status: 503 }) : Response.json(accepted);
    });
    vi.stubGlobal('fetch', request);
    expect(await trackPotionEvent(event)).toEqual(accepted);
    expect(bodies).toHaveLength(2);
    expect(JSON.parse(bodies[0]).event_id).toBe(event.event_id);
    expect(bodies[1]).toBe(bodies[0]);
  });
  it.each([204, 400, 403, 413])('does not retry status %i', async status => {
    const request = vi.fn(async () => new Response(null, { status }));
    vi.stubGlobal('fetch', request);
    expect(await trackPotionEvent(event)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('accepts a persisted event day independently from the fresh server clock', async () => {
    const retried = { ...accepted, serverNowMs: Date.parse('2026-09-15T15:00:01Z'), dayKst: '2026-09-15' };
    vi.stubGlobal('fetch', async () => Response.json(retried));
    expect(await trackPotionEvent(event)).toEqual(retried);
  });
  it('does not accept an impossible persisted event day', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ ...accepted, dayKst: '2026-02-30' }));
    expect(await trackPotionEvent(event)).toBeNull();
  });
  it('does not retry invalid JSON in a successful response', async () => {
    const request = vi.fn(async () => new Response('{broken', { status: 200 }));
    vi.stubGlobal('fetch', request);
    expect(await trackPotionEvent(event)).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

async function adapter(enabled = true) {
  vi.resetModules();
  vi.doMock('./potion-config', () => ({ POTION_PILOT_WINDOW: enabled ? {
    enrollFromMs: 0, enrollUntilMs: 9999999999999, observeUntilMs: 9999999999999,
  } : null }));
  const store = storage();
  const surface = { localStorage: store, location: { pathname: '/games/potion-timing' } };
  const documentState = { visibilityState: 'visible' };
  vi.stubGlobal('window', surface);
  vi.stubGlobal('document', documentState);
  const client = await import('./potion-client');
  return { store, surface, documentState, client };
}

describe('potion activity adapter', () => {
  const activity = { kind: 'game_start', runId: '10adcd9c-a130-457b-8ef1-0e660fe446bd', mode: 'daily', rulesVersion: 'potion-v1' };
  const now = Date.parse('2026-09-15T14:59:00Z');
  const reply = (serverNowMs = now) => ({ ok: true, serverNowMs, expiresAtMs: now + 45 * 86400000,
    dayKst: new Date(serverNowMs + 9 * 3600000).toISOString().slice(0, 10) });
  it('does nothing while the pilot is disabled, including creating an identifier', async () => {
    const { client, store } = await adapter(false);
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    client.enqueueGameActivity(activity);
    client.recordPilotSiteActivity(true);
    expect(request).not.toHaveBeenCalled();
    expect(store.values.size).toBe(0);
  });
  it('does not enroll from a plain visit, hidden game start, admin path, or blocked storage', async () => {
    const { client, surface, documentState, store } = await adapter();
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    client.recordPilotSiteActivity(true);
    documentState.visibilityState = 'hidden';
    client.enqueueGameActivity(activity);
    documentState.visibilityState = 'visible';
    surface.location.pathname = '/admin/analytics';
    client.enqueueGameActivity(activity);
    surface.location.pathname = '/games/potion-timing';
    store.setItem = () => { throw new Error('blocked'); };
    client.enqueueGameActivity(activity);
    expect(request).not.toHaveBeenCalled();
  });
  it('deduplicates the run and sends completion only after accepted start', async () => {
    const { client, store } = await adapter();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    let finishStart!: (response: Response) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishStart = resolve; }))
      .mockImplementation(async () => Response.json(reply()));
    vi.stubGlobal('fetch', request);
    client.enqueueGameActivity(activity);
    client.enqueueGameActivity(activity);
    client.enqueueGameActivity({ ...activity, kind: 'game_complete' });
    client.enqueueGameActivity({ ...activity, kind: 'game_complete' });
    expect(request).toHaveBeenCalledTimes(1);
    finishStart(Response.json(reply()));
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(request.mock.calls.map(call => JSON.parse(call[1].body).type)).toEqual(['game_start', 'game_complete']);
    expect(JSON.parse(store.getItem('wc_potion_pilot_v1')!).expiresAt).toBe(reply().expiresAtMs);
  });
  it('removes a new provisional identity after a 204 rejection and never sends completion', async () => {
    const { client, store } = await adapter();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    client.enqueueGameActivity(activity);
    client.enqueueGameActivity({ ...activity, kind: 'game_complete' });
    await vi.waitFor(() => expect(store.getItem('wc_potion_pilot_v1')).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('sends next-day activity from server clock even with a wrong device clock, then deduplicates', async () => {
    const { client } = await adapter();
    vi.spyOn(Date, 'now').mockReturnValue(now - 86400000);
    let elapsed = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    const request = vi.fn(async () => Response.json(reply(now + elapsed)));
    vi.stubGlobal('fetch', request);
    client.enqueueGameActivity(activity);
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await new Promise(resolve => setTimeout(resolve, 0));
    client.recordPilotSiteActivity();
    expect(request).toHaveBeenCalledTimes(1);
    elapsed = 60000;
    client.recordPilotSiteActivity();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await new Promise(resolve => setTimeout(resolve, 0));
    client.recordPilotSiteActivity();
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('accepts a lost start acknowledgement across KST midnight, chains completion, then records real activity', async () => {
    const { client } = await adapter();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const afterMidnight = now + 120000;
    const persistedStart = { ...reply(afterMidnight), dayKst: '2026-09-15' };
    const requestBodies: string[] = [];
    const request = vi.fn(async (_url: string, init: RequestInit) => {
      if (typeof init.body !== 'string') throw new TypeError('expected a JSON string request body');
      requestBodies.push(init.body);
      const attempt = requestBodies.length;
      if (attempt === 1) throw new Error('ack lost after commit');
      if (attempt === 2) return Response.json(persistedStart);
      if (attempt === 3) return new Response(null, { status: 400 });
      return Response.json(reply(afterMidnight));
    });
    vi.stubGlobal('fetch', request);

    client.enqueueGameActivity(activity);
    client.enqueueGameActivity({ ...activity, kind: 'game_complete' });
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    client.recordPilotSiteActivity();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(4));

    const bodies = requestBodies.map(body => JSON.parse(body));
    expect(bodies.map(body => body.type)).toEqual(['game_start', 'game_start', 'game_complete', 'site_active']);
    expect(bodies[1].event_id).toBe(bodies[0].event_id);
  });
  it('excludes an in-flight start without recreating the identity or sending queued completion', async () => {
    const { client, store } = await adapter();
    let acceptStart!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { acceptStart = resolve; })));
    client.enqueueGameActivity(activity);
    client.enqueueGameActivity({ ...activity, kind: 'game_complete' });
    client.excludePilot(store);
    acceptStart(Response.json(reply()));
    await new Promise(resolve => setTimeout(resolve, 0));
    client.recordPilotSiteActivity(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(store.getItem('wc_potion_pilot_v1')).toBeNull();
    expect(store.getItem('wc_potion_pilot_excluded_v1')).toBe('1');
  });
  it.each(['excluded', 'hidden', 'admin'] as const)(
    'does not retry an adapter request after the page becomes %s while the first attempt is pending',
    async state => {
      const { client, store, surface, documentState } = await adapter();
      let finishFirst!: (response: Response) => void;
      const request = vi.fn(() => new Promise<Response>(resolve => { finishFirst = resolve; }));
      vi.stubGlobal('fetch', request);
      client.enqueueGameActivity({ ...activity, runId: crypto.randomUUID() });
      expect(request).toHaveBeenCalledTimes(1);

      if (state === 'excluded') client.excludePilot(store);
      if (state === 'hidden') documentState.visibilityState = 'hidden';
      if (state === 'admin') surface.location.pathname = '/admin/analytics';
      finishFirst(new Response(null, { status: 503 }));
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(request).toHaveBeenCalledTimes(1);
    }
  );
  it('stops the current tab when accepted identity alignment cannot be persisted', async () => {
    const { client, store } = await adapter();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    let finishStart!: (response: Response) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { finishStart = resolve; }))
      .mockImplementation(async () => Response.json(reply()));
    vi.stubGlobal('fetch', request);
    const runId = crypto.randomUUID();

    client.enqueueGameActivity({ ...activity, runId });
    store.setItem = () => { throw new Error('writes became blocked'); };
    client.enqueueGameActivity({ ...activity, kind: 'game_complete', runId });
    finishStart(Response.json(reply()));
    await new Promise(resolve => setTimeout(resolve, 0));
    client.recordPilotSiteActivity(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(request).toHaveBeenCalledTimes(1);
  });
});
