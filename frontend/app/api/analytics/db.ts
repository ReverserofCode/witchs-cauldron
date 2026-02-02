import { Pool } from "pg";

const FALLBACK_DB_URL = "postgres://analytics:analytics@analytics-db:5432/analytics";
let pool: Pool | null = null;
let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

function getDatabaseUrl() {
  return process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || FALLBACK_DB_URL;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return pool;
}

export async function ensureSchema() {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const client = await getPool().connect();
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
      schemaReady = true;
    } finally {
      client.release();
      schemaPromise = null;
    }
  })();
  return schemaPromise;
}
