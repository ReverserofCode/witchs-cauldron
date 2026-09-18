import { Pool, type PoolClient } from "pg";

import { createCandidate, FanArtError, type FanArtStatus, type FanArtWork } from "./model";

export interface FanArtAuditEvent {
  id: number;
  workId: string;
  type: "created" | "review_updated" | "asset_attached" | "published" | "withdrawn" | "rejected";
  version: number;
  createdAt: string;
}

export interface FanArtRepository {
  create(input: { sourceUrl: string; title: string; credit: string }, now?: string): Promise<FanArtWork>;
  list(input: { status?: FanArtStatus; offset?: number; limit?: number }): Promise<{ works: FanArtWork[]; hasMore: boolean }>;
  get(id: string): Promise<FanArtWork | null>;
  update(id: string, version: number, operation: (current: FanArtWork) => FanArtWork): Promise<FanArtWork>;
  published(): Promise<FanArtWork[]>;
  audit(id: string): Promise<FanArtAuditEvent[]>;
}

type DatabaseError = Error & { code?: string };

const schemaPromises = new WeakMap<Pool, Promise<void>>();

async function ensureSchema(pool: Pool) {
  const pending = schemaPromises.get(pool);
  if (pending) return pending;

  const created = (async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('witchs-cauldron:fanart-schema-v1'))");
      await client.query(`
        CREATE TABLE IF NOT EXISTS fanart_works (
          id uuid PRIMARY KEY,
          source_key text NOT NULL UNIQUE,
          status text NOT NULL,
          published_at timestamptz,
          version integer NOT NULL CHECK (version > 0),
          record jsonb NOT NULL,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        )
      `);
      await client.query("CREATE INDEX IF NOT EXISTS fanart_works_status_idx ON fanart_works (status)");
      await client.query("CREATE INDEX IF NOT EXISTS fanart_works_published_at_idx ON fanart_works (published_at DESC) WHERE status = 'published'");
      await client.query(`
        CREATE TABLE IF NOT EXISTS fanart_audit_events (
          id bigserial PRIMARY KEY,
          work_id uuid NOT NULL REFERENCES fanart_works(id) ON DELETE RESTRICT,
          event_type text NOT NULL,
          version integer NOT NULL,
          created_at timestamptz NOT NULL
        )
      `);
      await client.query("CREATE INDEX IF NOT EXISTS fanart_audit_events_work_idx ON fanart_audit_events (work_id, id)");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  })();

  schemaPromises.set(pool, created);
  try {
    await created;
  } catch (error) {
    if (schemaPromises.get(pool) === created) schemaPromises.delete(pool);
    throw error;
  }
}

function rowWork(row: { record: FanArtWork }) {
  return row.record;
}

async function insertAudit(
  client: PoolClient,
  work: FanArtWork,
  type: FanArtAuditEvent["type"],
) {
  await client.query(
    `INSERT INTO fanart_audit_events (work_id, event_type, version, created_at)
     VALUES ($1, $2, $3, $4)`,
    [work.id, type, work.version, work.updatedAt],
  );
}

function eventType(before: FanArtWork, after: FanArtWork): FanArtAuditEvent["type"] {
  if (after.status === "published" && before.status !== "published") return "published";
  if (after.status === "withdrawn" && before.status !== "withdrawn") return "withdrawn";
  if (after.status === "rejected" && before.status !== "rejected") return "rejected";
  if (after.asset?.sha256 !== before.asset?.sha256 || after.asset?.key !== before.asset?.key) return "asset_attached";
  return "review_updated";
}

function mapDatabaseError(error: unknown): never {
  if ((error as DatabaseError)?.code === "23505") {
    throw new FanArtError("duplicate_source", "이미 등록된 팬카페 원문입니다.", 409);
  }
  throw error;
}

export function createFanArtRepository(pool: Pool): FanArtRepository {
  return {
    async create(input, now = new Date().toISOString()) {
      await ensureSchema(pool);
      const work = createCandidate(input, now);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO fanart_works
           (id, source_key, status, published_at, version, record, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
          [
            work.id,
            work.sourceKey,
            work.status,
            work.publishedAt,
            work.version,
            JSON.stringify(work),
            work.createdAt,
            work.updatedAt,
          ],
        );
        await insertAudit(client, work, "created");
        await client.query("COMMIT");
        return work;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        return mapDatabaseError(error);
      } finally {
        client.release();
      }
    },

    async list({ status, offset = 0, limit = 50 }) {
      await ensureSchema(pool);
      const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
      const safeLimit = Number.isSafeInteger(limit) && limit >= 1 && limit <= 50 ? limit : 50;
      const values: unknown[] = [];
      const where = status ? `WHERE status = $${values.push(status)}` : "";
      values.push(safeLimit + 1, safeOffset);
      const result = await pool.query<{ record: FanArtWork }>(
        `SELECT record FROM fanart_works ${where}
         ORDER BY updated_at DESC, id DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      );
      return {
        works: result.rows.slice(0, safeLimit).map(rowWork),
        hasMore: result.rows.length > safeLimit,
      };
    },

    async get(id) {
      await ensureSchema(pool);
      const result = await pool.query<{ record: FanArtWork }>(
        "SELECT record FROM fanart_works WHERE id = $1",
        [id],
      );
      return result.rows[0]?.record ?? null;
    },

    async update(id, version, operation) {
      await ensureSchema(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{ record: FanArtWork }>(
          "SELECT record FROM fanart_works WHERE id = $1 FOR UPDATE",
          [id],
        );
        const current = result.rows[0]?.record;
        if (!current) throw new FanArtError("not_found", "작품을 찾을 수 없습니다.", 404);

        if (current.version !== version) {
          try {
            const retried = operation(current);
            if (retried === current) {
              await client.query("COMMIT");
              return current;
            }
          } catch {
            // A stale request never receives private state or the operation's incidental error.
          }
          throw new FanArtError("version_conflict", "다른 변경이 저장되었습니다. 새로고침 후 다시 시도해 주세요.", 409);
        }

        const operated = operation(current);
        if (operated === current) {
          await client.query("COMMIT");
          return current;
        }
        const updated: FanArtWork = { ...operated, version: current.version + 1 };
        const saved = await client.query(
          `UPDATE fanart_works
           SET status = $2, published_at = $3, version = $4, record = $5::jsonb, updated_at = $6
           WHERE id = $1 AND version = $7`,
          [
            id,
            updated.status,
            updated.publishedAt,
            updated.version,
            JSON.stringify(updated),
            updated.updatedAt,
            current.version,
          ],
        );
        if (saved.rowCount !== 1) {
          throw new FanArtError("version_conflict", "다른 변경이 저장되었습니다. 새로고침 후 다시 시도해 주세요.", 409);
        }
        await insertAudit(client, updated, eventType(current, updated));
        await client.query("COMMIT");
        return updated;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },

    async published() {
      await ensureSchema(pool);
      const result = await pool.query<{ record: FanArtWork }>(
        `SELECT record FROM fanart_works
         WHERE status = 'published'
         ORDER BY published_at DESC, id DESC
         LIMIT 24`,
      );
      return result.rows.map(rowWork);
    },

    async audit(id) {
      await ensureSchema(pool);
      const result = await pool.query<{
        id: string;
        work_id: string;
        event_type: FanArtAuditEvent["type"];
        version: number;
        created_at: Date;
      }>(
        `SELECT id, work_id, event_type, version, created_at
         FROM fanart_audit_events WHERE work_id = $1 ORDER BY id`,
        [id],
      );
      return result.rows.map((row) => ({
        id: Number(row.id),
        workId: row.work_id,
        type: row.event_type,
        version: row.version,
        createdAt: row.created_at.toISOString(),
      }));
    },
  };
}

const DB_STATE = Symbol.for("witchs-cauldron.fanart-repository.pool");
interface FanArtDatabaseState {
  pool: Pool | null;
  promise: Promise<Pool> | null;
}

function globalState() {
  const root = globalThis as typeof globalThis & { [DB_STATE]?: FanArtDatabaseState };
  root[DB_STATE] ??= { pool: null, promise: null };
  return root[DB_STATE];
}

async function getFanArtPool() {
  const state = globalState();
  if (state.pool) return state.pool;
  if (state.promise) return state.promise;
  const connectionString = [
    process.env.FANART_DATABASE_URL,
    process.env.ANALYTICS_DATABASE_URL,
    process.env.DATABASE_URL,
  ].find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
  if (!connectionString) {
    throw new FanArtError("database_unavailable", "작품 저장소를 사용할 수 없습니다.", 503);
  }

  state.promise = (async () => {
    const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 3000 });
    pool.on("error", () => console.error("fanart_database_idle_error"));
    try {
      const client = await pool.connect();
      client.release();
      state.pool = pool;
      return pool;
    } catch (error) {
      await pool.end().catch(() => undefined);
      throw error;
    }
  })();
  try {
    return await state.promise;
  } finally {
    state.promise = null;
  }
}

export async function getFanArtRepository() {
  return createFanArtRepository(await getFanArtPool());
}
