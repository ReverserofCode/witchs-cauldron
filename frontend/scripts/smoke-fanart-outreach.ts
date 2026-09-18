import assert from "node:assert/strict";
import { chromium } from "playwright";
import { Pool } from "pg";
import sharp from "sharp";
import { createFanArtAssetStore } from "../app/lib/fanart/assets";
import { createFanArtRepository } from "../app/lib/fanart/repository";
import { createOutreachService, type CafeSnapshot } from "../app/lib/fanart/outreach";
import { normalizeSourceUrl } from "../app/lib/fanart/model";

async function main() {
  const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3169";
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname));
  assert.equal(process.env.FANART_SMOKE_ALLOW_WRITES, "true", "disposable local DB acknowledgment required");
  const database = new URL(process.env.FANART_DATABASE_URL ?? "");
  assert.ok(["postgres:", "postgresql:"].includes(database.protocol));
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(database.hostname));
  assert.equal(database.pathname, "/fanart_test");
  assert.ok(process.env.FANART_ASSETS_DIR, "share the disposable server's private asset directory");
  const pool = new Pool({ connectionString: database.href });
  const repository = createFanArtRepository(pool);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ httpCredentials: {
    username: process.env.ADMIN_BASIC_AUTH_USERNAME ?? "fanart-admin",
    password: process.env.ADMIN_BASIC_AUTH_PASSWORD ?? "fanart-local-only",
  } });
  // The browser visits only the disposable app. Naver is a service fixture,
  // and the separate provider tests validate its DOM adapter with interception.
  await context.route("**/*", route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const panel = page.getByRole("region", { name: "카페 허락 요청 자동화", exact: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const stamp = String(Date.now());
  const sourceUrl = `https://cafe.naver.com/moinge/${stamp}`;
  const title = `자동 요청 UI 테스트 ${stamp}`;
  let loggedIn = true;
  let sends = 0;
  const snapshot: CafeSnapshot = {
    sourceUrl, title, authorId: "fixture-artist", boardId: "38", fingerprint: "fixture-original",
    images: [{ id: "fixture-image", url: "https://cafeptthumb-phinf.pstatic.net/fixture.png" }], comments: [],
  };
  const service = createOutreachService({ repository, assets: createFanArtAssetStore(process.env.FANART_ASSETS_DIR),
    provider: {
      inspect: async () => { assert.ok(loggedIn, "fixture requires logged-in operator"); return structuredClone(snapshot); },
      sendRequest: async (_url, text, marker) => {
        assert.ok(loggedIn); assert.ok(!text.includes("[moingfans:")); sends++;
        snapshot.comments.push({ id: "fixture-request", parentId: null, authorId: "fixture-operator", text: `${text}\n\n${marker}` });
        return { commentId: "fixture-request" };
      },
    },
    downloadImage: async () => sharp({ create: { width: 120, height: 160, channels: 3, background: "purple" } }).png().toBuffer(),
  });
  try {
    assert.equal((await fetch(`${base}/api/admin/fanart`)).status, 401);
    await page.goto(`${base}/admin/fanart`);
    await page.getByLabel("원문 URL", { exact: true }).fill(sourceUrl);
    await page.getByLabel("작품 제목", { exact: true }).fill(title);
    await page.getByLabel("작가 표기명", { exact: true }).fill("자체 테스트 작가");
    await page.getByRole("button", { name: "후보 등록", exact: true }).click();
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await page.getByRole("button", { name: "허락 요청 대기열에 추가", exact: true }).click();
    await page.getByText("요청 전송 대기", { exact: true }).waitFor();
    const works = await repository.list({ limit: 100, offset: 0 });
    const work = works.works.find(candidate => candidate.sourceKey === normalizeSourceUrl(sourceUrl).sourceKey);
    assert.ok(work);
    const id = work.id;
    const current = async () => { const value = await repository.get(id); assert.ok(value); return value; };
    const refresh = async () => {
      await page.getByRole("button", { name: "상세 새로고침", exact: true }).click();
    };
    await service.tick(id, { allowComments: true });
    await service.tick(id, { allowComments: true });
    assert.equal(sends, 1);
    snapshot.comments.push({ id: "fixture-reply", parentId: "fixture-request", authorId: "fixture-artist", text: "직접 만든 도형이며 표시, 변환, 출처표기를 허락합니다." });
    await service.tick(id, { allowComments: false });
    await refresh();
    await page.getByLabel("우리 요청에 달린 원작자 답변").selectOption("fixture-reply");
    await page.getByLabel("허락받은 정확한 원본 이미지").selectOption("fixture-image");
    const confirm = page.getByRole("button", { name: "검토 기록 저장·이미지 준비 요청", exact: true });
    assert.equal(await confirm.isDisabled(), true);
    for (const label of ["사이트 표시 허락", "크기 조정·WebP 변환 허락", "작가명·원문 링크 표기 허락", "원작자의 비생성형 제작 확인 및 운영자 검수"]) {
      await panel.getByLabel(label, { exact: true }).check();
    }
    await confirm.click();
    await page.getByText("비공개 이미지 준비 대기", { exact: true }).waitFor();
    await service.tick(id, { allowComments: false });
    const prepared = await current();
    assert.equal(prepared.outreach?.status, "prepared");
    assert.ok(prepared.asset);
    const preview = `/api/admin/fanart/${id}/outreach/preview?sha256=${prepared.asset.sha256}`;
    assert.equal((await fetch(`${base}${preview}`)).status, 401);
    await refresh();
    await page.getByRole("img", { name: "최종 게시 승인할 비공개 준비 이미지", exact: true }).waitFor();
    const approve = page.getByRole("button", { name: "이 이미지 최종 승인·게시 요청", exact: true });
    assert.equal(await approve.isDisabled(), true);
    await page.getByLabel("위 이미지가 작가에게 허락받은 정확한 작품임을 확인했습니다.", { exact: true }).check();
    await approve.click();
    await page.getByText("원문 재검증·게시 대기", { exact: true }).waitFor();
    loggedIn = false;
    await assert.rejects(service.tick(id, { allowComments: false }), /logged-in/);
    assert.notEqual((await current()).status, "published", "expired login must not publish");
    loggedIn = true;
    await service.tick(id, { allowComments: false });
    const response = await context.request.get(`${base}/api/fanart`);
    const published = (await response.json()).images.find((image: { id: string }) => image.id === id);
    assert.ok(published);
    assert.deepEqual(Object.keys(published).sort(), ["alt", "credit", "id", "publishedAt", "sourceUrl", "src"]);
    assert.equal((await context.request.get(`${base}${published.src}`)).status(), 200);
    await refresh();
    page.once("dialog", dialog => void dialog.accept());
    await page.getByRole("button", { name: "게시 철회", exact: true }).click();
    await page.getByText("게시를 철회했습니다.", { exact: true }).waitFor();
    assert.equal((await context.request.get(`${base}${published.src}`)).status(), 404);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
    console.log("PASS outreach UI: queue, one fixture request, author reply, permission, private preview auth, exact approval, expired-login block, publish six-field API, withdraw, mobile");
  } finally { await browser.close(); await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
