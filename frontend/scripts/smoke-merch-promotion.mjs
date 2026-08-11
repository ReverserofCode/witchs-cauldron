#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const canonicalStoreUrl =
  "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/";
const officialProducts = Object.freeze([
  Object.freeze({
    id: "full-set",
    name: "여름의 공방 풀세트",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%92%80%EC%84%B8%ED%8A%B8/375/",
  }),
  Object.freeze({
    id: "desk-mat",
    name: "여름의 공방 장패드",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%EC%9E%A5%ED%8C%A8%EB%93%9C/376/",
  }),
  Object.freeze({
    id: "acrylic-stand",
    name: "비키니 모잉 아크릴 스탠드",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%95%84%ED%81%AC%EB%A6%B4-%EC%8A%A4%ED%83%A0%EB%93%9C/377/",
  }),
  Object.freeze({
    id: "can-badge",
    name: "비키니 모잉 캔뱃지",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%BA%94%EB%B1%83%EC%A7%80/378/",
  }),
  Object.freeze({
    id: "photocard-set",
    name: "여름의 공방 포토카드 세트",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%8F%AC%ED%86%A0%EC%B9%B4%EB%93%9C-%EC%84%B8%ED%8A%B8/379/",
  }),
]);
const activeNow = "2026-08-10T12:00:00+09:00";
const endedNow = "2026-09-01T00:00:00+09:00";
const analyticsInterceptCounts = new WeakMap();

export function resolveAdminCredentials(env = process.env) {
  const primaryUsername = env.SMOKE_ADMIN_USERNAME;
  const primaryPassword = env.SMOKE_ADMIN_PASSWORD;
  if (primaryUsername !== undefined || primaryPassword !== undefined) {
    if (!primaryUsername?.trim() || !primaryPassword?.trim()) {
      throw new Error(
        "SMOKE_ADMIN_USERNAME and SMOKE_ADMIN_PASSWORD must both be non-empty when either is set"
      );
    }
    return { username: primaryUsername, password: primaryPassword };
  }

  const fallbackUsername = env.ADMIN_BASIC_AUTH_USERNAME;
  const fallbackPassword = env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!fallbackUsername?.trim() || !fallbackPassword?.trim()) {
    throw new Error(
      "Complete non-empty SMOKE_ADMIN_USERNAME/SMOKE_ADMIN_PASSWORD or ADMIN_BASIC_AUTH_USERNAME/ADMIN_BASIC_AUTH_PASSWORD credentials are required"
    );
  }
  return { username: fallbackUsername, password: fallbackPassword };
}

export function assertExactWhitespaceTokens(value, requiredTokens, subject) {
  const tokens = (value ?? "").trim().split(/\s+/).filter(Boolean);
  for (const token of requiredTokens) {
    assert.ok(
      tokens.includes(token),
      `${subject} must include the exact whitespace-delimited ${token} token (received ${JSON.stringify(value)})`
    );
  }
}

async function assertSecureNewTabRel(link, subject) {
  assert.equal(await link.getAttribute("target"), "_blank");
  assertExactWhitespaceTokens(
    await link.getAttribute("rel"),
    ["noopener", "noreferrer"],
    subject
  );
}

async function createSmokeContext(browser, options = {}) {
  const context = await browser.newContext(options);
  analyticsInterceptCounts.set(context, 0);
  await context.route("**/api/analytics/track", async (route) => {
    analyticsInterceptCounts.set(
      context,
      (analyticsInterceptCounts.get(context) ?? 0) + 1
    );
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
  const response = await page.goto(new URL(pathname, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  const context = page.context();
  const beforeProbe = analyticsInterceptCounts.get(context);
  assert.notEqual(
    beforeProbe,
    undefined,
    "Analytics interception must be registered for the current browser context"
  );
  const probeStatus = await page.evaluate(async () => {
    const probeResponse = await fetch("/api/analytics/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return probeResponse.status;
  });
  assert.equal(probeStatus, 204);
  assert.ok(
    analyticsInterceptCounts.get(context) > beforeProbe,
    "The current browser context must intercept the analytics probe"
  );
  return response;
}

async function main() {
  const adminCredentials = resolveAdminCredentials();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const activeContext = await createClockContext(browser, activeNow);
    const fantompickRuntimeRequests = [];
    activeContext.on("request", (request) => {
      const hostname = new URL(request.url()).hostname;
      if (hostname === "fantompick.com" || hostname.endsWith(".fantompick.com")) {
        fantompickRuntimeRequests.push(request.url());
      }
    });
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
    await assertSecureNewTabRel(bannerLink, "banner CTA rel");
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

    const productLinks = card.locator("[data-promotion-product-link]");
    assert.equal(await productLinks.count(), officialProducts.length);

    for (const product of officialProducts) {
      const link = card.getByRole("link", {
        name: `${product.name} 공식 이미지 보기, 새 탭에서 열림`,
        exact: true,
      });
      assert.equal(await link.count(), 1);
      assert.equal(await link.getAttribute("href"), product.detailUrl);
      await assertSecureNewTabRel(link, `${product.name} product link rel`);
      assert.equal(await link.getAttribute("data-promotion-product-link"), product.id);
      assert.equal(await link.getAttribute("data-analytics-menu"), "true");
      assert.equal(
        await link.getAttribute("data-analytics-id"),
        `moing-summer-atelier-2026:product:${product.id}`
      );
      assert.equal(
        await link.getAttribute("data-analytics-label"),
        `${product.name} 공식 이미지 보기`
      );
      assert.equal(
        await link.getAttribute("data-analytics-location"),
        "merch_promotion_product"
      );
      assert.equal(
        await link.getAttribute("data-analytics-type"),
        "promotion_product"
      );
    }

    assert.match(cardText, /상품 이미지는 팬텀픽 공식 상세에서 확인해 주세요\./);
    assert.equal(await card.locator('img[src*="fantompick.com"]').count(), 0);
    assert.equal(await card.locator('[style*="fantompick.com"]').count(), 0);
    assert.deepEqual(fantompickRuntimeRequests, []);

    const cardLink = card.getByRole("link", { name: "팬텀픽에서 굿즈 보기 새 탭에서 열림" });
    assert.equal(await cardLink.count(), 1);
    assert.equal(await cardLink.getAttribute("href"), canonicalStoreUrl);
    await assertSecureNewTabRel(cardLink, "category card CTA rel");
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
    const mobileCard = mobilePage.locator('[data-promotion-surface="card"]');
    await mobileCard.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(
      await mobileCard.locator("[data-promotion-product-link]").count(),
      officialProducts.length
    );

    for (const link of await mobileCard.locator("[data-promotion-product-link]").all()) {
      const box = await link.boundingBox();
      assert.ok(box, "product link must have a measurable hit target");
      assert.ok(box.height >= 44, "product link height must be at least 44px");
    }

    const mobileBanner = mobilePage.locator('[data-promotion-surface="banner"]');
    await mobileBanner.waitFor({ state: "visible", timeout: 10_000 });
    const mobileCopyMetrics = await mobileBanner.locator("p").evaluate((element) => {
      const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
      return { height: element.getBoundingClientRect().height, lineHeight };
    });
    assert.ok(mobileCopyMetrics.height <= mobileCopyMetrics.lineHeight * 2 + 1);
    assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const [label, control] of [
      ["promotion CTA", mobileBanner.locator("a")],
      ["promotion close button", mobileBanner.locator("button")],
    ]) {
      const box = await control.boundingBox();
      assert.ok(box, `${label} must have a measurable hit target`);
      assert.ok(box.width >= 44, `${label} width must be at least 44px`);
      assert.ok(box.height >= 44, `${label} height must be at least 44px`);
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
    const endMs = Date.parse("2026-09-01T00:00:00+09:00");
    await endBoundaryPage.clock.install({ time: endMs - 5 * 60_000 });
    await goto(endBoundaryPage, "/");
    const endBanner = endBoundaryPage.locator('[data-promotion-surface="banner"]');
    const endCard = endBoundaryPage.locator('[data-promotion-surface="card"]');
    await endBanner.waitFor({ state: "visible", timeout: 3_000 });
    await endCard.waitFor({ state: "visible", timeout: 3_000 });
    await endBoundaryPage.clock.pauseAt(endMs - 60_000);
    const finalMinuteTimers = endBoundaryPage.locator('[role="timer"]');
    await finalMinuteTimers.filter({ hasText: "마감까지 1분" }).first().waitFor({
      state: "visible",
      timeout: 3_000,
    });
    assert.equal(await finalMinuteTimers.count(), 2);
    assert.deepEqual(
      (await finalMinuteTimers.allTextContents()).map((label) => label.trim()),
      ["마감까지 1분", "마감까지 1분"]
    );
    await endBoundaryPage.clock.fastForward(1);
    await endBoundaryPage.waitForTimeout(0);
    await finalMinuteTimers.filter({ hasText: "곧 마감" }).first().waitFor({
      state: "visible",
      timeout: 3_000,
    });
    assert.deepEqual(
      (await finalMinuteTimers.allTextContents()).map((label) => label.trim()),
      ["곧 마감", "곧 마감"]
    );
    await endBoundaryPage.clock.fastForward(59_999);
    await endBoundaryPage.waitForTimeout(0);
    assert.equal(await endBanner.count(), 0);
    assert.equal(await endCard.count(), 0);
    await endBoundaryContext.close();
  } finally {
    await browser.close();
  }

  console.log("merch promotion smoke ok");
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error("[smoke-merch-promotion] failed:", error);
    process.exit(1);
  });
}
