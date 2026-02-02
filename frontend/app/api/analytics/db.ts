import { Pool } from "pg";

const DEFAULT_DB_URL = process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL || "";
let pool: Pool | null = null;
let schemaReady = false;

function getDatabaseUrl() {
  if (!DEFAULT_DB_URL) {
    throw new Error("ANALYTICS_DATABASE_URL 환경변수가 설정되어 있지 않습니다.");
  }
  return DEFAULT_DB_URL;
}

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: getDatabaseUrl() });
  }
  return pool;
}

export async function ensureSchema() {
  if (schemaReady) return;
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
    await client.query(`CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS analytics_events_ip_idx ON analytics_events (ip);`);
    schemaReady = true;
  } finally {
    client.release();
  }
}
