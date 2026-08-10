#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const canonicalStoreUrl =
  "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/";
const activeNow = "2026-08-10T12:00:00+09:00";
const endedNow = "2026-09-01T00:00:00+09:00";
let analyticsInterceptCount = 0;

function requireAdminCredentials() {
  const username = process.env.SMOKE_ADMIN_USERNAME || process.env.ADMIN_BASIC_AUTH_USERNAME;
  const secret = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!username || !secret) {
    throw new Error("Complete SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD (or ADMIN_BASIC_AUTH_*) credentials are required");
  }
  return { username, password: secret };
}

async function createSmokeContext(browser, options = {}) {
  const context = await browser.newContext(options);
  await context.route("**/api/analytics/track", async (route) => {
    analyticsInterceptCount += 1;
    await route.fulfill({ status: 204, body: "" });
  });
  return context;
}

async function createClockContext(browser, nowIso, options = {}) {
  const context = await createSmokeContext(browser, options);
  await context.addInitScript((fixedNow) => {
    const OriginalDate = Date;
    class FixedDate extends OriginalDate {
      constructor(...args) {
        super(...(args.length > 0 ? args : [fixedNow]));
      }
      static now() {
        return fixedNow;
      }
    }
    FixedDate.parse = OriginalDate.parse;
    FixedDate.UTC = OriginalDate.UTC;
    globalThis.Date = FixedDate;
  }, Date.parse(nowIso));
  return context;
}

async function goto(page, pathname) {
  return page.goto(new URL(pathname, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
}

async function main() {
  const adminCredentials = requireAdminCredentials();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const activeContext = await createClockContext(browser, activeNow);
    const activePage = await activeContext.newPage();
    await goto(activePage, "/");

    const banner = activePage.locator('[data-promotion-surface="banner"]');
    await banner.waitFor({ state: "visible", timeout: 10_000 });
    const bannerTimer = banner.locator('[role="timer"]');
    assert.equal(await bannerTimer.count(), 1);
    assert.equal(await bannerTimer.getAttribute("aria-live"), "off");
    const bannerLink = banner.locator("a");
    assert.equal(
      await banner.getByRole("link", { name: "팬텀픽에서 보기 새 탭에서 열림" }).count(),
      1
    );
    assert.equal(await bannerLink.getAttribute("href"), canonicalStoreUrl);
    assert.equal(await bannerLink.getAttribute("target"), "_blank");
    assert.match(await bannerLink.getAttribute("rel"), /noopener/);
    assert.match(await bannerLink.getAttribute("rel"), /noreferrer/);
    assert.equal(await bannerLink.getAttribute("data-analytics-menu"), "true");
    assert.equal(
      await bannerLink.getAttribute("data-analytics-id"),
      "moing-summer-atelier-2026:banner"
    );
    assert.equal(
      await bannerLink.getAttribute("data-analytics-label"),
      "팬텀픽에서 보기"
    );
    assert.equal(
      await bannerLink.getAttribute("data-analytics-location"),
      "merch_promotion_banner"
    );
    assert.equal(
      await bannerLink.getAttribute("data-analytics-type"),
      "promotion_cta"
    );

    const card = activePage.locator('[data-promotion-surface="card"]');
    await card.waitFor({ state: "visible", timeout: 10_000 });
    const cardText = await card.innerText();
    for (const expectedText of [
      "여름의 공방 풀세트",
      "77,000원",
      "친필 사인 투명 포토카드 1장 증정",
      "여름의 공방 장패드",
      "30,000원",
      "비키니 모잉 아크릴 스탠드",
      "35,000원",
      "비키니 모잉 캔뱃지",
      "7,500원",
      "여름의 공방 포토카드 세트",
      "7,000원",
      "10월 7일부터 순차 출고 예정",
    ]) {
      assert.match(cardText, new RegExp(expectedText));
    }

    const cardLink = card.getByRole("link", { name: "팬텀픽에서 굿즈 보기 새 탭에서 열림" });
    assert.equal(await cardLink.count(), 1);
    assert.equal(await cardLink.getAttribute("href"), canonicalStoreUrl);
    assert.equal(await cardLink.getAttribute("target"), "_blank");
    assert.match(await cardLink.getAttribute("rel"), /noopener/);
    assert.match(await cardLink.getAttribute("rel"), /noreferrer/);
    assert.equal(await cardLink.getAttribute("data-analytics-menu"), "true");
    assert.equal(
      await cardLink.getAttribute("data-analytics-id"),
      "moing-summer-atelier-2026:card"
    );
    assert.equal(
      await cardLink.getAttribute("data-analytics-location"),
      "merch_promotion_card"
    );
    assert.equal(
      await cardLink.getAttribute("data-analytics-label"),
      "팬텀픽에서 굿즈 보기"
    );
    assert.equal(
      await cardLink.getAttribute("data-analytics-type"),
      "promotion_cta"
    );
    assert.equal(
      await bannerLink.getAttribute("data-analytics-location"),
      "merch_promotion_banner"
    );
    assert.equal(await activePage.locator("#promotion-summer-atelier").count(), 1);

    await banner
      .getByRole("button", { name: "여름의 공방 굿즈 홍보 배너 닫기" })
      .click();
    assert.equal(await banner.count(), 0);
    await goto(activePage, "/broadcasts");
    await activePage.waitForTimeout(300);
    assert.equal(
      await activePage.locator('[data-promotion-surface="banner"]').count(),
      0
    );
    await activeContext.close();

    const mobileContext = await createClockContext(browser, activeNow, {
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();
    await goto(mobilePage, "/");
    const mobileBanner = mobilePage.locator('[data-promotion-surface="banner"]');
    await mobileBanner.waitFor({ state: "visible", timeout: 10_000 });
    const mobileCopyMetrics = await mobileBanner.locator("p").evaluate((element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      return { height: element.getBoundingClientRect().height, lineHeight };
    });
    assert.ok(mobileCopyMetrics.height <= mobileCopyMetrics.lineHeight * 2 + 1);
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const control of [mobileBanner.locator("a"), mobileBanner.locator("button")]) {
      const box = await control.boundingBox();
      assert.ok(box && box.height >= 44);
    }
    await mobileContext.close();

    const routeContext = await createClockContext(browser, activeNow);
    const routePage = await routeContext.newPage();
    await goto(routePage, "/broadcasts");
    await routePage
      .locator('[data-promotion-surface="banner"]')
      .waitFor({ state: "visible", timeout: 3_000 });
    await goto(routePage, "/administrator");
    await routePage
      .locator('[data-promotion-surface="banner"]')
      .waitFor({ state: "visible" });
    await routeContext.close();

    const adminContext = await createSmokeContext(browser, {
      httpCredentials: adminCredentials,
    });
    await adminContext.addInitScript((fixedNow) => {
      const OriginalDate = Date;
      class FixedDate extends OriginalDate {
        constructor(...args) { super(...(args.length ? args : [fixedNow])); }
        static now() { return fixedNow; }
      }
      FixedDate.parse = OriginalDate.parse;
      FixedDate.UTC = OriginalDate.UTC;
      globalThis.Date = FixedDate;
    }, Date.parse(activeNow));
    const adminPage = await adminContext.newPage();
    const adminResponse = await goto(adminPage, "/admin/analytics");
    assert.ok(adminResponse?.ok(), `Authenticated admin returned HTTP ${adminResponse?.status() ?? "unknown"}`);
    await adminPage.getByRole("heading", { name: "Analytics Dashboard", exact: true }).waitFor({ state: "visible" });
    assert.equal(await adminPage.locator('[data-promotion-surface="banner"]').count(), 0);
    await adminContext.close();

    const endedContext = await createClockContext(browser, endedNow);
    const endedPage = await endedContext.newPage();
    await goto(endedPage, "/");
    await endedPage.waitForTimeout(500);
    assert.equal(
      await endedPage.locator('[data-promotion-surface="banner"]').count(),
      0
    );
    assert.equal(
      await endedPage.locator('[data-promotion-surface="card"]').count(),
      0
    );
    await endedContext.close();

    const startBoundaryContext = await createSmokeContext(browser);
    const startBoundaryPage = await startBoundaryContext.newPage();
    const startMs = Date.parse("2026-08-05T19:00:00+09:00");
    const leadMs = 123_456;
    const initialMs = startMs - leadMs;
    await startBoundaryPage.addInitScript(({ initialMs, leadMs }) => {
      const NativeDate = Date;
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      let nowMs = initialMs;
      let advancedSecondEffect = false;
      const records = new Map();
      class MutableDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [nowMs])); }
        static now() { return nowMs; }
      }
      MutableDate.parse = NativeDate.parse;
      MutableDate.UTC = NativeDate.UTC;
      globalThis.Date = MutableDate;
      window.setTimeout = (callback, delay = 0, ...args) => {
        const createdAt = nowMs;
        if (createdAt >= initialMs && createdAt <= initialMs + 100 && delay >= leadMs - 100 && delay <= leadMs) {
          const token = records.size + 1;
          const record = { token, nativeId: null, callback, args, createdAt, delay, dueAt: createdAt + delay, cancelled: false };
          record.nativeId = nativeSetTimeout(() => {}, delay);
          records.set(record.nativeId, record);
          if (!advancedSecondEffect) { advancedSecondEffect = true; nowMs += 100; }
          return record.nativeId;
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      window.clearTimeout = (id) => {
        const record = records.get(id);
        if (record) { record.cancelled = true; records.delete(id); nativeClearTimeout(record.nativeId); }
        else nativeClearTimeout(id);
      };
      globalThis.__promotionBoundaryProbe = {
        records: () => [...records.values()].filter((record) => !record.cancelled).map(({ token, createdAt, delay, dueAt }) => ({ token, createdAt, delay, dueAt })),
        advanceTo: (targetMs) => {
          nowMs = targetMs;
          for (const record of [...records.values()]) {
            if (!record.cancelled && record.dueAt <= nowMs) {
              records.delete(record.nativeId);
              nativeClearTimeout(record.nativeId);
              if (!record.cancelled) record.callback(...record.args);
            }
          }
        },
      };
    }, { initialMs, leadMs });
    await goto(startBoundaryPage, "/");
    await startBoundaryPage.waitForFunction(() => globalThis.__promotionBoundaryProbe.records().length === 2);
    const records = await startBoundaryPage.evaluate(() => globalThis.__promotionBoundaryProbe.records());
    assert.deepEqual(records.map((record) => record.dueAt), [startMs, startMs]);
    assert.deepEqual(records.map((record) => [record.createdAt, record.delay]), [[initialMs, leadMs], [initialMs + 100, leadMs - 100]]);
    assert.equal(
      await startBoundaryPage.evaluate((delay) => {
        const id = window.setTimeout(() => {}, delay);
        window.clearTimeout(id);
        return globalThis.__promotionBoundaryProbe.records().length;
      }, leadMs),
      2
    );
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="banner"]').count(), 0);
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="card"]').count(), 0);
    await startBoundaryPage.evaluate((delay) => {
      globalThis.__promotionCancellationProbe = [];
      let secondId;
      window.setTimeout(() => { globalThis.__promotionCancellationProbe.push("canceler"); window.clearTimeout(secondId); }, delay);
      secondId = window.setTimeout(() => globalThis.__promotionCancellationProbe.push("second"), delay);
    }, leadMs - 100);
    await startBoundaryPage.evaluate((targetMs) => globalThis.__promotionBoundaryProbe.advanceTo(targetMs), startMs - 1_000);
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="banner"]').count(), 0);
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="card"]').count(), 0);
    await startBoundaryPage.evaluate((targetMs) => globalThis.__promotionBoundaryProbe.advanceTo(targetMs), startMs - 1);
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="banner"]').count(), 0);
    assert.equal(await startBoundaryPage.locator('[data-promotion-surface="card"]').count(), 0);
    await startBoundaryPage.evaluate((targetMs) => globalThis.__promotionBoundaryProbe.advanceTo(targetMs), startMs);
    assert.deepEqual(await startBoundaryPage.evaluate(() => globalThis.__promotionCancellationProbe), ["canceler"]);
    await startBoundaryPage.locator('[data-promotion-surface="banner"]').waitFor({ state: "visible", timeout: 3_000 });
    await startBoundaryPage.locator('[data-promotion-surface="card"]').waitFor({ state: "visible", timeout: 3_000 });
    await startBoundaryContext.close();

    const endBoundaryContext = await createSmokeContext(browser);
    const endBoundaryPage = await endBoundaryContext.newPage();
    await endBoundaryPage.clock.install({ time: Date.parse("2026-08-31T23:59:59+09:00") });
    await goto(endBoundaryPage, "/");
    await endBoundaryPage.locator('[data-promotion-surface="banner"]').waitFor({ state: "visible", timeout: 3_000 });
    await endBoundaryPage.locator('[data-promotion-surface="card"]').waitFor({ state: "visible", timeout: 3_000 });
    await endBoundaryPage.clock.fastForward(1_000);
    await endBoundaryPage.waitForTimeout(0);
    assert.equal(await endBoundaryPage.locator('[data-promotion-surface="banner"]').count(), 0);
    assert.equal(await endBoundaryPage.locator('[data-promotion-surface="card"]').count(), 0);
    await endBoundaryContext.close();
    assert.ok(analyticsInterceptCount > 0, "Expected at least one analytics tracking request to be intercepted");
  } finally {
    await browser.close();
  }

  console.log("merch promotion smoke ok");
}

main().catch((error) => {
  console.error("[smoke-merch-promotion] failed:", error);
  process.exit(1);
});
