#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const canonicalStoreUrl =
  "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/";
const activeNow = "2026-08-10T12:00:00+09:00";
const endedNow = "2026-09-01T00:00:00+09:00";

async function createClockContext(browser, nowIso) {
  const context = await browser.newContext();
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
  await page.goto(new URL(pathname, baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
}

async function main() {
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
    const bannerLink = banner.locator("a");
    assert.equal(await bannerLink.getAttribute("href"), canonicalStoreUrl);
    assert.equal(await bannerLink.getAttribute("target"), "_blank");
    assert.match(await bannerLink.getAttribute("rel"), /noopener/);
    assert.match(await bannerLink.getAttribute("rel"), /noreferrer/);

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

    const routeContext = await createClockContext(browser, activeNow);
    const routePage = await routeContext.newPage();
    await goto(routePage, "/broadcasts");
    await routePage
      .locator('[data-promotion-surface="banner"]')
      .waitFor({ state: "visible" });
    await goto(routePage, "/admin");
    await routePage.waitForTimeout(300);
    assert.equal(
      await routePage.locator('[data-promotion-surface="banner"]').count(),
      0
    );
    await routeContext.close();

    const endedContext = await createClockContext(browser, endedNow);
    const endedPage = await endedContext.newPage();
    await goto(endedPage, "/");
    await endedPage.waitForTimeout(500);
    assert.equal(
      await endedPage.locator('[data-promotion-surface="banner"]').count(),
      0
    );
    await endedContext.close();
  } finally {
    await browser.close();
  }

  console.log("merch promotion smoke ok");
}

main().catch((error) => {
  console.error("[smoke-merch-promotion] failed:", error);
  process.exit(1);
});
