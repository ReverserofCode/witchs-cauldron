import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:3165");
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(baseUrl.hostname),
  "potion smoke is loopback only"
);

const analyticsRoutes = [
  "**/api/analytics/track",
  "**/api/analytics/potion/track",
];

function dailyFixture(date, serverNowMs) {
  const startsAtMs = Date.parse(`${date}T00:00:00Z`);
  return {
    serverNowMs,
    challenge: {
      challengeId: `potion-v1:${date}:daily`,
      date,
      rulesVersion: "potion-v1",
      startsAtMs,
      endsAtMs: startsAtMs + 86_400_000,
      rounds: Array.from({ length: 5 }, () => ({
        center: 50,
        halfWidth: 10,
        periodMs: 4_000,
      })),
    },
  };
}

async function createSmokeContext(browser, options = {}) {
  const context = await browser.newContext(options);
  const intercepted = new Map(analyticsRoutes.map((route) => [route, 0]));
  for (const pattern of analyticsRoutes) {
    await context.route(pattern, async (route) => {
      intercepted.set(pattern, (intercepted.get(pattern) ?? 0) + 1);
      await route.fulfill({ status: 204, body: "" });
    });
  }
  return { context, intercepted };
}

async function gotoGame(page, intercepted) {
  const response = await page.goto(new URL("/games/potion-timing", baseUrl).href, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  assert.ok(response?.ok(), `game page returned ${response?.status() ?? "no response"}`);
  for (const [pattern, pathname] of [
    [analyticsRoutes[0], "/api/analytics/track"],
    [analyticsRoutes[1], "/api/analytics/potion/track"],
  ]) {
    const before = intercepted.get(pattern) ?? 0;
    const status = await page.evaluate(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      return response.status;
    }, pathname);
    assert.equal(status, 204, `${pathname} probe must be intercepted`);
    assert.ok((intercepted.get(pattern) ?? 0) > before);
  }
}

async function assertNoOverflow(page, width) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    `${width}px viewport must not overflow horizontally`
  );
}

async function assertMinimumTarget(locator, label) {
  const box = await locator.boundingBox();
  assert.ok(box, `${label} must have a measurable hit target`);
  assert.ok(box.width >= 44, `${label} must be at least 44px wide`);
  assert.ok(box.height >= 44, `${label} must be at least 44px high`);
}

async function playRemainingRounds(page, completedRounds = 0) {
  for (let round = completedRounds; round < 5; round += 1) {
    if (round > completedRounds || completedRounds > 0) {
      await page.getByRole("button", { name: "다음 라운드", exact: true }).click();
    }
    await page.getByRole("button", { name: "가열 시작", exact: true }).click();
    await page.getByRole("button", { name: "불 끄기", exact: true }).click();
  }
}

async function runPrimaryPractice(browser) {
  const { context, intercepted } = await createSmokeContext(browser, {
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await gotoGame(page, intercepted);
  await page.clock.pauseAt(clockStart + 10_000);
  await assertNoOverflow(page, 1440);
  assert.equal(await page.locator("audio, video").count(), 0, "game must remain silent");
  await assertMinimumTarget(
    page.getByRole("button", { name: "일반 연습", exact: true }),
    "practice mode button"
  );

  await page.getByRole("button", { name: "일반 연습", exact: true }).click();
  const initialRunId = await page.getByTestId("game-state").getAttribute("data-run-id");
  assert.match(initialRunId ?? "", /^[0-9a-f-]{36}$/i);
  assert.equal(await page.getByTestId("game-state").getAttribute("data-mode"), "practice");

  const startButton = page.getByRole("button", { name: "가열 시작", exact: true });
  await startButton.focus();
  await page.keyboard.down("Space");
  await page.keyboard.down("Space");
  await page.keyboard.up("Space");
  await page.waitForFunction(
    () => document.querySelector("[data-testid='game-state']")?.getAttribute("data-phase") === "running"
  );
  const noInputPeriodMs = Number(
    await page.getByTestId("gauge-frame").getAttribute("data-period-ms")
  );
  assert.ok(noInputPeriodMs > 0, "active round must expose a positive gauge period");
  await page.clock.runFor(noInputPeriodMs + 1);
  assert.equal(await page.getByTestId("game-state").getAttribute("data-phase"), "running");

  const staleStop = page.getByRole("button", { name: "불 끄기", exact: true });
  await staleStop.evaluate((button) => {
    button.click();
    button.click();
  });
  assert.equal(await page.getByTestId("game-state").getAttribute("data-score-count"), "1");

  await playRemainingRounds(page, 1);
  await page.getByRole("heading", { name: "이번 포션 결과", exact: true }).waitFor();
  assert.equal(await page.getByTestId("round-score").count(), 5);
  assert.equal(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("wc:potion:run:v1:")).length
    ),
    1
  );

  await page.getByRole("button", { name: "같은 모드로 다시 하기", exact: true }).click();
  const replayRunId = await page.getByTestId("game-state").getAttribute("data-run-id");
  assert.notEqual(replayRunId, initialRunId, "replay must create a new runId");
  assert.equal(await page.getByTestId("game-state").getAttribute("data-phase"), "ready");
  await context.close();
}

async function runKnownScoreAndKeyboard(browser) {
  const { context, intercepted } = await createSmokeContext(browser, {
    viewport: { width: 1024, height: 900 },
  });
  const page = await context.newPage();
  const clockStart = Date.now();
  await page.clock.install({ time: clockStart });
  await gotoGame(page, intercepted);
  await page.clock.pauseAt(clockStart + 10_000);
  await assertNoOverflow(page, 1024);
  await page.getByRole("button", { name: "일반 연습", exact: true }).click();
  const gauge = page.getByTestId("gauge-frame");
  const center = Number(await gauge.getAttribute("data-center"));
  const periodMs = Number(await gauge.getAttribute("data-period-ms"));
  await page.getByRole("button", { name: "가열 시작", exact: true }).press("Enter");
  await page.clock.fastForward((center * periodMs) / 200);
  await page.getByRole("button", { name: "불 끄기", exact: true }).press("Enter");
  const roundResult = await page.locator("[data-testid='game-state'] [role='status']").innerText();
  assert.match(roundResult, /100점/, `known performance-clock fixture scored: ${roundResult}`);
  const displayedPosition = Number(
    await page.getByTestId("gauge-indicator").getAttribute("data-position")
  );
  assert.ok(
    Math.abs(displayedPosition - center) <= 1,
    `stopped gauge ${displayedPosition} must match scored position ${center}`
  );
  await context.close();
}

async function runTouchAndSlowMode(browser) {
  const { context, intercepted } = await createSmokeContext(browser, {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await gotoGame(page, intercepted);
  await assertNoOverflow(page, 390);
  const slowButton = page.getByRole("button", { name: "느린 연습", exact: true });
  await slowButton.tap();
  assert.equal(await page.getByTestId("game-state").getAttribute("data-mode"), "slow-practice");
  assert.ok(Number(await page.getByTestId("gauge-frame").getAttribute("data-period-ms")) >= 7_200);
  await page.getByRole("button", { name: "가열 시작", exact: true }).tap();
  const stop = page.getByRole("button", { name: "불 끄기", exact: true });
  await stop.waitFor();
  await stop.tap();
  assert.equal(await page.getByTestId("game-state").getAttribute("data-score-count"), "1");
  await context.close();
}

async function runPauseAndRafCleanup(browser) {
  const { context, intercepted } = await createSmokeContext(browser, {
    viewport: { width: 320, height: 780 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const active = new Set();
    window.requestAnimationFrame = (callback) => {
      let id = 0;
      id = nativeRequest((now) => {
        active.delete(id);
        callback(now);
      });
      active.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      active.delete(id);
      nativeCancel(id);
    };
    globalThis.__potionRafProbe = () => active.size;
  });
  const page = await context.newPage();
  await gotoGame(page, intercepted);
  await assertNoOverflow(page, 320);
  await page.getByRole("button", { name: "일반 연습", exact: true }).click();
  await page.getByRole("button", { name: "가열 시작", exact: true }).click();
  await page.getByRole("button", { name: "불 끄기", exact: true }).click();
  await page.getByRole("button", { name: "다음 라운드", exact: true }).click();
  await page.getByRole("button", { name: "가열 시작", exact: true }).click();
  await page.waitForFunction(() => globalThis.__potionRafProbe() > 0);
  assert.equal(
    await page.locator("[class*='flames']").evaluate((element) => getComputedStyle(element).display),
    "none",
    "reduced motion must remove decorative flames"
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.getByRole("button", { name: "다시 준비", exact: true }).waitFor();
  assert.equal(await page.getByTestId("game-state").getAttribute("data-score-count"), "1");
  assert.equal(await page.getByTestId("game-state").getAttribute("data-round-index"), "1");
  await page.getByRole("button", { name: "다시 준비", exact: true }).click();
  assert.equal(await page.getByTestId("game-state").getAttribute("data-phase"), "ready");

  await page.getByRole("button", { name: "가열 시작", exact: true }).click();
  await page.waitForFunction(() => globalThis.__potionRafProbe() > 0);
  await page.getByRole("link", { name: "홈으로 이동", exact: true }).click();
  await page.waitForURL(new URL("/", baseUrl).href);
  await page.waitForFunction(() => globalThis.__potionRafProbe() === 0);
  await context.close();
}

async function runDailyBoundary(browser) {
  const { context, intercepted } = await createSmokeContext(browser);
  const clockStart = Date.now();
  let requestCount = 0;
  const firstEnd = Date.parse("2026-09-15T00:00:00Z");
  await context.route("**/api/games/potion-timing/daily", async (route) => {
    requestCount += 1;
    const fixture = requestCount === 1
      ? dailyFixture("2026-09-14", firstEnd - 800)
      : dailyFixture("2026-09-15", firstEnd + 1_000);
    await route.fulfill({ status: 200, json: fixture });
  });
  const page = await context.newPage();
  await page.clock.install({ time: clockStart });
  await gotoGame(page, intercepted);
  await page.clock.pauseAt(clockStart + 10_000);
  await page.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  await page.getByTestId("game-state").waitFor();
  assert.match(
    (await page.getByTestId("game-state").getAttribute("data-challenge-id")) ?? "",
    /2026-09-14/
  );
  await page.clock.runFor(801);
  await page.getByRole("button", { name: "가열 시작", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("[data-challenge-id*='2026-09-15']"));
  assert.equal(requestCount, 2, "expired first START must fetch a new daily challenge");
  assert.equal(await page.getByTestId("game-state").getAttribute("data-phase"), "ready");
  await context.close();
}

async function runDailySnapshotAfterBoundary(browser) {
  const { context, intercepted } = await createSmokeContext(browser);
  const clockStart = Date.now();
  const end = Date.parse("2026-09-15T00:00:00Z");
  await context.route("**/api/games/potion-timing/daily", (route) =>
    route.fulfill({ status: 200, json: dailyFixture("2026-09-14", end - 500) })
  );
  const page = await context.newPage();
  await page.clock.install({ time: clockStart });
  await gotoGame(page, intercepted);
  await page.clock.pauseAt(clockStart + 10_000);
  await page.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  const challengeId = await page.getByTestId("game-state").getAttribute("data-challenge-id");
  await page.getByRole("button", { name: "가열 시작", exact: true }).click();
  await page.clock.runFor(501);
  await page.getByRole("button", { name: "불 끄기", exact: true }).click();
  assert.equal(await page.getByTestId("game-state").getAttribute("data-challenge-id"), challengeId);
  assert.equal(await page.getByTestId("game-state").getAttribute("data-score-count"), "1");
  await context.close();
}

async function runDailyRequestRaces(browser) {
  const late = await createSmokeContext(browser);
  let requestCount = 0;
  let releaseFirst;
  let markFirstStarted;
  const firstStarted = new Promise((resolve) => { markFirstStarted = resolve; });
  const firstHeld = new Promise((resolve) => { releaseFirst = resolve; });
  await late.context.route("**/api/games/potion-timing/daily", async (route) => {
    const requestNumber = ++requestCount;
    if (requestNumber === 1) {
      markFirstStarted();
      await firstHeld;
    }
    try {
      await route.fulfill({
        status: 200,
        json: requestNumber === 1
          ? dailyFixture("2026-09-14", Date.parse("2026-09-14T01:00:00Z"))
          : dailyFixture("2026-09-15", Date.parse("2026-09-15T01:00:00Z")),
      });
    } catch {}
  });
  const latePage = await late.context.newPage();
  await gotoGame(latePage, late.intercepted);
  await latePage.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  await firstStarted;
  await latePage.getByRole("button", { name: "일반 연습", exact: true }).click();
  assert.equal(await latePage.getByTestId("game-state").getAttribute("data-mode"), "practice");
  await playRemainingRounds(latePage);
  await latePage.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  await latePage.waitForFunction(() =>
    document.querySelector("[data-challenge-id*='2026-09-15']")
  );
  releaseFirst();
  await latePage.waitForTimeout(100);
  assert.equal(requestCount, 2);
  assert.match(
    (await latePage.getByTestId("game-state").getAttribute("data-challenge-id")) ?? "",
    /2026-09-15/,
    "late first response must not replace the newer daily request"
  );
  await late.context.close();

  const malformed = await createSmokeContext(browser);
  await malformed.context.route("**/api/games/potion-timing/daily", (route) =>
    route.fulfill({ status: 200, json: { unexpected: true } })
  );
  const malformedPage = await malformed.context.newPage();
  await gotoGame(malformedPage, malformed.intercepted);
  await malformedPage.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  await malformedPage
    .getByText("오늘의 도전을 확인하지 못했어요", { exact: false })
    .waitFor();
  assert.equal(
    await malformedPage.getByRole("button", { name: "일반 연습", exact: true }).isEnabled(),
    true
  );
  await malformed.context.close();

  const timeout = await createSmokeContext(browser);
  await timeout.context.addInitScript(() => {
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay = 0, ...args) =>
      nativeSetTimeout(callback, delay === 5_000 ? 20 : delay, ...args);
  });
  await timeout.context.route("**/api/games/potion-timing/daily", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      await route.fulfill({
        status: 200,
        json: dailyFixture("2026-09-15", Date.parse("2026-09-15T01:00:00Z")),
      });
    } catch {}
  });
  const timeoutPage = await timeout.context.newPage();
  await gotoGame(timeoutPage, timeout.intercepted);
  await timeoutPage.getByRole("button", { name: "오늘의 도전", exact: true }).click();
  await timeoutPage.getByText("오늘의 도전 확인 시간이 초과됐어요", { exact: false }).waitFor();
  await timeout.context.close();
}

async function runStorageFaultsAndClear(browser) {
  const quota = await createSmokeContext(browser);
  await quota.context.addInitScript(() => {
    const completedAtMs = Date.now() - 1_000;
    const completed = new Date(completedAtMs);
    const challengeDate = [
      completed.getFullYear(),
      String(completed.getMonth() + 1).padStart(2, "0"),
      String(completed.getDate()).padStart(2, "0"),
    ].join("-");
    const existingRunId = "d7b360f9-e638-476a-a17e-62ec11a36fb8";
    const existingKey = `wc:potion:run:v1:${existingRunId}`;
    const nativeSetItem = Storage.prototype.setItem;
    nativeSetItem.call(localStorage, existingKey, JSON.stringify({
      schemaVersion: 1,
      runId: existingRunId,
      mode: "practice",
      rulesVersion: "potion-v1",
      challengeId: `potion-v1:${challengeDate}:practice`,
      challengeDate,
      completedAtMs,
      scores: [80, 70, 60, 50, 40],
      total: 300,
    }));
    Storage.prototype.setItem = function setItem(key, value) {
      if (this === localStorage && key.startsWith("wc:potion:run:v1:") && key !== existingKey) {
        throw new DOMException("quota", "QuotaExceededError");
      }
      return nativeSetItem.call(this, key, value);
    };
  });
  const quotaPage = await quota.context.newPage();
  await gotoGame(quotaPage, quota.intercepted);
  await quotaPage.getByTestId("record-first-score").filter({ hasText: "300점" }).waitFor();
  await quotaPage.getByRole("button", { name: "일반 연습", exact: true }).click();
  await playRemainingRounds(quotaPage);
  await quotaPage
    .getByText("이 브라우저에 기록을 저장하지 못했어요", { exact: false })
    .waitFor();
  await quotaPage.getByTestId("record-first-score").filter({ hasText: "300점" }).waitFor();
  assert.equal(await quotaPage.getByTestId("round-score").count(), 5);
  await quota.context.close();

  const corrupt = await createSmokeContext(browser);
  await corrupt.context.addInitScript(() => {
    localStorage.setItem("wc:potion:run:v1:broken", "{not-json");
    localStorage.setItem("another-feature", "keep");
  });
  const corruptPage = await corrupt.context.newPage();
  await gotoGame(corruptPage, corrupt.intercepted);
  await corruptPage.waitForFunction(() => localStorage.getItem("wc:potion:run:v1:broken") === null);
  assert.equal(await corruptPage.evaluate(() => localStorage.getItem("another-feature")), "keep");
  await corruptPage.getByRole("button", { name: "일반 연습", exact: true }).click();
  await playRemainingRounds(corruptPage);
  await corruptPage.getByRole("button", { name: "게임 기록 지우기", exact: true }).click();
  await corruptPage.getByRole("button", { name: "기록 삭제 확인", exact: true }).click();
  assert.equal(
    await corruptPage.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith("wc:potion:run:v1:")).length
    ),
    0
  );
  assert.equal(await corruptPage.evaluate(() => localStorage.getItem("another-feature")), "keep");
  await corrupt.context.close();

  const blocked = await createSmokeContext(browser);
  await blocked.context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  const blockedPage = await blocked.context.newPage();
  await gotoGame(blockedPage, blocked.intercepted);
  await blockedPage.getByText("로컬 기록을 읽을 수 없어요", { exact: false }).waitFor();
  assert.equal(
    await blockedPage.getByRole("button", { name: "일반 연습", exact: true }).isEnabled(),
    true
  );
  await blocked.context.close();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    await runPrimaryPractice(browser);
    await runKnownScoreAndKeyboard(browser);
    await runTouchAndSlowMode(browser);
    await runPauseAndRafCleanup(browser);
    await runDailyBoundary(browser);
    await runDailySnapshotAfterBoundary(browser);
    await runDailyRequestRaces(browser);
    await runStorageFaultsAndClear(browser);
  } finally {
    await browser.close();
  }
  console.log("potion timing smoke ok");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("[smoke-potion-timing] failed:", error);
    process.exit(1);
  });
}
