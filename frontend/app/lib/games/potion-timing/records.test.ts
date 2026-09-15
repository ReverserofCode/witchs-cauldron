import { describe, expect, it } from "vitest";

import {
  clearRecords,
  parseRunRecord,
  readRecords,
  saveRecord,
  summarizeRecords,
  type RecordStore,
  type RunRecord,
} from "./records";

const DAY = 86_400_000;
const NOW = Date.parse("2026-09-15T12:00:00Z");

class MemoryStore implements RecordStore {
  readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    schemaVersion: 1,
    runId: "d7b360f9-e638-476a-a17e-62ec11a36fb8",
    mode: "daily",
    rulesVersion: "potion-v1",
    challengeId: "potion-v1:2026-09-15:daily",
    challengeDate: "2026-09-15",
    completedAtMs: NOW,
    scores: [100, 80, 60, 40, 20],
    total: 300,
    ...overrides,
  };
}

describe("potion timing records", () => {
  it("does not crash on blocked storage", () => {
    const blocked = {
      setItem() {
        throw new DOMException("blocked", "SecurityError");
      },
    };

    expect(saveRecord(blocked as unknown as RecordStore, record())).toBe(false);
    expect(
      readRecords(
        {
          get length() {
            throw new DOMException("blocked", "SecurityError");
          },
        } as unknown as RecordStore,
        NOW,
      ),
    ).toEqual({ records: [], storageAvailable: false });
  });

  it("writes one validated key per run without clobbering another tab", () => {
    const store = new MemoryStore();
    const first = record();
    const second = record({
      runId: "ab61f2a2-19af-41c6-a7cc-5de6a470ca61",
      scores: [10, 20, 30, 40, 50],
      total: 150,
    });

    expect(saveRecord(store, first)).toBe(true);
    expect(saveRecord(store, second)).toBe(true);
    expect(store.length).toBe(2);
    expect(store.getItem(`wc:potion:run:v1:${first.runId}`)).toBe(JSON.stringify(first));
    expect(store.getItem(`wc:potion:run:v1:${second.runId}`)).toBe(JSON.stringify(second));

    const improvedSameRun = record({ scores: [100, 100, 100, 100, 100], total: 500 });
    expect(saveRecord(store, improvedSameRun)).toBe(true);
    expect(store.length).toBe(2);
    expect(parseRunRecord(store.getItem(`wc:potion:run:v1:${first.runId}`)!)).toEqual(
      improvedSameRun,
    );
  });

  it("rejects corrupt or internally inconsistent records", () => {
    expect(parseRunRecord("not json")).toBeNull();
    expect(parseRunRecord(JSON.stringify(record({ total: 301 })))).toBeNull();
    expect(parseRunRecord(JSON.stringify(record({ scores: [101, 0, 0, 0, 0], total: 101 })))).toBeNull();
    expect(parseRunRecord(JSON.stringify(record({ scores: [1, 2], total: 3 })))).toBeNull();
    expect(
      parseRunRecord(
        JSON.stringify(
          record({
            mode: "practice",
            challengeId: "potion-v1:2026-09-14:practice",
          }),
        ),
      ),
    ).toBeNull();
  });

  it("shows 30 days, prunes only game records older than 45 days, and cleans corruption", () => {
    const store = new MemoryStore();
    const recent = record({ completedAtMs: NOW - 30 * DAY });
    const hidden = record({
      runId: "d2568621-0f63-4ffd-a367-1fe2cb11d29a",
      completedAtMs: NOW - 31 * DAY,
    });
    const retainedBoundary = record({
      runId: "d6e93d38-1daf-44ce-a41e-512e9018b909",
      completedAtMs: NOW - 45 * DAY,
    });
    const expired = record({
      runId: "0cb4fd55-1e9a-4e59-a3b9-560ead0462c7",
      completedAtMs: NOW - 45 * DAY - 1,
    });
    saveRecord(store, recent);
    saveRecord(store, hidden);
    saveRecord(store, retainedBoundary);
    saveRecord(store, expired);
    store.setItem("wc:potion:run:v1:broken", "{");
    store.setItem("unrelated:key", "keep");

    expect(readRecords(store, NOW)).toEqual({ records: [recent], storageAvailable: true });
    expect(store.getItem(`wc:potion:run:v1:${expired.runId}`)).toBeNull();
    expect(store.getItem(`wc:potion:run:v1:${retainedBoundary.runId}`)).not.toBeNull();
    expect(store.getItem("wc:potion:run:v1:broken")).toBeNull();
    expect(store.getItem("unrelated:key")).toBe("keep");
  });

  it("retains but does not display records completed in the future", () => {
    const store = new MemoryStore();
    const future = record({ completedAtMs: NOW + 1 });
    saveRecord(store, future);

    expect(readRecords(store, NOW)).toEqual({ records: [], storageAvailable: true });
    expect(store.getItem(`wc:potion:run:v1:${future.runId}`)).toBe(JSON.stringify(future));
  });

  it("does not inspect or prune records when the current time is non-finite", () => {
    for (const nowMs of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const store = new MemoryStore();
      const old = record({ completedAtMs: 1 });
      saveRecord(store, old);

      expect(readRecords(store, nowMs)).toEqual({ records: [], storageAvailable: true });
      expect(store.getItem(`wc:potion:run:v1:${old.runId}`)).toBe(JSON.stringify(old));
    }
  });

  it("groups first and best by mode, rule version, and challenge snapshot", () => {
    const first = record({ completedAtMs: NOW - 5000, total: 300 });
    const lower = record({
      runId: "6f4041ea-0f25-43a5-a253-a51e837220dd",
      completedAtMs: NOW - 4000,
      scores: [20, 20, 20, 20, 20],
      total: 100,
    });
    const better = record({
      runId: "11be6d26-81c3-4130-a05e-711b552d58a1",
      completedAtMs: NOW - 3000,
      scores: [80, 80, 80, 80, 80],
      total: 400,
    });
    const tiedEarlier = record({
      runId: "00000000-0000-4000-8000-000000000001",
      completedAtMs: NOW - 3500,
      scores: [80, 80, 80, 80, 80],
      total: 400,
    });
    const practice = record({
      runId: "54e12056-293c-41bd-bfea-87c9fb86dfb0",
      mode: "practice",
      challengeId: "potion-v1:2026-09-15:practice",
      completedAtMs: NOW + 1000,
    });

    expect(summarizeRecords([better, lower, practice, first, tiedEarlier])).toEqual([
      {
        mode: "daily",
        rulesVersion: "potion-v1",
        challengeId: "potion-v1:2026-09-15:daily",
        first,
        best: tiedEarlier,
      },
      {
        mode: "practice",
        rulesVersion: "potion-v1",
        challengeId: "potion-v1:2026-09-15:practice",
        first: practice,
        best: practice,
      },
    ]);
  });

  it("keeps a cross-midnight practice completion in its completion-date group", () => {
    const completedAfterMidnight = record({
      mode: "slow-practice",
      challengeDate: "2026-09-16",
      challengeId: "potion-v1:2026-09-16:slow-practice",
      completedAtMs: Date.parse("2026-09-15T15:01:00Z"),
    });

    expect(parseRunRecord(JSON.stringify(completedAfterMidnight))).toEqual(completedAfterMidnight);
    expect(summarizeRecords([completedAfterMidnight])).toMatchObject([
      { challengeId: "potion-v1:2026-09-16:slow-practice" },
    ]);
  });

  it("clears only potion run keys from a stable key snapshot", () => {
    const store = new MemoryStore();
    saveRecord(store, record());
    saveRecord(store, record({ runId: "d2dd09c5-f672-4de3-9f86-9f5c227c3e77" }));
    store.setItem("unrelated:key", "keep");

    expect(clearRecords(store)).toBe(true);
    expect(store.length).toBe(1);
    expect(store.getItem("unrelated:key")).toBe("keep");
  });
});
