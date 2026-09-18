import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Pool } from "pg";
import { FanArtError, normalizeSourceUrl } from "./model";
export function validatePrivateOutreachPath(value: string, repositoryRoot: string): string {
  if (!isAbsolute(value)) throw new Error("Outreach paths must be absolute");
  const path = resolve(value), relation = relative(resolve(repositoryRoot), path);
  if (!relation || !relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation)) throw new Error("Outreach private paths must be outside the repository and build context");
  if (path.toLowerCase().split(sep).includes("public") || /[\\/]Google[\\/]Chrome[\\/]User Data/i.test(path) || /[\\/]Microsoft[\\/]Edge[\\/]User Data/i.test(path)) throw new Error("Do not use public paths or everyday browser profiles");
  return path;
}

export interface OutreachOptions { login: boolean; headed: boolean; inspect: string | null; apply: boolean; sendComments: boolean; limit: number; iterations: number; pollSeconds: number }
export function parseOutreachOptions(args: string[]): OutreachOptions {
  const options: OutreachOptions = { login: false, headed: false, inspect: null, apply: false, sendComments: false, limit: 0, iterations: 1, pollSeconds: 60 };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === "--login") options.login = true;
    else if (flag === "--headed") options.headed = true;
    else if (flag === "--apply") options.apply = true;
    else if (flag === "--send-comments") options.sendComments = true;
    else if (flag === "--once") { /* Default one iteration. */ }
    else if (flag === "--inspect") options.inspect = normalizeSourceUrl(args[++index]).sourceUrl;
    else if (["--limit", "--iterations", "--poll-seconds"].includes(flag)) {
      const raw = args[++index];
      if (!/^[1-9]\d*$/.test(raw ?? "")) throw new Error(`Invalid ${flag}`);
      const value = Number(raw);
      if (!Number.isSafeInteger(value)) throw new Error(`Invalid ${flag}`);
      if (flag === "--limit") options.limit = value;
      if (flag === "--iterations") options.iterations = value;
      if (flag === "--poll-seconds") options.pollSeconds = value;
    } else throw new Error(`Unknown option: ${flag}`);
  }
  if (options.limit > 5 || options.iterations > 100 || options.pollSeconds < 60 || options.pollSeconds > 3600) throw new Error("Limits: comments <=5, iterations <=100, polling 60..3600 seconds");
  if (options.sendComments && (!options.apply || options.limit < 1)) throw new Error("Comments require --apply --send-comments --limit 1..5");
  if ((options.login || options.inspect) && (options.apply || options.sendComments || options.iterations !== 1) || options.login && options.inspect) throw new Error("Login and inspect cannot mutate or poll");
  return options;
}
export async function requireNoStopFile(path: string) {
  try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new FanArtError("worker_stopped", "중지 파일이 있어 작업을 중단했습니다.", 409);
}
export async function withOutreachWorkerLock<T>(pool: Pool, operation: () => Promise<T>): Promise<T> {
  const client = await pool.connect(); let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(hashtext('witchs-cauldron:fanart-outreach-worker-v1')) AS acquired");
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) throw new FanArtError("worker_locked", "이미 다른 팬아트 작업자가 실행 중입니다.", 409);
    return await operation();
  } finally {
    if (acquired) await client.query("SELECT pg_advisory_unlock(hashtext('witchs-cauldron:fanart-outreach-worker-v1'))").catch(() => undefined);
    client.release();
  }
}
export function createOutreachSendGuard(pool: Pool, options: { operatorMemberKey: string; limit: number; stopFile: string; now?: () => Date }) {
  if (!options.operatorMemberKey || !Number.isInteger(options.limit) || options.limit < 1 || options.limit > 5) throw new Error("Invalid comment guard configuration");
  const account = createHash("sha256").update(options.operatorMemberKey).digest("hex");
  let attempts = 0;
  return async () => {
    await requireNoStopFile(options.stopFile);
    if (attempts >= options.limit) throw new FanArtError("run_limit", "실행당 요청 한도에 도달했습니다.", 409);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('witchs-cauldron:fanart-outreach-rate-v1'))");
      await client.query("CREATE TABLE IF NOT EXISTS fanart_outreach_attempts (account_key text NOT NULL, attempted_at timestamptz NOT NULL)");
      await client.query("CREATE INDEX IF NOT EXISTS fanart_outreach_attempts_account_time_idx ON fanart_outreach_attempts(account_key, attempted_at)");
      // DB time in production avoids local clock skew. Tests inject only the clock.
      const timestamp = options.now?.() ?? (await client.query<{ now: Date }>("SELECT clock_timestamp() AS now")).rows[0].now;
      const result = await client.query<{ latest: Date | null; daily: string }>(`SELECT MAX(attempted_at) AS latest,
        COUNT(*) FILTER (WHERE attempted_at >= $2::timestamptz - interval '24 hours') AS daily
        FROM fanart_outreach_attempts WHERE account_key = $1`, [account, timestamp]);
      const { latest, daily } = result.rows[0];
      if (latest && timestamp.getTime() - latest.getTime() < 60000) throw new FanArtError("rate_limited", "요청 사이에 최소 60초가 필요합니다.", 409);
      if (Number(daily) >= 10) throw new FanArtError("daily_limit", "최근 24시간 요청 한도에 도달했습니다.", 409);
      await client.query("INSERT INTO fanart_outreach_attempts(account_key, attempted_at) VALUES ($1, $2)", [account, timestamp]);
      await client.query("COMMIT"); attempts++;
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  };
}
