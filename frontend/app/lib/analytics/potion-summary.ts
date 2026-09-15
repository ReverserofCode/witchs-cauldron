import type { Pool } from "pg";

import { POTION_PILOT_WINDOW, type PilotWindow } from "./potion-config";
import type { PotionGameMode } from "./potion-contract";
import { getKstDateString } from "./dates";

export type PotionSummary = {
  generatedAt: string;
  timezone: "Asia/Seoul";
  identityBasis: "browser-pilot-id";
  from: string;
  to: string;
  observedThrough: string;
  eligible: number;
  immature: number;
  siteReturned: number;
  gameReturned: number;
  siteReturnRate: number | null;
  gameReturnRate: number | null;
  d0ReplayVisitors: number;
  completion: {
    eligibleRuns: number;
    completedWithin24h: number;
    completedLate: number;
    rate: number | null;
  };
  startsByMode: Record<PotionGameMode, number>;
  window: PilotWindow | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const MAX_COHORT_DAYS = 45;

function parseCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const ms = Date.UTC(year!, month! - 1, day!);
  const roundTrip = new Date(ms).toISOString().slice(0, 10);
  return roundTrip === value ? ms : null;
}

export function validateCohortRange(from: string, to: string): { from: string; to: string } | null {
  const fromMs = parseCalendarDate(from);
  const toMs = parseCalendarDate(to);
  if (fromMs === null || toMs === null || toMs < fromMs) return null;
  if ((toMs - fromMs) / DAY_MS + 1 > MAX_COHORT_DAYS) return null;
  return { from, to };
}

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(numerator: number, denominator: number) {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

const MATURE_SQL = `
  WITH mature AS (
    SELECT * FROM potion_pilot_visitors
    WHERE first_day_kst BETWEEN $1::date AND $2::date
      AND first_day_kst + 7 < $3::date
      AND expires_at > $4::timestamptz
  )
  SELECT COUNT(*)::int AS eligible,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM potion_pilot_events e WHERE e.visitor_id = mature.visitor_id
        AND e.day_kst BETWEEN mature.first_day_kst + 1 AND mature.first_day_kst + 7
    ))::int AS site_returned,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM potion_pilot_events e WHERE e.visitor_id = mature.visitor_id
        AND e.event_type = 'game_start'
        AND e.day_kst BETWEEN mature.first_day_kst + 1 AND mature.first_day_kst + 7
    ))::int AS game_returned
  FROM mature
`;

const IMMATURE_SQL = `
  SELECT COUNT(*)::int AS immature
    FROM potion_pilot_visitors
   WHERE first_day_kst BETWEEN $1::date AND $2::date
     AND first_day_kst + 7 >= $3::date
     AND expires_at > $4::timestamptz
`;

const REPLAY_SQL = `
  SELECT COUNT(*)::int AS replay_visitors
    FROM (
      SELECT v.visitor_id
        FROM potion_pilot_visitors v
        JOIN potion_pilot_events e ON e.visitor_id = v.visitor_id
       WHERE v.first_day_kst BETWEEN $1::date AND $2::date
         AND v.expires_at > $3::timestamptz
         AND e.event_type = 'game_start'
         AND e.day_kst = v.first_day_kst
       GROUP BY v.visitor_id
      HAVING COUNT(DISTINCT e.run_id) >= 2
    ) replay
`;

const MODE_SQL = `
  SELECT e.mode, COUNT(*)::int AS starts
    FROM potion_pilot_visitors v
    JOIN potion_pilot_events e ON e.visitor_id = v.visitor_id
   WHERE v.first_day_kst BETWEEN $1::date AND $2::date
     AND v.expires_at > $3::timestamptz
     AND e.event_type = 'game_start'
   GROUP BY e.mode
`;

const COMPLETION_SQL = `
  WITH eligible_runs AS (
    SELECT e.visitor_id, e.run_id, e.mode, e.rule_version, e.occurred_at
      FROM potion_pilot_visitors v
      JOIN potion_pilot_events e ON e.visitor_id = v.visitor_id
     WHERE v.first_day_kst BETWEEN $1::date AND $2::date
       AND v.expires_at > $3::timestamptz
       AND e.event_type = 'game_start'
       AND e.occurred_at + interval '24 hours' <= $4::timestamptz
  )
  SELECT COUNT(*)::int AS eligible_runs,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM potion_pilot_events complete
       WHERE complete.visitor_id = eligible_runs.visitor_id
         AND complete.run_id = eligible_runs.run_id
         AND complete.event_type = 'game_complete'
         AND complete.mode = eligible_runs.mode
         AND complete.rule_version = eligible_runs.rule_version
         AND complete.occurred_at >= eligible_runs.occurred_at
         AND complete.occurred_at <= eligible_runs.occurred_at + interval '24 hours'
         AND complete.occurred_at <= $4::timestamptz
    ))::int AS completed_within_24h,
    COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM potion_pilot_events complete
       WHERE complete.visitor_id = eligible_runs.visitor_id
         AND complete.run_id = eligible_runs.run_id
         AND complete.event_type = 'game_complete'
         AND complete.mode = eligible_runs.mode
         AND complete.rule_version = eligible_runs.rule_version
         AND complete.occurred_at > eligible_runs.occurred_at + interval '24 hours'
         AND complete.occurred_at <= $4::timestamptz
    ))::int AS completed_late
  FROM eligible_runs
`;

export async function getPotionSummary(pool: Pool, from: string, to: string, nowMs: number): Promise<PotionSummary> {
  const validRange = validateCohortRange(from, to);
  if (!validRange) throw new Error("invalid_cohort_range");

  const window = POTION_PILOT_WINDOW;
  const cutoffMs = window ? Math.min(nowMs, window.observeUntilMs) : nowMs;
  const observedThrough = getKstDateString(new Date(cutoffMs));
  const now = new Date(nowMs);
  const cutoff = new Date(cutoffMs);
  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const mature = await client.query(MATURE_SQL, [from, to, observedThrough, now]);
    const immature = await client.query(IMMATURE_SQL, [from, to, observedThrough, now]);
    const replay = await client.query(REPLAY_SQL, [from, to, now]);
    const modes = await client.query(MODE_SQL, [from, to, now]);
    const completion = await client.query(COMPLETION_SQL, [from, to, now, cutoff]);
    await client.query("COMMIT");

    const matureRow = mature.rows[0] ?? {};
    const eligible = count(matureRow.eligible);
    const siteReturned = count(matureRow.site_returned);
    const gameReturned = count(matureRow.game_returned);
    const completionRow = completion.rows[0] ?? {};
    const eligibleRuns = count(completionRow.eligible_runs);
    const completedWithin24h = count(completionRow.completed_within_24h);
    const startsByMode: Record<PotionGameMode, number> = {
      daily: 0,
      practice: 0,
      "slow-practice": 0,
    };
    for (const row of modes.rows) {
      const mode: unknown = row.mode;
      if (mode === "daily" || mode === "practice" || mode === "slow-practice") {
        startsByMode[mode] = count(row.starts);
      }
    }

    return {
      generatedAt: now.toISOString(),
      timezone: "Asia/Seoul",
      identityBasis: "browser-pilot-id",
      from,
      to,
      observedThrough,
      eligible,
      immature: count(immature.rows[0]?.immature),
      siteReturned,
      gameReturned,
      siteReturnRate: percent(siteReturned, eligible),
      gameReturnRate: percent(gameReturned, eligible),
      d0ReplayVisitors: count(replay.rows[0]?.replay_visitors),
      completion: {
        eligibleRuns,
        completedWithin24h,
        completedLate: count(completionRow.completed_late),
        rate: percent(completedWithin24h, eligibleRuns),
      },
      startsByMode,
      window,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
