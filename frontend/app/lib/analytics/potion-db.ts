import { Pool, type PoolClient } from "pg";

import type { PilotWindow } from "./potion-config";
import type { AcceptedEvent, PotionPilotEvent } from "./potion-contract";
import { getKstDateString } from "./dates";

export type { AcceptedEvent } from "./potion-contract";

export type IngestResult =
  | { status: 200; body: AcceptedEvent }
  | { status: 204 }
  | { status: 400; body: { error: "event_conflict" } };

const DAY_MS = 86_400_000;
const RETENTION_DAYS = 45;

type PotionDbState = {
  pool: Pool | null;
  poolPromise: Promise<Pool> | null;
  schemaReady: WeakSet<Pool>;
  schemaPromises: WeakMap<Pool, Promise<void>>;
};

const POTION_DB_STATE_SYMBOL = Symbol.for("witchs-cauldron.potion-db.state");

function getPotionDbState() {
  const root = globalThis as typeof globalThis & Record<symbol, PotionDbState | undefined>;
  root[POTION_DB_STATE_SYMBOL] ??= {
    pool: null,
    poolPromise: null,
    schemaReady: new WeakSet<Pool>(),
    schemaPromises: new WeakMap<Pool, Promise<void>>(),
  };
  return root[POTION_DB_STATE_SYMBOL];
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS potion_pilot_visitors (
    visitor_id uuid PRIMARY KEY,
    first_started_at timestamptz NOT NULL,
    first_day_kst date NOT NULL,
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX IF NOT EXISTS potion_visitors_expiry_idx
    ON potion_pilot_visitors(expires_at);

  CREATE TABLE IF NOT EXISTS potion_pilot_events (
    event_id uuid PRIMARY KEY,
    visitor_id uuid NOT NULL REFERENCES potion_pilot_visitors ON DELETE CASCADE,
    event_type text NOT NULL CHECK (event_type IN ('game_start','game_complete','site_active')),
    run_id uuid,
    mode text,
    rule_version text,
    occurred_at timestamptz NOT NULL,
    day_kst date NOT NULL,
    CHECK (
      (event_type = 'site_active' AND run_id IS NULL AND mode IS NULL AND rule_version IS NULL)
      OR
      (event_type IN ('game_start','game_complete') AND run_id IS NOT NULL
        AND mode IS NOT NULL AND mode IN ('daily','practice','slow-practice')
        AND rule_version IS NOT NULL AND rule_version = 'potion-v1')
    )
  );
  CREATE INDEX IF NOT EXISTS potion_events_visitor_day_idx
    ON potion_pilot_events(visitor_id, day_kst);
  CREATE UNIQUE INDEX IF NOT EXISTS potion_events_run_type_uq
    ON potion_pilot_events(visitor_id, run_id, event_type) WHERE run_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS potion_events_active_day_uq
    ON potion_pilot_events(visitor_id, day_kst) WHERE event_type = 'site_active';
`;

function configuredDatabaseUrl() {
  return process.env.ANALYTICS_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || null;
}

async function createPotionPool() {
  const connectionString = configuredDatabaseUrl();
  if (!connectionString) throw new Error("potion_database_not_configured");

  const candidate = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 3000,
  });
  candidate.on("error", () => {
    console.error("potion_database_idle_error");
  });
  try {
    const client = await candidate.connect();
    client.release();
    return candidate;
  } catch (error) {
    await candidate.end().catch(() => undefined);
    throw error;
  }
}

export async function getPotionPool(): Promise<Pool> {
  const state = getPotionDbState();
  if (state.pool) return state.pool;
  if (!state.poolPromise) {
    const pending = createPotionPool().then((created) => {
      state.pool = created;
      return created;
    });
    state.poolPromise = pending;
    void pending.catch(() => {
      if (state.poolPromise === pending) state.poolPromise = null;
    });
  }
  return state.poolPromise;
}

export async function ensurePotionSchema(pool: Pool): Promise<void> {
  const state = getPotionDbState();
  if (state.schemaReady.has(pool)) return;
  const existing = state.schemaPromises.get(pool);
  if (existing) return existing;

  const pending = pool.query(SCHEMA_SQL).then(() => {
    state.schemaReady.add(pool);
  });
  state.schemaPromises.set(pool, pending);
  try {
    await pending;
  } finally {
    if (state.schemaPromises.get(pool) === pending) state.schemaPromises.delete(pool);
  }
}

type StoredEventRow = {
  event_id: string;
  visitor_id: string;
  event_type: "game_start" | "game_complete" | "site_active";
  run_id: string | null;
  mode: string | null;
  rule_version: string | null;
  day_kst: string;
  expires_at: Date;
};

type ParticipantRow = {
  expires_at: Date;
};

function accepted(nowMs: number, expiresAt: Date | number, dayKst: string): IngestResult {
  return {
    status: 200,
    body: {
      ok: true,
      serverNowMs: nowMs,
      expiresAtMs: typeof expiresAt === "number" ? expiresAt : expiresAt.getTime(),
      dayKst,
    },
  };
}

function conflict(): IngestResult {
  return { status: 400, body: { error: "event_conflict" } };
}

function rowMatchesEvent(row: StoredEventRow, event: PotionPilotEvent) {
  if (
    row.event_id !== event.event_id ||
    row.visitor_id !== event.visitor_id ||
    row.event_type !== event.type
  ) {
    return false;
  }
  if (event.type === "site_active") {
    return row.run_id === null && row.mode === null && row.rule_version === null;
  }
  return row.run_id === event.run_id && row.mode === event.mode && row.rule_version === event.rule_version;
}

async function findEventById(client: PoolClient, eventId: string) {
  return client.query<StoredEventRow>(
    `SELECT e.event_id::text, e.visitor_id::text, e.event_type, e.run_id::text,
            e.mode, e.rule_version, e.day_kst::text AS day_kst, v.expires_at
       FROM potion_pilot_events e
       JOIN potion_pilot_visitors v ON v.visitor_id = e.visitor_id
      WHERE e.event_id = $1
      FOR UPDATE OF e, v`,
    [eventId]
  );
}

async function finish(client: PoolClient, result: IngestResult, rollback = false) {
  await client.query(rollback ? "ROLLBACK" : "COMMIT");
  return result;
}

export async function ingestPotionEvent(
  pool: Pool,
  event: PotionPilotEvent,
  nowMs: number,
  window: PilotWindow | null
): Promise<IngestResult> {
  if (window === null || nowMs < window.enrollFromMs || nowMs >= window.observeUntilMs) {
    return { status: 204 };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingById = await findEventById(client, event.event_id);
    const existing = existingById.rows[0];
    if (existing) {
      if (!rowMatchesEvent(existing, event)) return finish(client, conflict(), true);
      if (existing.expires_at.getTime() <= nowMs) return finish(client, { status: 204 });
      return finish(client, accepted(nowMs, existing.expires_at, existing.day_kst));
    }

    let participant = await client.query<ParticipantRow>(
      "SELECT expires_at FROM potion_pilot_visitors WHERE visitor_id = $1 FOR UPDATE",
      [event.visitor_id]
    );

    if (participant.rowCount === 0) {
      if (event.type === "game_complete") return finish(client, { status: 204 });
      if (event.type !== "game_start" || nowMs < window.enrollFromMs || nowMs >= window.enrollUntilMs) {
        return finish(client, { status: 204 });
      }

      const firstDayKst = getKstDateString(new Date(nowMs));
      const expiresAt = new Date(nowMs + RETENTION_DAYS * DAY_MS);
      await client.query(
        `INSERT INTO potion_pilot_visitors (visitor_id, first_started_at, first_day_kst, expires_at)
         VALUES ($1, $2, $3::date, $4)
         ON CONFLICT (visitor_id) DO NOTHING`,
        [event.visitor_id, new Date(nowMs), firstDayKst, expiresAt]
      );
      participant = await client.query<ParticipantRow>(
        "SELECT expires_at FROM potion_pilot_visitors WHERE visitor_id = $1 FOR UPDATE",
        [event.visitor_id]
      );
    }

    const participantRow = participant.rows[0];
    if (!participantRow || participantRow.expires_at.getTime() <= nowMs) {
      return finish(client, { status: 204 });
    }

    // A concurrent first-start can commit while this transaction waits on the
    // participant row. Re-read the event after acquiring that lock so the
    // loser remains an idempotent 200 instead of a run/type conflict.
    const concurrentlyInserted = (await findEventById(client, event.event_id)).rows[0];
    if (concurrentlyInserted) {
      if (!rowMatchesEvent(concurrentlyInserted, event)) return finish(client, conflict(), true);
      return finish(client, accepted(nowMs, concurrentlyInserted.expires_at, concurrentlyInserted.day_kst));
    }

    if (event.type === "game_complete") {
      const start = await client.query<{ mode: string; rule_version: string }>(
        `SELECT mode, rule_version
           FROM potion_pilot_events
          WHERE visitor_id = $1 AND run_id = $2 AND event_type = 'game_start'`,
        [event.visitor_id, event.run_id]
      );
      if (start.rowCount === 0) return finish(client, { status: 204 });
      if (start.rows[0]?.mode !== event.mode || start.rows[0]?.rule_version !== event.rule_version) {
        return finish(client, conflict(), true);
      }
    }

    if (event.type !== "site_active") {
      const sameRunType = await client.query<StoredEventRow>(
        `SELECT e.event_id::text, e.visitor_id::text, e.event_type, e.run_id::text,
                e.mode, e.rule_version, e.day_kst::text AS day_kst, v.expires_at
           FROM potion_pilot_events e
           JOIN potion_pilot_visitors v ON v.visitor_id = e.visitor_id
          WHERE e.visitor_id = $1 AND e.run_id = $2 AND e.event_type = $3`,
        [event.visitor_id, event.run_id, event.type]
      );
      if (sameRunType.rowCount) return finish(client, conflict(), true);
    }

    const dayKst = getKstDateString(new Date(nowMs));
    if (event.type === "site_active") {
      const active = await client.query<{ day_kst: string }>(
        `SELECT day_kst::text AS day_kst
           FROM potion_pilot_events
          WHERE visitor_id = $1 AND event_type = 'site_active' AND day_kst = $2::date`,
        [event.visitor_id, dayKst]
      );
      if (active.rowCount) return finish(client, accepted(nowMs, participantRow.expires_at, active.rows[0]!.day_kst));
    }

    const gameFields = event.type === "site_active"
      ? [null, null, null]
      : [event.run_id, event.mode, event.rule_version];
    const inserted = await client.query(
      `INSERT INTO potion_pilot_events
         (event_id, visitor_id, event_type, run_id, mode, rule_version, occurred_at, day_kst)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date)
       ON CONFLICT DO NOTHING
       RETURNING event_id`,
      [event.event_id, event.visitor_id, event.type, ...gameFields, new Date(nowMs), dayKst]
    );
    if (inserted.rowCount === 0) {
      const raced = (await findEventById(client, event.event_id)).rows[0];
      if (raced && rowMatchesEvent(raced, event)) {
        return finish(client, accepted(nowMs, raced.expires_at, raced.day_kst));
      }
      if (event.type === "site_active") {
        const active = await client.query<{ day_kst: string }>(
          `SELECT day_kst::text AS day_kst FROM potion_pilot_events
            WHERE visitor_id = $1 AND event_type = 'site_active' AND day_kst = $2::date`,
          [event.visitor_id, dayKst]
        );
        if (active.rowCount) return finish(client, accepted(nowMs, participantRow.expires_at, active.rows[0]!.day_kst));
      }
      return finish(client, conflict(), true);
    }

    return finish(client, accepted(nowMs, participantRow.expires_at, dayKst));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
