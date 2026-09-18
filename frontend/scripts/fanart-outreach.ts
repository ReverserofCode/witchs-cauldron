import { readFile, realpath } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { Pool } from "pg";
import { createFanArtAssetStore } from "../app/lib/fanart/assets";
import { FanArtError, type FanArtWork } from "../app/lib/fanart/model";
import { createFanArtRepository } from "../app/lib/fanart/repository";
import { createOutreachService } from "../app/lib/fanart/outreach";
import { createImageDownloader } from "../app/lib/fanart/outreach-download";
import { createOutreachSendGuard, parseOutreachOptions, requireNoStopFile, validatePrivateOutreachPath, withOutreachWorkerLock } from "../app/lib/fanart/outreach-worker";
import { createCafeBrowserProvider, validateCafeSelectors } from "./fanart-browser/provider.mjs";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing explicit configuration: ${name}`);
  return value;
}
async function privatePath(name: string) {
  const repositoryRoot = await realpath(resolve(dirname(process.argv[1]), "..", ".."));
  const absolute = validatePrivateOutreachPath(required(name), repositoryRoot);
  const canonical = await realpath(absolute).catch(async error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return join(await realpath(dirname(absolute)), basename(absolute));
  });
  return validatePrivateOutreachPath(canonical, repositoryRoot);
}
async function main() {
  const options = parseOutreachOptions(process.argv.slice(2));
  const profile = await privatePath("FANART_BROWSER_PROFILE");
  const assetsDirectory = await privatePath("FANART_ASSETS_DIR");
  const stopFile = await privatePath("FANART_STOP_FILE");
  const operatorMemberKey = required("FANART_OPERATOR_MEMBER_KEY");
  const selectors = validateCafeSelectors(JSON.parse(await readFile(await privatePath("FANART_SELECTORS_FILE"), "utf8")));
  const connectionString = [process.env.FANART_DATABASE_URL, process.env.ANALYTICS_DATABASE_URL, process.env.DATABASE_URL].find(value => value?.trim())?.trim();
  if (!connectionString || !["postgres:", "postgresql:"].includes(new URL(connectionString).protocol)) throw new Error("Explicit PostgreSQL connection configuration is required");
  const pool = new Pool({ connectionString, max: 4, connectionTimeoutMillis: 3000 });
  pool.on("error", () => console.error("fanart_worker_database_error"));
  try {
    await withOutreachWorkerLock(pool, async () => {
      await requireNoStopFile(stopFile);
      const repository = createFanArtRepository(pool);
      const candidates = async () => {
        const works: FanArtWork[] = [];
        for (let offset = 0; ; offset += 50) {
          const result = await repository.list({ offset, limit: 50 });
          works.push(...result.works.filter(work => work.outreach && !["published", "rejected", "withdrawn"].includes(work.status) && !["cancelled", "rejected", "sending", "uncertain"].includes(work.outreach.status)));
          if (!result.hasMore) return works;
        }
      };
      let works = options.login || options.inspect ? [] : await candidates();
      if (!options.login && !options.inspect && (!options.apply || works.length === 0)) {
        console.log(JSON.stringify({ mode: "dry-run", candidates: works.map(work => ({ id: work.id, status: work.outreach!.status })), note: "No browser actions or work mutations" }));
        return;
      }
      const context = await chromium.launchPersistentContext(profile, { headless: !(options.login || options.headed), acceptDownloads: false });
      try {
        const page = context.pages()[0] ?? await context.newPage();
        const provider = createCafeBrowserProvider({ page, selectors, operatorMemberKey });
        if (options.login) {
          await page.goto("https://cafe.naver.com/moinge", { waitUntil: "domcontentloaded" });
          const input = createInterface({ input: process.stdin, output: process.stdout });
          try { await input.question("Log in manually using the dedicated profile, then press Enter to close. No comments will be sent.\n"); } finally { input.close(); }
          return;
        }
        if (options.inspect) { console.log(JSON.stringify(await provider.inspect(options.inspect), null, 2)); return; }
        const service = createOutreachService({ repository, assets: createFanArtAssetStore(assetsDirectory), provider, downloadImage: createImageDownloader() });
        const stop = () => requireNoStopFile(stopFile);
        const beforeSend = options.sendComments ? createOutreachSendGuard(pool, { operatorMemberKey, limit: options.limit, stopFile }) : undefined;
        for (let iteration = 0; iteration < options.iterations; iteration++) {
          await stop();
          if (iteration) works = await candidates();
          // Snapshot candidate IDs before any updates: mutable sort order cannot skip a row.
          for (const work of works) {
            await stop();
            try {
              const updated = await service.tick(work.id, { allowComments: options.sendComments, beforeSend, beforeExternalWrite: stop, beforePublish: stop });
              console.log(JSON.stringify({ id: work.id, status: updated.outreach?.status }));
            } catch (error) {
              if (error instanceof FanArtError && error.code === "worker_stopped") throw error;
              console.error(JSON.stringify({ id: work.id, error: error instanceof FanArtError ? error.code : "worker_operation_failed" }));
            }
          }
          if (iteration + 1 < options.iterations) await delay(options.pollSeconds * 1000);
        }
      } finally { await context.close(); }
    });
  } finally { await pool.end(); }
}
main().catch(error => {
  // Never log connection strings, cookies, credentials or arbitrary provider errors.
  console.error(error instanceof FanArtError ? error.code : "fanart_worker_failed: check explicit configuration and local connection");
  process.exitCode = 1;
});
