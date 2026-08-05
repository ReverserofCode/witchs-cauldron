import { describe, expect, it } from "vitest";
import {
  filterBroadcastSessions,
  isSessionNew,
  parseWatchedSessionIds,
  serializeWatchedSessionIds,
  shouldRecordBroadcastVisit,
} from "./progress";
import type { BroadcastSession } from "./types";

function makeSession(id: string, latestPublishedAt: string): BroadcastSession {
  return {
    id,
    broadcastDate: "2026-08-05",
    dateSource: "title",
    assets: [],
    totalDurationSeconds: 0,
    categories: [],
    collaborators: [],
    latestPublishedAt,
  };
}

describe("broadcast progress storage", () => {
  it("treats missing, malformed, and non-array values as empty progress", () => {
    expect(parseWatchedSessionIds(null)).toEqual([]);
    expect(parseWatchedSessionIds("not-json")).toEqual([]);
    expect(parseWatchedSessionIds('{"watched":true}')).toEqual([]);
  });

  it("keeps unique, non-empty string ids within the configured limit", () => {
    const raw = JSON.stringify([" broadcast-1 ", "", "broadcast-1", 42, "broadcast-2"]);

    expect(parseWatchedSessionIds(raw, 2)).toEqual(["broadcast-1", "broadcast-2"]);
  });

  it("serializes unique ids using the same bounded representation", () => {
    expect(
      serializeWatchedSessionIds(["broadcast-1", "broadcast-1", "broadcast-2", "broadcast-3"], 2)
    ).toBe('["broadcast-1","broadcast-2"]');
  });

  it("stores nothing when the configured limit is zero", () => {
    expect(parseWatchedSessionIds('["broadcast-1"]', 0)).toEqual([]);
    expect(serializeWatchedSessionIds(["broadcast-1"], 0)).toBe("[]");
  });
});

describe("new broadcast detection", () => {
  it("advances the last-visit marker only after the archive loaded successfully", () => {
    expect(shouldRecordBroadcastVisit("ready")).toBe(true);
    expect(shouldRecordBroadcastVisit("missing_api_key")).toBe(false);
    expect(shouldRecordBroadcastVisit("unavailable")).toBe(false);
  });

  it("does not label every session as new on a first visit", () => {
    expect(isSessionNew("2026-08-05T10:00:00.000Z", null)).toBe(false);
  });

  it("only labels a session new when its latest upload is after the previous visit", () => {
    expect(
      isSessionNew("2026-08-05T10:00:00.000Z", "2026-08-05T09:59:59.000Z")
    ).toBe(true);
    expect(
      isSessionNew("2026-08-05T10:00:00.000Z", "2026-08-05T10:00:00.000Z")
    ).toBe(false);
    expect(
      isSessionNew("2026-08-05T10:00:00.000Z", "2026-08-05T10:00:01.000Z")
    ).toBe(false);
  });

  it("fails closed for invalid timestamps", () => {
    expect(isSessionNew("invalid", "2026-08-05T10:00:00.000Z")).toBe(false);
    expect(isSessionNew("2026-08-05T10:00:00.000Z", "invalid")).toBe(false);
  });
});

describe("broadcast progress filters", () => {
  const sessions = [
    makeSession("broadcast-new", "2026-08-05T10:00:00.000Z"),
    makeSession("broadcast-old", "2026-08-01T10:00:00.000Z"),
  ];

  it("keeps source order for all sessions", () => {
    expect(filterBroadcastSessions(sessions, "all", new Set(), null)).toEqual(sessions);
  });

  it("returns only sessions that have not been marked watched", () => {
    expect(
      filterBroadcastSessions(sessions, "unwatched", new Set(["broadcast-new"]), null).map(
        (session) => session.id
      )
    ).toEqual(["broadcast-old"]);
  });

  it("returns only uploads newer than the previous visit", () => {
    expect(
      filterBroadcastSessions(
        sessions,
        "new",
        new Set(),
        "2026-08-03T10:00:00.000Z"
      ).map((session) => session.id)
    ).toEqual(["broadcast-new"]);
  });
});
