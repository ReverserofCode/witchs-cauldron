import type { BroadcastSession } from "./types";

const DEFAULT_MAX_WATCHED_SESSIONS = 500;

export type BroadcastProgressFilter = "all" | "unwatched" | "new";
export type BroadcastVisitStatus = "ready" | "missing_api_key" | "unavailable";

export function shouldRecordBroadcastVisit(status: BroadcastVisitStatus): boolean {
  return status === "ready";
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_MAX_WATCHED_SESSIONS;
  return Math.max(0, Math.min(DEFAULT_MAX_WATCHED_SESSIONS, Math.floor(limit)));
}

function normalizeWatchedSessionIds(values: unknown, limit: number): string[] {
  if (!Array.isArray(values)) return [];

  const maxEntries = normalizeLimit(limit);
  if (maxEntries === 0) return [];
  const uniqueIds = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") continue;
    const id = value.trim();
    if (!id || id.length > 120 || uniqueIds.has(id)) continue;

    uniqueIds.add(id);
    if (uniqueIds.size >= maxEntries) break;
  }

  return [...uniqueIds];
}

export function parseWatchedSessionIds(
  rawValue: string | null,
  limit = DEFAULT_MAX_WATCHED_SESSIONS
): string[] {
  if (!rawValue) return [];

  try {
    return normalizeWatchedSessionIds(JSON.parse(rawValue) as unknown, limit);
  } catch {
    return [];
  }
}

export function serializeWatchedSessionIds(
  sessionIds: Iterable<string>,
  limit = DEFAULT_MAX_WATCHED_SESSIONS
): string {
  return JSON.stringify(normalizeWatchedSessionIds([...sessionIds], limit));
}

export function isSessionNew(latestPublishedAt: string, lastVisitedAt: string | null): boolean {
  if (!lastVisitedAt) return false;

  const latestPublishedAtMs = Date.parse(latestPublishedAt);
  const lastVisitedAtMs = Date.parse(lastVisitedAt);
  if (!Number.isFinite(latestPublishedAtMs) || !Number.isFinite(lastVisitedAtMs)) {
    return false;
  }

  return latestPublishedAtMs > lastVisitedAtMs;
}

export function filterBroadcastSessions(
  sessions: BroadcastSession[],
  filter: BroadcastProgressFilter,
  watchedSessionIds: ReadonlySet<string>,
  lastVisitedAt: string | null
): BroadcastSession[] {
  if (filter === "unwatched") {
    return sessions.filter((session) => !watchedSessionIds.has(session.id));
  }

  if (filter === "new") {
    return sessions.filter((session) => isSessionNew(session.latestPublishedAt, lastVisitedAt));
  }

  return sessions;
}
