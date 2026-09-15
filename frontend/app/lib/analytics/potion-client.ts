import { POTION_PILOT_WINDOW } from './potion-config';
import type { AcceptedEvent, PotionPilotEvent } from './potion-contract';
import { validatePotionPayload } from './potion-contract';
import type { GameActivity } from '../games/potion-timing/types';

export type PilotIdentity = { visitorId: string; expiresAt: number };
export type PilotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type { AcceptedEvent } from './potion-contract';
export const PILOT_IDENTITY_KEY = 'wc_potion_pilot_v1';
export const PILOT_EXCLUDED_KEY = 'wc_potion_pilot_excluded_v1';
const TTL_MS = 45 * 86400000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let excludedInTab = false;

export function readPilotIdentity(store: PilotStorage, nowMs: number): PilotIdentity | null {
  try {
    if (store.getItem(PILOT_EXCLUDED_KEY) === '1') return null;
    const raw = store.getItem(PILOT_IDENTITY_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PilotIdentity>;
    if (typeof candidate.visitorId !== 'string' || !UUID.test(candidate.visitorId) ||
        typeof candidate.expiresAt !== 'number' || !Number.isFinite(candidate.expiresAt)) return null;
    if (candidate.expiresAt <= nowMs) {
      store.removeItem(PILOT_IDENTITY_KEY);
      return null;
    }
    return { visitorId: candidate.visitorId, expiresAt: candidate.expiresAt };
  } catch { return null; }
}

export function createPilotIdentity(store: PilotStorage, nowMs: number): PilotIdentity | null {
  try {
    if (store.getItem(PILOT_EXCLUDED_KEY) === '1') return null;
    const existing = readPilotIdentity(store, nowMs);
    if (existing) return existing;
    const identity = { visitorId: crypto.randomUUID(), expiresAt: nowMs + TTL_MS };
    store.setItem(PILOT_IDENTITY_KEY, JSON.stringify(identity));
    const saved = readPilotIdentity(store, nowMs);
    return saved?.visitorId === identity.visitorId ? saved : null;
  } catch { return null; }
}

export function excludePilot(store: PilotStorage): boolean {
  stopPilotCollectionInCurrentTab();
  let persisted = false;
  try {
    store.setItem(PILOT_EXCLUDED_KEY, '1');
    persisted = store.getItem(PILOT_EXCLUDED_KEY) === '1';
  } catch { /* The current tab still stops when persistent storage is blocked. */ }
  try { store.removeItem(PILOT_IDENTITY_KEY); } catch { /* No cross-feature keys are touched. */ }
  return persisted;
}

export function excludePilotInCurrentTab(): void {
  stopPilotCollectionInCurrentTab();
}

const dayKst = (ms: number) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
function isCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
type Delivery = { accepted: AcceptedEvent | null; status: number | null };

async function deliver(event: PotionPilotEvent, shouldAttempt: () => boolean = () => true): Promise<Delivery> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!shouldAttempt()) return { accepted: null, status: null };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/analytics/potion/track', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event), signal: controller.signal,
        credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
      });
      if (response.status === 503 && attempt === 0) continue;
      if (response.status !== 200) return { accepted: null, status: response.status };
      let value: unknown;
      try { value = await response.json(); }
      catch { return { accepted: null, status: 200 }; }
      if (value && typeof value === 'object') {
        const result = value as Partial<AcceptedEvent>;
        if (result.ok === true && typeof result.serverNowMs === 'number' && Number.isFinite(result.serverNowMs) && Math.abs(result.serverNowMs) < 8640000000000000 - 9 * 3600000 &&
            typeof result.expiresAtMs === 'number' && Number.isFinite(result.expiresAtMs) &&
            result.expiresAtMs > result.serverNowMs && isCalendarDay(result.dayKst)) {
          return { accepted: result as AcceptedEvent, status: 200 };
        }
      }
      return { accepted: null, status: 200 };
    } catch {
      if (attempt === 1) return { accepted: null, status: null };
    } finally { clearTimeout(timer); }
  }
  return { accepted: null, status: 503 };
}

export async function trackPotionEvent(event: PotionPilotEvent): Promise<AcceptedEvent | null> {
  return (await deliver(event)).accepted;
}

function browserStorage(): PilotStorage | null {
  try { return window.localStorage; } catch { return null; }
}

function permitted(): boolean {
  return POTION_PILOT_WINDOW !== null && !excludedInTab && typeof window !== 'undefined' &&
    document.visibilityState === 'visible' && !/^\/admin(?:\/|$)/.test(window.location.pathname);
}

let clockAnchor: { serverMs: number; performanceMs: number } | null = null;
let successfulDay: string | null = null;
let lastSiteAttempt: { day: string; performanceMs: number } | null = null;
let siteInflight: Promise<void> | null = null;
let queuedSiteActivity = false;
const acceptedVisitors = new Set<string>();
type RunDelivery = { start: Promise<boolean>; completeQueued: boolean; identity: PilotIdentity; detail: GameActivity };
const runs = new Map<string, RunDelivery>();

function stopPilotCollectionInCurrentTab(): void {
  excludedInTab = true;
  runs.clear();
}

function estimatedNow(): number {
  return clockAnchor ? clockAnchor.serverMs + Math.max(0, performance.now() - clockAnchor.performanceMs) : Date.now();
}

function stillParticipating(store: PilotStorage, identity: PilotIdentity): boolean {
  return !excludedInTab && readPilotIdentity(store, estimatedNow())?.visitorId === identity.visitorId;
}

function accept(store: PilotStorage, identity: PilotIdentity, result: AcceptedEvent): boolean {
  if (excludedInTab) return false;
  try {
    const raw = store.getItem(PILOT_IDENTITY_KEY);
    if (store.getItem(PILOT_EXCLUDED_KEY) === '1' || !raw) {
      stopPilotCollectionInCurrentTab();
      return false;
    }
    const current = JSON.parse(raw) as Partial<PilotIdentity>;
    if (current.visitorId !== identity.visitorId || typeof current.expiresAt !== 'number' ||
        !Number.isFinite(current.expiresAt)) {
      stopPilotCollectionInCurrentTab();
      return false;
    }
    const expiry = acceptedVisitors.has(identity.visitorId)
      ? Math.min(current.expiresAt, result.expiresAtMs) : result.expiresAtMs;
    store.setItem(PILOT_IDENTITY_KEY, JSON.stringify({ visitorId: identity.visitorId, expiresAt: expiry }));
    const saved = readPilotIdentity(store, result.serverNowMs);
    if (!saved || saved.visitorId !== identity.visitorId || saved.expiresAt !== expiry) {
      stopPilotCollectionInCurrentTab();
      return false;
    }
    acceptedVisitors.add(identity.visitorId);
    clockAnchor = { serverMs: result.serverNowMs, performanceMs: performance.now() };
    successfulDay = result.dayKst;
    return true;
  } catch {
    stopPilotCollectionInCurrentTab();
    return false;
  }
}

function parseActivity(detail: unknown): GameActivity | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  const value = detail as Partial<GameActivity>;
  if (Object.keys(value).sort().join(',') !== 'kind,mode,rulesVersion,runId') return null;
  const validation = validatePotionPayload({ schema_version: 1, visitor_id: '00000000-0000-4000-8000-000000000000',
    event_id: '00000000-0000-4000-8000-000000000000', type: value.kind,
    run_id: value.runId, mode: value.mode, rule_version: value.rulesVersion });
  return validation.ok ? value as GameActivity : null;
}

export function enqueueGameActivity(detail: unknown): void {
  if (!permitted()) return;
  const activity = parseActivity(detail);
  const store = browserStorage();
  if (!activity || !store) return;
  const existing = runs.get(activity.runId);
  if (activity.kind === 'game_start') {
    if (existing) return;
    const previous = readPilotIdentity(store, estimatedNow());
    const identity = previous ?? createPilotIdentity(store, estimatedNow());
    if (!identity) return;
    const event: PotionPilotEvent = { schema_version: 1, type: 'game_start', visitor_id: identity.visitorId,
      event_id: crypto.randomUUID(), run_id: activity.runId, mode: activity.mode, rule_version: activity.rulesVersion };
    const canDeliver = () => permitted() && stillParticipating(store, identity);
    const start = deliver(event, canDeliver).then(({ accepted, status }) => {
      if (accepted) return accept(store, identity, accepted);
      if (status === 204 && !previous && stillParticipating(store, identity)) {
        try { store.removeItem(PILOT_IDENTITY_KEY); } catch { /* Best effort own-key cleanup. */ }
      }
      return false;
    });
    runs.set(activity.runId, { start, completeQueued: false, identity, detail: activity });
    if (runs.size > 100) runs.delete(runs.keys().next().value!);
  } else if (existing && !existing.completeQueued && existing.detail.mode === activity.mode &&
      existing.detail.rulesVersion === activity.rulesVersion) {
    existing.completeQueued = true;
    void existing.start.then(async started => {
      if (!started || !permitted() || !stillParticipating(store, existing.identity)) return;
      const event: PotionPilotEvent = { schema_version: 1, type: 'game_complete', visitor_id: existing.identity.visitorId,
        event_id: crypto.randomUUID(), run_id: activity.runId, mode: activity.mode, rule_version: activity.rulesVersion };
      const { accepted } = await deliver(event,
        () => permitted() && stillParticipating(store, existing.identity));
      if (accepted) accept(store, existing.identity, accepted);
    });
  }
}

/** Called only by actual visible page/activity events, never by a timer. */
export function recordPilotSiteActivity(forceCheck = false): void {
  if (!permitted()) return;
  const store = browserStorage();
  const identity = store && readPilotIdentity(store, estimatedNow());
  if (!store || !identity) return;
  const day = dayKst(estimatedNow());
  if (siteInflight) {
    if (forceCheck || lastSiteAttempt?.day !== day) queuedSiteActivity = true;
    return;
  }
  if (!forceCheck && (successfulDay === day || (lastSiteAttempt?.day === day &&
      performance.now() - lastSiteAttempt.performanceMs < 60000))) return;
  lastSiteAttempt = { day, performanceMs: performance.now() };
  siteInflight = deliver({ schema_version: 1, type: 'site_active', visitor_id: identity.visitorId,
    event_id: crypto.randomUUID() }, () => permitted() && stillParticipating(store, identity)).then(({ accepted }) => {
    if (accepted) accept(store, identity, accepted);
  }).finally(() => {
    siteInflight = null;
    if (queuedSiteActivity) {
      queuedSiteActivity = false;
      recordPilotSiteActivity(true);
    }
  });
}
