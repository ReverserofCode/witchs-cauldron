import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFanArtRepository } from "./repository";
import { createFanArtAssetStore } from "./assets";
import { publicImage, rejectWork, withdrawWork } from "./model";
import { createOutreachService, type CafeSnapshot } from "./outreach";
import { createOutreachSendGuard, withOutreachWorkerLock } from "./outreach-worker";
import { createOutreachHandlers } from "./outreach-handlers";
import { createFanArtHandlers } from "./handlers";

const url = process.env.FANART_TEST_DATABASE_URL ?? "";
if (url) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) || parsed.pathname !== "/fanart_test") throw new Error("Test database must be loopback /fanart_test");
}
const NOW = "2026-09-18T01:00:00.000Z";
describe.skipIf(!url)("durable fanart outreach", () => {
  let control: Pool;
  let pool: Pool;
  let schema: string;
  let directory: string;
  beforeAll(async () => {
    schema = `fanart_test_${randomUUID().replace(/-/g, "")}`;
    control = new Pool({ connectionString: url });
    await control.query(`CREATE SCHEMA "${schema}"`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    pool = new Pool({ connectionString: scoped.toString(), max: 8 });
    directory = await mkdtemp(join(tmpdir(), "fanart-outreach-"));
  });
  afterAll(async () => {
    await pool?.end();
    if (schema) await control.query(`DROP SCHEMA "${schema}" CASCADE`);
    await control?.end();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  async function setup() {
    const repository = createFanArtRepository(pool);
    const work = await repository.create({ sourceUrl: `https://cafe.naver.com/moinge/${Date.now()}${Math.floor(Math.random() * 10000)}`, title: "그림", credit: "작가" }, NOW);
    const snapshot: CafeSnapshot = { sourceUrl: work.sourceUrl, title: "그림", boardId: "38", authorId: "artist", fingerprint: "original-v1", images: [{ id: "image1", url: "https://cafeptthumb-phinf.pstatic.net/image.png" }], comments: [] };
    let sends = 0;
    let sendFailure = false;
    let inspectHook = async () => {};
    const provider = {
      inspect: async () => { await inspectHook(); return structuredClone(snapshot); },
      sendRequest: async (_sourceUrl: string, text: string, marker: string) => { sends++; if (text.includes("[moingfans:") || marker !== `[moingfans:${work.id}]`) throw new Error("Invalid provider marker contract"); if (sendFailure) throw new Error("timeout"); return { commentId: "our-comment" }; },
    };
    const assets = createFanArtAssetStore(directory);
    const downloadImage = async () => sharp({ create: { width: 20, height: 20, channels: 3, background: "purple" } }).png().toBuffer();
    const service = createOutreachService({ repository, assets, provider, downloadImage, now: () => NOW });
    const get = async () => (await repository.get(work.id))!;
    const send = async () => { await service.enqueue(work.id, work.version); await service.tick(work.id, { allowComments: true }); };
    const reply = () => snapshot.comments.push({ id: "reply", parentId: "our-comment", authorId: "artist", text: "표시·크기조정·출처표시 허락, 직접 그렸습니다." });
    const confirm = async () => service.confirm(work.id, (await get()).version, { replyId: "reply", imageId: "image1", display: true, resize: true, credit: true, nonAi: true });
    const prepare = async () => { await send(); reply(); await service.tick(work.id, { allowComments: false }); await confirm(); await service.tick(work.id, { allowComments: false }); };
    return { repository, work, snapshot, provider, assets, service, get, send, reply, confirm, prepare, sends: () => sends, timeout: () => { sendFailure = true; }, onInspect: (hook: () => Promise<void>) => { inspectHook = hook; } };
  }
  it("queues once; disabled comments do not send or grant consent", async () => {
    const f = await setup();
    const queued = await f.service.enqueue(f.work.id, 1);
    await expect(f.service.enqueue(f.work.id, queued.version)).rejects.toMatchObject({ code: "already_queued" });
    await f.service.tick(f.work.id, { allowComments: false });
    expect((await f.get()).outreach?.status).toBe("queued");
    expect(f.sends()).toBe(0);
    await f.service.tick(f.work.id, { allowComments: true });
    await f.service.tick(f.work.id, { allowComments: true });
    expect(f.sends()).toBe(1);
    expect((await f.get()).permission.display).toBe(false);
  });
  it("persists account interval, daily cap and per-run limit across restarts", async () => {
    let clock = Date.parse(NOW);
    const account = randomUUID();
    const options = { operatorMemberKey: account, limit: 5, stopFile: join(directory, "stop"), now: () => new Date(clock) };
    const first = createOutreachSendGuard(pool, options);
    await first();
    await expect(createOutreachSendGuard(pool, options)()).rejects.toMatchObject({ code: "rate_limited" });
    for (let index = 1; index < 5; index++) { clock += 60001; await first(); }
    clock += 60001;
    await expect(first()).rejects.toMatchObject({ code: "run_limit" });
    const second = createOutreachSendGuard(pool, options);
    for (let index = 0; index < 5; index++) { clock += 60001; await second(); }
    clock += 60001;
    await expect(createOutreachSendGuard(pool, options)()).rejects.toMatchObject({ code: "daily_limit" });
  });
  it("advisory lock excludes another standalone worker", async () => {
    await withOutreachWorkerLock(pool, async () => {
      await expect(withOutreachWorkerLock(pool, async () => null)).rejects.toMatchObject({ code: "worker_locked" });
    });
    await expect(withOutreachWorkerLock(pool, async () => "released")).resolves.toBe("released");
  });
  it.each([{ boardId: "39" }, { title: "[AI] 그림" }, { authorId: "" }, { images: [] }])("rejects ineligible source %j before sending", async (change) => {
    const f = await setup(); Object.assign(f.snapshot, change);
    await f.service.enqueue(f.work.id, 1);
    await expect(f.service.tick(f.work.id, { allowComments: true })).rejects.toMatchObject({ code: "ineligible_source" });
    expect(f.sends()).toBe(0);
  });
  it("does not infer permission from unrelated author or non-thread replies", async () => {
    const f = await setup(); await f.send(); f.reply();
    f.snapshot.comments[0].authorId = "stranger";
    await f.service.tick(f.work.id, { allowComments: false });
    await expect(f.confirm()).rejects.toMatchObject({ code: "invalid_reply" });
    f.snapshot.comments[0].authorId = "artist"; f.snapshot.comments[0].parentId = null;
    await f.service.tick(f.work.id, { allowComments: false });
    await expect(f.confirm()).rejects.toMatchObject({ code: "invalid_reply" });
    expect((await f.get()).permission.display).toBe(false);
  });
  it("holds timeout and persisted claim across service restart without resending", async () => {
    const f = await setup(); f.timeout(); await f.send();
    expect((await f.get()).outreach?.status).toBe("uncertain");
    const restarted = createOutreachService({ repository: createFanArtRepository(pool), assets: f.assets, provider: f.provider });
    await restarted.tick(f.work.id, { allowComments: true });
    expect(f.sends()).toBe(1);
  });
  it("concurrent workers acquire only one durable send claim", async () => {
    const f = await setup(); await f.service.enqueue(f.work.id, 1);
    const second = createOutreachService({ repository: createFanArtRepository(pool), assets: f.assets, provider: f.provider });
    await Promise.allSettled([f.service.tick(f.work.id, { allowComments: true }), second.tick(f.work.id, { allowComments: true })]);
    expect(f.sends()).toBe(1);
  });
  it("cancelled and rejected works never send or mutate", async () => {
    for (const cancel of [true, false]) {
      const f = await setup(); const queued = await f.service.enqueue(f.work.id, 1);
      if (cancel) await f.service.cancel(f.work.id, queued.version);
      else await f.repository.update(f.work.id, queued.version, work => rejectWork(work, NOW));
      const before = await f.get(); await f.service.tick(f.work.id, { allowComments: true });
      expect(await f.get()).toEqual(before); expect(f.sends()).toBe(0);
    }
  });
  it("cancellation while inspecting prevents the send", async () => {
    const f = await setup(); await f.service.enqueue(f.work.id, 1);
    f.onInspect(async () => { const work = await f.get(); await f.service.cancel(work.id, work.version); });
    await expect(f.service.tick(f.work.id, { allowComments: true })).rejects.toMatchObject({ code: "version_conflict" });
    expect(f.sends()).toBe(0);
  });
  it("changed reply invalidates preparation and exact-image approval", async () => {
    const f = await setup(); await f.prepare();
    const prepared = await f.get();
    await f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256);
    f.snapshot.comments[0].text = "허락을 취소합니다";
    await f.service.tick(f.work.id, { allowComments: false });
    const invalidated = await f.get();
    expect(invalidated.outreach?.status).toBe("needs_review");
    expect(invalidated.permission.display).toBe(false);
    expect(invalidated.status).not.toBe("published");
  });
  it.each(["preparation", "publication"])("new author reply invalidates consent before %s", async stage => {
    const f = await setup();
    if (stage === "preparation") {
      await f.send(); f.reply(); await f.service.tick(f.work.id, { allowComments: false }); await f.confirm();
    } else {
      await f.prepare(); const prepared = await f.get(); await f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256);
    }
    f.snapshot.comments.push({ id: "revoke", parentId: "our-comment", authorId: "artist", text: "Permission withdrawn. Do not publish." });
    const stale = await f.get();
    await f.service.tick(f.work.id, { allowComments: false });
    const after = await f.get();
    expect(after.outreach?.status).toBe("needs_review"); expect(after.permission.display).toBe(false);
    expect(after.outreach?.confirmation).toBeUndefined(); expect(after.outreach?.approvedPreparedHash).toBeUndefined();
    expect(after.status).not.toBe("published");
    if (stage === "preparation") expect(after.asset).toBeNull();
    else {
      await expect(f.service.approve(f.work.id, after.version, stale.asset!.sha256)).rejects.toMatchObject({ code: "not_ready" });
      const config = { username: "test", password: "test-only", origin: "https://example.test" };
      const handlers = createOutreachHandlers({ config, getRepository: async () => f.repository, assets: f.assets });
      const request = new Request(`https://example.test/preview?sha256=${stale.asset!.sha256}`, { headers: { authorization: `Basic ${Buffer.from("test:test-only").toString("base64")}` } });
      expect((await handlers.preview(request, f.work.id)).status).toBe(404);
    }
  });
  it.each(["edit", "delete"])("invalidates changes to an unselected original-author reply: %s", async action => {
    const f = await setup(); await f.send(); f.reply();
    f.snapshot.comments.push({ id: "other", parentId: "our-comment", authorId: "artist", text: "Additional original condition" });
    await f.service.tick(f.work.id, { allowComments: false }); await f.confirm();
    if (action === "edit") f.snapshot.comments[1].text = "Changed condition";
    else f.snapshot.comments.splice(1, 1);
    await f.service.tick(f.work.id, { allowComments: false });
    expect((await f.get()).outreach?.status).toBe("needs_review"); expect((await f.get()).asset).toBeNull();
  });
  it("keeps confirmation valid across order-only and unrelated-comment changes", async () => {
    const f = await setup(); await f.send(); f.reply();
    f.snapshot.comments.push({ id: "other", parentId: "our-comment", authorId: "artist", text: "Additional condition" });
    await f.service.tick(f.work.id, { allowComments: false }); await f.confirm();
    f.snapshot.comments.reverse();
    f.snapshot.comments.push({ id: "visitor", parentId: "our-comment", authorId: "visitor", text: "Untrusted unrelated text" });
    f.snapshot.comments.push({ id: "other-thread", parentId: "elsewhere", authorId: "artist", text: "Other conversation" });
    await f.service.tick(f.work.id, { allowComments: false });
    expect((await f.get()).outreach?.status).toBe("prepared");
  });
  it("fails closed for legacy confirmation without an author reply-set digest", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    const legacy = await f.repository.update(prepared.id, prepared.version, work => {
      const confirmation = { ...work.outreach!.confirmation! };
      delete confirmation.authorReplySetDigest;
      return { ...work, outreach: { ...work.outreach!, confirmation } };
    });
    await expect(f.service.approve(legacy.id, legacy.version, legacy.asset!.sha256)).rejects.toMatchObject({ code: "not_ready" });
    await f.service.tick(legacy.id, { allowComments: false });
    expect((await f.get()).outreach?.status).toBe("needs_review");
  });
  it("binds exact prepared hash and atomically publishes only after final approval", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    expect(prepared.outreach?.status).toBe("prepared");
    await expect(f.service.approve(f.work.id, prepared.version, "a".repeat(64))).rejects.toMatchObject({ code: "invalid_asset" });
    const queued = await f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256);
    expect(queued.status).not.toBe("published");
    await f.service.tick(f.work.id, { allowComments: false });
    const published = await f.get(); expect(published.status).toBe("published");
    expect(Object.keys(publicImage(published)).sort()).toEqual(["alt", "credit", "id", "publishedAt", "sourceUrl", "src"]);
    await f.repository.update(published.id, published.version, work => withdrawWork(work, NOW));
    const withdrawn = await f.get(); await f.service.tick(f.work.id, { allowComments: true }); expect(await f.get()).toEqual(withdrawn);
  });
  it("rejection during image preparation prevents asset attachment", async () => {
    const f = await setup(); await f.send(); f.reply(); await f.service.tick(f.work.id, { allowComments: false }); await f.confirm();
    const service = createOutreachService({ repository: f.repository, assets: f.assets, provider: f.provider, downloadImage: async () => {
      const work = await f.get(); await f.repository.update(work.id, work.version, current => rejectWork(current, NOW));
      return sharp({ create: { width: 20, height: 20, channels: 3, background: "purple" } }).png().toBuffer();
    } });
    await expect(service.tick(f.work.id, { allowComments: false })).rejects.toMatchObject({ code: "version_conflict" });
    expect((await f.get()).asset).toBeNull();
  });
  it("fails closed when login expires before preparation or publication", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    await f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256);
    const before = await f.get(); f.onInspect(async () => { throw new Error("login_required"); });
    await expect(f.service.tick(f.work.id, { allowComments: false })).rejects.toThrow("login_required");
    expect(await f.get()).toEqual(before);
  });
  it("never attaches a confirmation when concurrent rejection wins", async () => {
    const f = await setup(); await f.send(); f.reply(); await f.service.tick(f.work.id, { allowComments: false });
    const before = await f.get(); await f.service.reject(before.id, before.version);
    await expect(f.service.confirm(before.id, before.version, { replyId: "reply", imageId: "image1", display: true, resize: true, credit: true, nonAi: true })).rejects.toMatchObject({ code: "version_conflict" });
    expect((await f.get()).permission.display).toBe(false);
  });
  it("stop file prevents even the first attempt from reserving/sending", async () => {
    const f = await setup(); await f.service.enqueue(f.work.id, 1);
    const stopFile = join(directory, randomUUID()); await writeFile(stopFile, "stop");
    const beforeSend = createOutreachSendGuard(pool, { operatorMemberKey: randomUUID(), limit: 1, stopFile });
    await expect(f.service.tick(f.work.id, { allowComments: true, beforeSend })).rejects.toMatchObject({ code: "worker_stopped" });
    expect(f.sends()).toBe(0); expect((await f.get()).outreach?.status).toBe("queued");
  });
  it("serves only authenticated exact prepared bytes and removes preview on rejection", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    const config = { username: "test", password: "test-only", origin: "https://example.test" };
    const handlers = createOutreachHandlers({ config, getRepository: async () => f.repository, assets: f.assets });
    const request = (hash: string, authenticated = true) => new Request(`https://example.test/api/outreach/preview?sha256=${hash}`, { headers: authenticated ? { authorization: `Basic ${Buffer.from("test:test-only").toString("base64")}` } : {} });
    expect((await handlers.preview(request(prepared.asset!.sha256, false), f.work.id)).status).toBe(401);
    expect((await handlers.preview(request("bad-hash"), f.work.id)).status).toBe(404);
    const response = await handlers.preview(request(prepared.asset!.sha256), f.work.id);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(await f.assets.readVerified(prepared.asset!));
    await f.service.reject(f.work.id, prepared.version);
    expect((await handlers.preview(request(prepared.asset!.sha256), f.work.id)).status).toBe(404);
  });
  it("manual review and publication endpoints cannot bypass outreach bindings", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    const config = { username: "test", password: "test-only", origin: "https://example.test" };
    const handlers = createFanArtHandlers({ config, getRepository: async () => f.repository, assets: f.assets });
    const request = (body: unknown) => new Request("https://example.test/api/manual", { method: "POST", headers: { origin: config.origin, authorization: `Basic ${Buffer.from("test:test-only").toString("base64")}` }, body: JSON.stringify(body) });
    expect((await handlers.publish(request({ version: prepared.version }), prepared.id)).status).toBe(409);
    const review = { requested: true, permission: prepared.permission, review: prepared.review };
    expect((await handlers.review(request({ version: prepared.version, review }), prepared.id)).status).toBe(409);
    expect(await f.get()).toEqual(prepared);
  });
  it("a crashed sender's durable claim is never retried", async () => {
    const f = await setup(); const queued = await f.service.enqueue(f.work.id, 1);
    await f.repository.update(f.work.id, queued.version, work => ({ ...work, outreach: { ...work.outreach!, status: "sending", attemptedAt: NOW } }));
    const before = await f.get();
    await f.service.tick(f.work.id, { allowComments: true });
    expect(await f.get()).toEqual(before); expect(f.sends()).toBe(0);
  });
  it("rejects publication when rejection wins after file verification", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    const queued = await f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256);
    await expect(f.service.tick(f.work.id, { allowComments: false, beforePublish: async () => { await f.service.reject(f.work.id, queued.version); } })).rejects.toMatchObject({ code: "version_conflict" });
    expect((await f.get()).status).toBe("rejected"); expect(await f.repository.published()).not.toContainEqual(expect.objectContaining({ id: f.work.id }));
  });
  it("detects tampered private bytes before final approval", async () => {
    const f = await setup(); await f.prepare(); const prepared = await f.get();
    await writeFile(join(directory, prepared.asset!.key), "tampered image");
    await expect(f.service.approve(f.work.id, prepared.version, prepared.asset!.sha256)).rejects.toMatchObject({ code: "invalid_asset" });
    expect(await f.get()).toEqual(prepared);
  });
});
