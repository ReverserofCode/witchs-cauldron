import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { applyReview, attachAsset, publishWork, rejectWork, withdrawWork, type ReviewInput } from "./model";
import { createFanArtRepository } from "./repository";

const testDatabaseUrl = process.env.FANART_TEST_DATABASE_URL?.trim() ?? "";

function safeTestDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:")
      && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      && url.pathname === "/fanart_test";
  } catch {
    return false;
  }
}

if (testDatabaseUrl && !safeTestDatabaseUrl(testDatabaseUrl)) {
  throw new Error("FANART_TEST_DATABASE_URL must target loopback database fanart_test");
}

const describeDatabase = testDatabaseUrl ? describe : describe.skip;
const NOW = "2026-09-18T00:00:00.000Z";
const REVIEWED = "2026-09-18T01:00:00.000Z";
const UPLOADED = "2026-09-18T02:00:00.000Z";
const PUBLISHED = "2026-09-18T03:00:00.000Z";
const confirmed: ReviewInput = {
  requested: true,
  permission: {
    display: true,
    resize: true,
    credit: true,
    confirmedAt: REVIEWED,
    evidence: "minimal evidence reference",
  },
  review: {
    status: "confirmed_non_generative",
    confirmedAt: REVIEWED,
    note: "creator assertion and operator review confirmed",
  },
};
const asset = {
  key: "e53a3531-9fa8-4ff0-a213-76010365f508.webp",
  sha256: "a".repeat(64),
  bytes: 1024,
  width: 800,
  height: 1200,
};

describe("fanart schema initialization", () => {
  it("retries after an initialization failure instead of caching the rejection", async () => {
    let failOnce = true;
    const client = {
      release: vi.fn(),
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_advisory_xact_lock") && failOnce) {
          failOnce = false;
          throw new Error("temporary schema failure");
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    } as unknown as Pool;
    const repository = createFanArtRepository(pool);

    await expect(repository.list({ limit: 1 })).rejects.toThrow("temporary schema failure");
    await expect(repository.list({ limit: 1 })).resolves.toEqual({ works: [], hasMore: false });
    expect(pool.connect).toHaveBeenCalledTimes(2);
  });
});

describeDatabase("fanart PostgreSQL repository", () => {
  let controlPool: Pool;
  let pool: Pool;
  let schema: string;

  beforeAll(async () => {
    schema = `fanart_test_${randomUUID().replace(/-/g, "")}`;
    controlPool = new Pool({ connectionString: testDatabaseUrl, max: 2 });
    await controlPool.query(`CREATE SCHEMA "${schema}"`);
    const scoped = new URL(testDatabaseUrl);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    pool = new Pool({ connectionString: scoped.toString(), max: 6 });
  });

  afterAll(async () => {
    if (pool) await pool.end();
    if (controlPool && schema) {
      await controlPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await controlPool.end();
    }
  });

  it("creates dedicated tables and indexes without touching analytics tables", async () => {
    const repository = createFanArtRepository(pool);
    await repository.list({ limit: 10, offset: 0 });

    const relations = await pool.query<{ name: string | null }>(`
      SELECT to_regclass(name)::text AS name
      FROM unnest(ARRAY[
        'fanart_works', 'fanart_audit_events', 'analytics_events'
      ]) AS name
    `);
    expect(relations.rows.map((row) => row.name)).toEqual([
      "fanart_works",
      "fanart_audit_events",
      null,
    ]);

    const indexes = await pool.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'fanart_works'",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      "fanart_works_source_key_key",
      "fanart_works_status_idx",
      "fanart_works_published_at_idx",
    ]));
  });

  it("deduplicates canonical source variants and keeps the source key after terminal rejection", async () => {
    const repository = createFanArtRepository(pool);
    const article = String(Date.now());
    const created = await repository.create({
      sourceUrl: `https://cafe.naver.com/moinge/${article}?one=1`,
      title: "first",
      credit: "artist",
    }, NOW);
    const rejected = await repository.update(created.id, created.version, (current) => rejectWork(current, REVIEWED));

    expect(rejected.status).toBe("rejected");
    await expect(repository.create({
      sourceUrl: `https://cafe.naver.com/f-e/cafes/30182989/articles/${article}`,
      title: "duplicate",
      credit: "artist",
    }, REVIEWED)).rejects.toMatchObject({ status: 409, code: "duplicate_source" });
  });

  it("serializes concurrent updates from two repository instances and returns one conflict", async () => {
    const firstRepository = createFanArtRepository(pool);
    const secondRepository = createFanArtRepository(pool);
    const article = String(Date.now() + 1);
    const work = await firstRepository.create({
      sourceUrl: `https://cafe.naver.com/moinge/${article}`,
      title: "concurrency",
      credit: "artist",
    }, NOW);

    const outcomes = await Promise.allSettled([
      firstRepository.update(work.id, work.version, (current) => applyReview(current, confirmed, REVIEWED)),
      secondRepository.update(work.id, work.version, (current) => applyReview(current, confirmed, REVIEWED)),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 409, code: "version_conflict" } });

    const persisted = await firstRepository.get(work.id);
    expect(persisted?.version).toBe(2);
    expect((await firstRepository.audit(work.id)).map((event) => event.type)).toEqual(["created", "review_updated"]);
  });

  it("writes work and audit atomically and leaves both unchanged when an operation fails", async () => {
    const repository = createFanArtRepository(pool);
    const article = String(Date.now() + 2);
    const work = await repository.create({
      sourceUrl: `https://cafe.naver.com/moinge/${article}`,
      title: "atomic",
      credit: "artist",
    }, NOW);

    await expect(repository.update(work.id, work.version, () => {
      throw new Error("operation failed");
    })).rejects.toThrow("operation failed");

    expect(await repository.get(work.id)).toEqual(work);
    expect(await repository.audit(work.id)).toHaveLength(1);
  });

  it("allows idempotent publication and withdrawal retries with stale versions", async () => {
    const firstRepository = createFanArtRepository(pool);
    const retryingRepository = createFanArtRepository(pool);
    const article = String(Date.now() + 3);
    let work = await firstRepository.create({
      sourceUrl: `https://cafe.naver.com/moinge/${article}`,
      title: "idempotent",
      credit: "artist",
    }, NOW);
    work = await firstRepository.update(work.id, work.version, (current) => applyReview(current, confirmed, REVIEWED));
    work = await firstRepository.update(work.id, work.version, (current) => attachAsset(current, asset, UPLOADED));

    const prePublishVersion = work.version;
    const published = await firstRepository.update(work.id, prePublishVersion, (current) => publishWork(current, PUBLISHED));
    const publishedRetry = await retryingRepository.update(work.id, prePublishVersion, (current) => publishWork(current, PUBLISHED));
    expect(publishedRetry).toEqual(published);

    const preWithdrawVersion = published.version;
    const withdrawn = await firstRepository.update(published.id, preWithdrawVersion, (current) => withdrawWork(current, "2026-09-18T04:00:00.000Z"));
    const withdrawnRetry = await retryingRepository.update(published.id, preWithdrawVersion, (current) => withdrawWork(current, "2026-09-18T05:00:00.000Z"));
    expect(withdrawnRetry).toEqual(withdrawn);

    expect((await firstRepository.audit(work.id)).map((event) => event.type)).toEqual([
      "created",
      "review_updated",
      "asset_attached",
      "published",
      "withdrawn",
    ]);
  });

  it("returns only current published records newest first", async () => {
    const repository = createFanArtRepository(pool);
    const publicWorks = await repository.published();

    expect(publicWorks.every((work) => work.status === "published")).toBe(true);
    expect(publicWorks.map((work) => work.publishedAt)).toEqual(
      [...publicWorks.map((work) => work.publishedAt)].sort().reverse(),
    );
  });
});
