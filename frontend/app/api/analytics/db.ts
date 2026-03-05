import { Pool } from "pg";

const DEFAULT_DB_URLS = [
  "postgres://analytics:analytics@analytics-db:5432/analytics",
  "postgres://analytics:analytics@localhost:5432/analytics",
] as const;

let pool: Pool | null = null;
let poolPromise: Promise<Pool> | null = null;
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function getDatabaseCandidates() {
  const candidates = [
    process.env.ANALYTICS_DATABASE_URL,
    process.env.DATABASE_URL,
    ...DEFAULT_DB_URLS,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return Array.from(new Set(candidates));
}

async function createPoolWithFallback() {
  const candidates = getDatabaseCandidates();
  let lastError: unknown = null;

  for (const connectionString of candidates) {
    const candidatePool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
    });

    try {
      const client = await candidatePool.connect();
      client.release();
      return candidatePool;
    } catch (error) {
      lastError = error;
      await candidatePool.end().catch(() => {});
    }
  }

  throw new Error(
    `analytics_db_unreachable: failed candidates=${candidates.length}${
      lastError instanceof Error ? ` lastError=${lastError.message}` : ""
    }`
  );
}

export async function getPool() {
  if (pool) return pool;
  if (!poolPromise) {
    poolPromise = createPoolWithFallback().then((created) => {
      pool = created;
      return created;
    });
  }
  return poolPromise;
}

export async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = await getPool();
    const client = await db.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics_sessions (
          session_id uuid PRIMARY KEY,
          ip text NOT NULL,
          user_agent text,
          first_seen timestamptz NOT NULL,
          last_seen timestamptz NOT NULL
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id bigserial PRIMARY KEY,
          event_id text,
          session_id uuid REFERENCES analytics_sessions(session_id) ON DELETE CASCADE,
          ip text NOT NULL,
          event_type text NOT NULL,
          path text,
          referrer text,
          element_type text,
          element_id text,
          element_label text,
          metadata jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await client.query(`
        ALTER TABLE analytics_sessions
          ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT 'unknown',
          ADD COLUMN IF NOT EXISTS user_agent text,
          ADD COLUMN IF NOT EXISTS first_seen timestamptz NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();
      `);
      await client.query(`
        ALTER TABLE analytics_events
          ADD COLUMN IF NOT EXISTS event_id text,
          ADD COLUMN IF NOT EXISTS session_id uuid,
          ADD COLUMN IF NOT EXISTS ip text NOT NULL DEFAULT 'unknown',
          ADD COLUMN IF NOT EXISTS event_type text,
          ADD COLUMN IF NOT EXISTS path text,
          ADD COLUMN IF NOT EXISTS referrer text,
          ADD COLUMN IF NOT EXISTS element_type text,
          ADD COLUMN IF NOT EXISTS element_id text,
          ADD COLUMN IF NOT EXISTS element_label text,
          ADD COLUMN IF NOT EXISTS metadata jsonb,
          ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
      `);
      await client.query(`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at);`);
      await client.query(`CREATE INDEX IF NOT EXISTS analytics_events_ip_idx ON analytics_events (ip);`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_event_id_uq ON analytics_events (event_id) WHERE event_id IS NOT NULL;`);
      schemaReady = true;
    } finally {
      client.release();
      schemaPromise = null;
    }
  })();
  return schemaPromise;
}
