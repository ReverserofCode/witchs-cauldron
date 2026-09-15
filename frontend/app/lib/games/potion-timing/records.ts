import type { GameMode, RuleVersion } from "./types";

const RECORD_PREFIX = "wc:potion:run:v1:";
const DAY_MS = 86_400_000;
const DISPLAY_DAYS = 30;
const PRUNE_DAYS = 45;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RunRecord = Readonly<{
  schemaVersion: 1;
  runId: string;
  mode: GameMode;
  rulesVersion: RuleVersion;
  challengeId: string;
  challengeDate: string;
  completedAtMs: number;
  scores: readonly number[];
  total: number;
}>;

export type RecordStore = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;

type RecordSummary = Readonly<{
  mode: GameMode;
  rulesVersion: RuleVersion;
  challengeId: string;
  first: RunRecord;
  best: RunRecord;
}>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isMode(value: unknown): value is GameMode {
  return value === "daily" || value === "practice" || value === "slow-practice";
}

function byCompletion(left: RunRecord, right: RunRecord): number {
  return left.completedAtMs - right.completedAtMs || left.runId.localeCompare(right.runId);
}

export function parseRunRecord(value: string): RunRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isObject(parsed)) return null;

    const {
      schemaVersion,
      runId,
      mode,
      rulesVersion,
      challengeId,
      challengeDate,
      completedAtMs,
      scores,
      total,
    } = parsed;
    if (
      schemaVersion !== 1 ||
      typeof runId !== "string" ||
      !UUID_PATTERN.test(runId) ||
      !isMode(mode) ||
      rulesVersion !== "potion-v1" ||
      !isValidDate(challengeDate) ||
      challengeId !== `potion-v1:${challengeDate}:${mode}` ||
      typeof completedAtMs !== "number" ||
      !Number.isFinite(completedAtMs) ||
      completedAtMs < 0 ||
      !Array.isArray(scores) ||
      scores.length !== 5 ||
      !scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 100) ||
      typeof total !== "number" ||
      !Number.isInteger(total) ||
      total !== scores.reduce((sum, score) => sum + score, 0) ||
      total < 0 ||
      total > 500
    ) {
      return null;
    }

    return {
      schemaVersion,
      runId,
      mode,
      rulesVersion,
      challengeId,
      challengeDate,
      completedAtMs,
      scores: [...scores],
      total,
    };
  } catch {
    return null;
  }
}

function snapshotKeys(store: RecordStore): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null) keys.push(key);
  }
  return keys;
}

export function readRecords(
  store: RecordStore,
  nowMs: number,
): { records: RunRecord[]; storageAvailable: boolean } {
  try {
    const keys = snapshotKeys(store);
    if (!Number.isFinite(nowMs)) return { records: [], storageAvailable: true };

    const records: RunRecord[] = [];
    for (const key of keys) {
      if (!key.startsWith(RECORD_PREFIX)) continue;
      const serialized = store.getItem(key);
      if (serialized === null) continue;
      const record = parseRunRecord(serialized);
      if (!record || key !== `${RECORD_PREFIX}${record.runId}`) {
        store.removeItem(key);
        continue;
      }

      const ageMs = nowMs - record.completedAtMs;
      if (ageMs < 0) {
        continue;
      } else if (ageMs > PRUNE_DAYS * DAY_MS) {
        store.removeItem(key);
      } else if (ageMs <= DISPLAY_DAYS * DAY_MS) {
        records.push(record);
      }
    }

    records.sort(byCompletion);
    return { records, storageAvailable: true };
  } catch {
    return { records: [], storageAvailable: false };
  }
}

export function saveRecord(store: RecordStore, record: RunRecord): boolean {
  try {
    const serialized = JSON.stringify(record);
    if (!parseRunRecord(serialized)) return false;
    store.setItem(`${RECORD_PREFIX}${record.runId}`, serialized);
    return true;
  } catch {
    return false;
  }
}

export function summarizeRecords(records: readonly RunRecord[]): RecordSummary[] {
  const summaries = new Map<string, RecordSummary>();
  const ordered = [...records].sort(byCompletion);

  for (const record of ordered) {
    const key = `${record.mode}\u0000${record.rulesVersion}\u0000${record.challengeId}`;
    const current = summaries.get(key);
    if (!current) {
      summaries.set(key, {
        mode: record.mode,
        rulesVersion: record.rulesVersion,
        challengeId: record.challengeId,
        first: record,
        best: record,
      });
      continue;
    }

    const better =
      record.total > current.best.total ||
      (record.total === current.best.total && byCompletion(record, current.best) < 0);
    if (better) summaries.set(key, { ...current, best: record });
  }

  return [...summaries.values()];
}

export function clearRecords(store: RecordStore): boolean {
  try {
    for (const key of snapshotKeys(store)) {
      if (key.startsWith(RECORD_PREFIX)) store.removeItem(key);
    }
    return true;
  } catch {
    return false;
  }
}
