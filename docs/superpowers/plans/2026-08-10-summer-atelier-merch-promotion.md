# Summer Atelier Merch Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026년 모잉 「여름의 공방」 굿즈 판매 기간에만 전역 띠배너와 홈 상세 카드를 노출하고, 마감 카운트다운·세션 닫기·기존 Analytics·운영 문서·프로덕션 배포 검증까지 제공한다.

**Architecture:** 팬텀픽을 런타임에 호출하지 않는 정적 캠페인 구성과 순수 시간 함수를 먼저 만든다. 작은 클라이언트 훅이 브라우저 시각과 다음 시작·분·종료 경계를 예약하고, 전역 배너와 홈 카드가 활성 상태에서만 렌더링된다. 기존 위임형 클릭 Analytics와 SectionTracker를 재사용하며, Node 단위 테스트와 Playwright 스모크로 기간 경계·경로 제외·세션 닫기·링크·상품 문구를 검증한다.

**Tech Stack:** Next.js 16.3.0 App Router, React 19.2.5, TypeScript 6.0.3, Tailwind CSS v4, Vitest 4.1.4, Playwright 1.59.1, GitHub Actions CD, Docker

## Global Constraints

- 승인 사양 `docs/superpowers/specs/2026-08-10-summer-atelier-merch-promotion-design.md`를 기준으로 한다.
- 캠페인 ID는 `moing-summer-atelier-2026`이다.
- 활성 경계는 `2026-08-05T19:00:00+09:00 <= now < 2026-09-01T00:00:00+09:00`이다.
- 판매 링크는 추적 파라미터가 없는 `https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/`만 사용한다.
- 팬텀픽 HTML·재고·가격을 런타임에 가져오지 않는다.
- 외부 상품 이미지를 다운로드·저장소 포함·핫링크하지 않는다.
- 자동 팝업, 모달, 재고 보장, 공식 후원을 암시하는 문구를 추가하지 않는다.
- `/admin` 및 모든 하위 경로에는 전역 홍보 배너를 표시하지 않는다.
- 홈 ISR 5분과 무관하게 브라우저에서 시작·종료 경계를 갱신한다.
- 기존 Analytics 이벤트 계약만 사용하며 새 API·DB 스키마·metadata 키를 추가하지 않는다.
- 새 npm 의존성을 추가하지 않는다.
- CTA는 새 탭으로 열고 `rel="noopener noreferrer"`를 제공한다.
- 공식 정보는 2026-08-10 확인 기준이며 UI에 팬텀픽 최종 확인 고지를 둔다.
- 비밀값, 인증정보, SSH fingerprint 원문을 코드·문서·명령 출력에 남기지 않는다.
- 다른 작업자의 변경을 되돌리지 않고, 각 커밋 직전에 의도한 파일만 stage한다.

---

## File Structure

### 새 파일

- `frontend/app/lib/promotions/summerAtelier.ts`: 캠페인 데이터, 유효 기간 파싱, 상태, 카운트다운, 다음 wake-up 계산
- `frontend/app/lib/promotions/summerAtelier.test.ts`: 시작·종료·시간대·잘못된 구성·카운트다운 경계 테스트
- `frontend/app/hooks/usePromotionCampaign.ts`: hydration 이후 브라우저 시각을 읽고 다음 상태 경계에 재평가하는 클라이언트 훅
- `frontend/app/components/promotions/MerchPromotionBanner.tsx`: 공개 경로 전역 띠배너, 세션 닫기, CTA Analytics 속성
- `frontend/app/components/promotions/MerchPromotionCard.tsx`: 홈 상품 요약·특전·배송·카운트다운·CTA·SectionTracker
- `frontend/app/components/promotions/index.ts`: 홍보 컴포넌트 공개 export
- `frontend/scripts/smoke-merch-promotion.mjs`: 고정 브라우저 시각으로 활성·종료·관리자 제외·세션 닫기·링크·상품 문구 검증
- `docs/SUMMER_ATELIER_PROMOTION.md`: 근거, 운영 방법, 변경 절차, 검증, 종료 후 처리
- `docs/DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md`: 실제 배포 SHA/run/스모크 결과와 참고사항

### 수정 파일

- `frontend/package.json`: `smoke:promotion` 스크립트 추가
- `frontend/app/layout.tsx:10-12,140-143`: Header 다음 전역 배너 삽입
- `frontend/app/page.tsx:18-23,198`: 히어로 다음 홈 상세 카드 삽입
- `frontend/app/admin/analytics/page.tsx:237-252,283-295`: 캠페인 섹션·클릭 위치 한글 라벨 추가
- `AGENTS.md`: 최근 변경에 기간 한정 굿즈 홍보 기능과 운영 문서 링크 추가

---

### Task 1: 캠페인 시간 모델과 판매 데이터

**Files:**
- Create: `frontend/app/lib/promotions/summerAtelier.ts`
- Create: `frontend/app/lib/promotions/summerAtelier.test.ts`

**Interfaces:**
- Consumes: 승인 사양의 판매 기간, canonical URL, 5종 상품·가격, 특전·출고일
- Produces:
  - `SUMMER_ATELIER_CAMPAIGN: PromotionCampaign`
  - `PROMOTION_DISMISSAL_KEY: string`
  - `getPromotionWindow(campaign): PromotionWindow | null`
  - `getPromotionPhase(campaign, now): PromotionPhase | null`
  - `formatPromotionCountdown(campaign, now): string | null`
  - `getNextPromotionWakeDelay(campaign, now): number | null`

- [ ] **Step 1: 실패하는 기간 경계 테스트를 작성한다**

`frontend/app/lib/promotions/summerAtelier.test.ts`를 다음 내용으로 만든다.

~~~ts
import { describe, expect, it } from "vitest";
import {
  SUMMER_ATELIER_CAMPAIGN,
  formatPromotionCountdown,
  getNextPromotionWakeDelay,
  getPromotionPhase,
  getPromotionWindow,
  type PromotionCampaign,
} from "./summerAtelier";

describe("summer atelier promotion", () => {
  it("uses the verified canonical campaign data", () => {
    expect(SUMMER_ATELIER_CAMPAIGN.id).toBe("moing-summer-atelier-2026");
    expect(SUMMER_ATELIER_CAMPAIGN.storeUrl).toBe(
      "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/"
    );
    expect(SUMMER_ATELIER_CAMPAIGN.products).toHaveLength(5);
    expect(SUMMER_ATELIER_CAMPAIGN.products[0]).toMatchObject({
      name: "여름의 공방 풀세트",
      price: "77,000원",
    });
  });

  it("uses an inclusive start and exclusive end", () => {
    expect(getPromotionPhase(SUMMER_ATELIER_CAMPAIGN, Date.parse("2026-08-05T09:59:59.999Z"))).toBe("upcoming");
    expect(getPromotionPhase(SUMMER_ATELIER_CAMPAIGN, Date.parse("2026-08-05T10:00:00.000Z"))).toBe("active");
    expect(getPromotionPhase(SUMMER_ATELIER_CAMPAIGN, Date.parse("2026-08-31T14:59:59.999Z"))).toBe("active");
    expect(getPromotionPhase(SUMMER_ATELIER_CAMPAIGN, Date.parse("2026-08-31T15:00:00.000Z"))).toBe("ended");
  });

  it("formats day, hour, minute and imminent countdowns", () => {
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - ((2 * 24 + 3) * 60 + 4) * 60_000)).toBe(
      "마감까지 2일 3시간 4분"
    );
    expect(formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 65 * 60_000)).toBe(
      "마감까지 1시간 5분"
    );
    expect(formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 59_000)).toBe("곧 마감");
    expect(formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs)).toBeNull();
  });

  it("wakes at the next relevant minute or campaign boundary", () => {
    const startMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.startAt);
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, startMs - 30_000)).toBe(30_000);
    expect(getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 10_000)).toBe(10_000);
    expect(getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs)).toBeNull();
  });

  it("rejects invalid or reversed campaign windows", () => {
    const invalid = {
      ...SUMMER_ATELIER_CAMPAIGN,
      startAt: "not-a-date",
    } satisfies PromotionCampaign;
    const reversed = {
      ...SUMMER_ATELIER_CAMPAIGN,
      startAt: SUMMER_ATELIER_CAMPAIGN.endAtExclusive,
      endAtExclusive: SUMMER_ATELIER_CAMPAIGN.startAt,
    } satisfies PromotionCampaign;

    expect(getPromotionWindow(invalid)).toBeNull();
    expect(getPromotionPhase(invalid, Date.now())).toBeNull();
    expect(formatPromotionCountdown(invalid, Date.now())).toBeNull();
    expect(getPromotionWindow(reversed)).toBeNull();
  });
});
~~~

- [ ] **Step 2: 대상 테스트가 구현 부재로 실패하는지 확인한다**

Run:

~~~powershell
Set-Location frontend
npm test -- app/lib/promotions/summerAtelier.test.ts
~~~

Expected: FAIL because `./summerAtelier` does not exist.

- [ ] **Step 3: 최소 캠페인 모델과 시간 함수를 구현한다**

`frontend/app/lib/promotions/summerAtelier.ts`를 다음 내용으로 만든다.

~~~ts
export interface PromotionProduct {
  readonly name: string;
  readonly price: string;
  readonly note?: string;
}

export interface PromotionCampaign {
  readonly id: string;
  readonly title: string;
  readonly storeUrl: string;
  readonly startAt: string;
  readonly endAtExclusive: string;
  readonly shippingFrom: string;
  readonly products: readonly PromotionProduct[];
}

export type PromotionPhase = "upcoming" | "active" | "ended";

export interface PromotionWindow {
  startMs: number;
  endMs: number;
}

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const MAX_TIMEOUT_MS = 2_147_483_647;

export const SUMMER_ATELIER_CAMPAIGN = {
  id: "moing-summer-atelier-2026",
  title: "모잉 여름의 공방 굿즈 예약 판매",
  storeUrl: "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/",
  startAt: "2026-08-05T19:00:00+09:00",
  endAtExclusive: "2026-09-01T00:00:00+09:00",
  shippingFrom: "2026-10-07",
  products: [
    { name: "여름의 공방 풀세트", price: "77,000원", note: "친필 사인 투명 포토카드 1장 증정" },
    { name: "여름의 공방 장패드", price: "30,000원" },
    { name: "비키니 모잉 아크릴 스탠드", price: "35,000원" },
    { name: "비키니 모잉 캔뱃지", price: "7,500원" },
    { name: "여름의 공방 포토카드 세트", price: "7,000원" },
  ],
} as const satisfies PromotionCampaign;

export const PROMOTION_DISMISSAL_KEY =
  "wc:promotion:moing-summer-atelier-2026:dismissed";

function toNowMs(now: Date | number): number {
  return now instanceof Date ? now.getTime() : now;
}

export function getPromotionWindow(campaign: PromotionCampaign): PromotionWindow | null {
  const startMs = Date.parse(campaign.startAt);
  const endMs = Date.parse(campaign.endAtExclusive);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null;
  }
  return { startMs, endMs };
}

export function getPromotionPhase(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): PromotionPhase | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || !Number.isFinite(nowMs)) return null;
  if (nowMs < window.startMs) return "upcoming";
  if (nowMs >= window.endMs) return "ended";
  return "active";
}

export function formatPromotionCountdown(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): string | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || getPromotionPhase(campaign, nowMs) !== "active") return null;
  const totalMinutes = Math.floor((window.endMs - nowMs) / MINUTE_MS);
  if (totalMinutes < 1) return "곧 마감";

  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? days + "일" : null,
    hours > 0 ? hours + "시간" : null,
    minutes > 0 ? minutes + "분" : null,
  ].filter((part): part is string => part !== null);
  return "마감까지 " + parts.join(" ");
}

export function getNextPromotionWakeDelay(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): number | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || !Number.isFinite(nowMs) || nowMs >= window.endMs) return null;

  const targetDelay =
    nowMs < window.startMs
      ? window.startMs - nowMs
      : Math.min(window.endMs - nowMs, MINUTE_MS - (nowMs % MINUTE_MS));
  return Math.max(1, Math.min(targetDelay, MAX_TIMEOUT_MS));
}
~~~

- [ ] **Step 4: 단위 테스트와 타입 검사를 통과시킨다**

Run:

~~~powershell
Set-Location frontend
npm test -- app/lib/promotions/summerAtelier.test.ts
npm run typecheck
~~~

Expected: 5 tests PASS and TypeScript exits 0.

- [ ] **Step 5: 시간 모델만 커밋한다**

~~~powershell
git add -- frontend/app/lib/promotions/summerAtelier.ts frontend/app/lib/promotions/summerAtelier.test.ts
git diff --cached --check
git commit -m "Add summer merch promotion timing"
~~~

Expected: one commit containing only the campaign module and its test.

---

### Task 2: 브라우저 시간 훅과 전역 띠배너

**Files:**
- Create: `frontend/app/hooks/usePromotionCampaign.ts`
- Create: `frontend/app/components/promotions/MerchPromotionBanner.tsx`
- Create: `frontend/app/components/promotions/index.ts`
- Create: `frontend/scripts/smoke-merch-promotion.mjs`
- Modify: `frontend/app/layout.tsx:10-12,140-143`
- Modify: `frontend/package.json:scripts`

**Interfaces:**
- Consumes: Task 1의 `SUMMER_ATELIER_CAMPAIGN`, `PROMOTION_DISMISSAL_KEY`, `getPromotionPhase`, `formatPromotionCountdown`, `getNextPromotionWakeDelay`
- Produces:
  - `usePromotionCampaign(campaign): PromotionRuntimeState | null`
  - `MerchPromotionBanner`
  - DOM selector `[data-promotion-surface="banner"]`
  - npm command `npm run smoke:promotion`

- [ ] **Step 1: 전역 배너의 실패하는 Playwright 스모크를 작성한다**

`frontend/scripts/smoke-merch-promotion.mjs`를 만든다.

~~~js
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

    await banner.getByRole("button", { name: "여름의 공방 굿즈 홍보 배너 닫기" }).click();
    assert.equal(await banner.count(), 0);
    await goto(activePage, "/broadcasts");
    await activePage.waitForTimeout(300);
    assert.equal(await activePage.locator('[data-promotion-surface="banner"]').count(), 0);
    await activeContext.close();

    const routeContext = await createClockContext(browser, activeNow);
    const routePage = await routeContext.newPage();
    await goto(routePage, "/broadcasts");
    await routePage.locator('[data-promotion-surface="banner"]').waitFor({ state: "visible" });
    await goto(routePage, "/admin");
    await routePage.waitForTimeout(300);
    assert.equal(await routePage.locator('[data-promotion-surface="banner"]').count(), 0);
    await routeContext.close();

    const endedContext = await createClockContext(browser, endedNow);
    const endedPage = await endedContext.newPage();
    await goto(endedPage, "/");
    await endedPage.waitForTimeout(500);
    assert.equal(await endedPage.locator('[data-promotion-surface="banner"]').count(), 0);
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
~~~

`frontend/package.json`의 scripts에 다음 항목을 추가한다.

~~~json
"smoke:promotion": "node scripts/smoke-merch-promotion.mjs"
~~~

- [ ] **Step 2: 기존 앱에서 스모크가 배너 부재로 실패하는지 확인한다**

첫 번째 터미널:

~~~powershell
Set-Location frontend
npm run dev
~~~

두 번째 터미널:

~~~powershell
Set-Location frontend
npm run smoke:promotion
~~~

Expected: FAIL waiting for `[data-promotion-surface="banner"]`.

- [ ] **Step 3: hydration-safe 캠페인 시간 훅을 구현한다**

`frontend/app/hooks/usePromotionCampaign.ts`를 만든다.

~~~ts
"use client";

import { useEffect, useState } from "react";
import {
  SUMMER_ATELIER_CAMPAIGN,
  formatPromotionCountdown,
  getNextPromotionWakeDelay,
  getPromotionPhase,
  type PromotionCampaign,
  type PromotionPhase,
} from "@/app/lib/promotions/summerAtelier";

export interface PromotionRuntimeState {
  phase: PromotionPhase | null;
  countdownLabel: string | null;
}

export function usePromotionCampaign(
  campaign: PromotionCampaign = SUMMER_ATELIER_CAMPAIGN
): PromotionRuntimeState | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (nowMs === null) return;
    const delay = getNextPromotionWakeDelay(campaign, nowMs);
    if (delay === null) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [campaign, nowMs]);

  if (nowMs === null) return null;
  return {
    phase: getPromotionPhase(campaign, nowMs),
    countdownLabel: formatPromotionCountdown(campaign, nowMs),
  };
}
~~~

- [ ] **Step 4: 접근 가능한 전역 배너와 세션 닫기를 구현한다**

`frontend/app/components/promotions/MerchPromotionBanner.tsx`를 만든다.

~~~tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePromotionCampaign } from "@/app/hooks/usePromotionCampaign";
import {
  PROMOTION_DISMISSAL_KEY,
  SUMMER_ATELIER_CAMPAIGN,
} from "@/app/lib/promotions/summerAtelier";

export function MerchPromotionBanner() {
  const pathname = usePathname();
  const runtime = usePromotionCampaign();
  const [dismissalReady, setDismissalReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(PROMOTION_DISMISSAL_KEY) === "1");
    } catch {
      setDismissed(false);
    } finally {
      setDismissalReady(true);
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(PROMOTION_DISMISSAL_KEY, "1");
    } catch {
      // Current-page dismissal still works when storage is unavailable.
    }
  }

  if (
    pathname.startsWith("/admin") ||
    !dismissalReady ||
    dismissed ||
    runtime?.phase !== "active"
  ) {
    return null;
  }

  return (
    <aside
      aria-label="기간 한정 굿즈 안내"
      data-promotion-id={SUMMER_ATELIER_CAMPAIGN.id}
      data-promotion-surface="banner"
      className="border-y border-sky-200/70 bg-gradient-to-r from-sky-100 via-white to-purple-100 text-purple-950 shadow-sm"
    >
      <div className="mx-auto flex min-h-12 w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 sm:text-sm">
          <span className="mr-1.5 rounded-full bg-purple-700 px-2 py-0.5 text-[10px] font-bold text-white">
            기간 한정
          </span>
          모잉 여름의 공방 굿즈 예약 판매 중 · 8월 31일 23:59 마감
        </p>
        <a
          href={SUMMER_ATELIER_CAMPAIGN.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-purple-700 px-3 text-xs font-bold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
          data-analytics-menu="true"
          data-analytics-id={SUMMER_ATELIER_CAMPAIGN.id + ":banner"}
          data-analytics-label="팬텀픽에서 보기"
          data-analytics-location="merch_promotion_banner"
          data-analytics-type="promotion_cta"
        >
          팬텀픽에서 보기
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="여름의 공방 굿즈 홍보 배너 닫기"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-purple-900 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </aside>
  );
}
~~~

`frontend/app/components/promotions/index.ts`:

~~~ts
export { MerchPromotionBanner } from "./MerchPromotionBanner";
~~~

`frontend/app/layout.tsx`에서 import를 추가하고 `<Header />` 바로 다음에 배너를 삽입한다.

~~~tsx
import { MerchPromotionBanner } from "@/app/components/promotions";

<Header />
<MerchPromotionBanner />
<main className="flex flex-col flex-1">{children}</main>
~~~

- [ ] **Step 5: 전역 배너 스모크와 정적 검사를 통과시킨다**

Run while the dev server is running:

~~~powershell
Set-Location frontend
npm run smoke:promotion
npm run typecheck
npm run lint
~~~

Expected: promotion smoke prints `merch promotion smoke ok`; typecheck and lint exit 0.

검증이 끝나면 첫 번째 터미널에서 `Ctrl+C`로 dev server를 종료해 다음 작업에 포트와 프로세스를 남기지 않는다.

- [ ] **Step 6: 전역 배너 단위를 커밋한다**

~~~powershell
git add -- frontend/package.json frontend/app/layout.tsx frontend/app/hooks/usePromotionCampaign.ts frontend/app/components/promotions/MerchPromotionBanner.tsx frontend/app/components/promotions/index.ts frontend/scripts/smoke-merch-promotion.mjs
git diff --cached --check
git commit -m "Add date-gated merch promotion banner"
~~~

---

### Task 3: 홈 상세 카드와 Analytics 라벨

**Files:**
- Create: `frontend/app/components/promotions/MerchPromotionCard.tsx`
- Modify: `frontend/app/components/promotions/index.ts`
- Modify: `frontend/app/page.tsx:18-23,198`
- Modify: `frontend/app/admin/analytics/page.tsx:237-252,283-295`
- Modify: `frontend/scripts/smoke-merch-promotion.mjs`

**Interfaces:**
- Consumes: Task 1 캠페인 데이터, Task 2 `usePromotionCampaign`, 기존 `SectionCard`, `SectionTracker`
- Produces:
  - `MerchPromotionCard`
  - DOM selector `[data-promotion-surface="card"]`
  - Section ID `promotion-summer-atelier`
  - click locations `merch_promotion_banner`, `merch_promotion_card`

- [ ] **Step 1: 홈 카드와 Analytics 속성 스모크 assertion을 먼저 추가한다**

`smoke-merch-promotion.mjs`에서 활성 홈 배너를 기다린 직후 다음 assertion을 삽입한다.

~~~js
const card = activePage.locator('[data-promotion-surface="card"]');
await card.waitFor({ state: "visible", timeout: 10_000 });
const cardText = await card.innerText();
for (const expectedText of [
  "여름의 공방 풀세트",
  "77,000원",
  "친필 사인 투명 포토카드",
  "여름의 공방 장패드",
  "비키니 모잉 아크릴 스탠드",
  "비키니 모잉 캔뱃지",
  "여름의 공방 포토카드 세트",
  "10월 7일부터 순차 출고 예정",
]) {
  assert.match(cardText, new RegExp(expectedText));
}

const cardLink = card.getByRole("link", { name: "팬텀픽에서 굿즈 보기" });
assert.equal(await cardLink.getAttribute("href"), canonicalStoreUrl);
assert.equal(await cardLink.getAttribute("data-analytics-id"), "moing-summer-atelier-2026:card");
assert.equal(await cardLink.getAttribute("data-analytics-location"), "merch_promotion_card");
assert.equal(await bannerLink.getAttribute("data-analytics-location"), "merch_promotion_banner");
assert.equal(await activePage.locator("#promotion-summer-atelier").count(), 1);
~~~

종료 시각 assertion에는 카드 부재도 추가한다.

~~~js
assert.equal(await endedPage.locator('[data-promotion-surface="card"]').count(), 0);
~~~

- [ ] **Step 2: 확장된 스모크가 카드 부재로 실패하는지 확인한다**

첫 번째 터미널에서 dev server를 시작한다.

~~~powershell
Set-Location frontend
npm run dev
~~~

두 번째 터미널에서 스모크를 실행한다.

~~~powershell
Set-Location frontend
npm run smoke:promotion
~~~

Expected: FAIL waiting for `[data-promotion-surface="card"]`.

- [ ] **Step 3: 홈 상세 카드를 구현한다**

`frontend/app/components/promotions/MerchPromotionCard.tsx`를 만든다.

~~~tsx
"use client";

import { SectionTracker } from "@/app/components/analytics/SectionTracker";
import { SectionCard } from "@/app/components/cards";
import { usePromotionCampaign } from "@/app/hooks/usePromotionCampaign";
import { SUMMER_ATELIER_CAMPAIGN } from "@/app/lib/promotions/summerAtelier";

export function MerchPromotionCard() {
  const runtime = usePromotionCampaign();
  if (runtime?.phase !== "active") return null;

  return (
    <SectionTracker sectionId="promotion-summer-atelier">
      <SectionCard
        as="div"
        eyebrow="Limited Pre-order"
        title={SUMMER_ATELIER_CAMPAIGN.title}
        description="8월 31일 23:59까지 팬텀픽에서 주문제작 예약 판매합니다."
        className="border-sky-200/80 bg-[radial-gradient(circle_at_12%_18%,rgba(255,255,255,0.95),transparent_24%),radial-gradient(circle_at_88%_12%,rgba(216,180,254,0.55),transparent_27%),linear-gradient(135deg,rgba(224,242,254,0.96),rgba(255,255,255,0.94)_48%,rgba(243,232,255,0.94))] shadow-[0_18px_44px_rgba(30,64,175,0.12)]"
      >
        <div
          data-promotion-id={SUMMER_ATELIER_CAMPAIGN.id}
          data-promotion-surface="card"
          className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
        >
          <div className="flex flex-col justify-between gap-4 rounded-[20px] border border-white/80 bg-white/72 p-4 shadow-sm">
            <div>
              <span className="inline-flex rounded-full bg-sky-700 px-3 py-1 text-xs font-bold text-white">
                PRE-ORDER
              </span>
              <p role="timer" className="mt-3 text-2xl font-black text-purple-950 sm:text-3xl">
                {runtime.countdownLabel}
              </p>
              <p className="mt-2 text-sm font-semibold text-purple-900/80">
                2026년 8월 31일 23:59 마감
              </p>
            </div>

            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/90 p-3">
              <p className="text-sm font-black text-sky-900">풀세트 구매 특전</p>
              <p className="mt-1 text-sm text-sky-950/85">
                풀세트 1개당 친필 사인 투명 포토카드 1장을 함께 증정합니다.
              </p>
            </div>

            <a
              href={SUMMER_ATELIER_CAMPAIGN.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary min-h-11 w-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 sm:w-fit"
              data-analytics-menu="true"
              data-analytics-id={SUMMER_ATELIER_CAMPAIGN.id + ":card"}
              data-analytics-label="팬텀픽에서 굿즈 보기"
              data-analytics-location="merch_promotion_card"
              data-analytics-type="promotion_cta"
            >
              팬텀픽에서 굿즈 보기
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <ul className="grid gap-2 sm:grid-cols-2">
              {SUMMER_ATELIER_CAMPAIGN.products.map((product) => (
                <li
                  key={product.name}
                  className="rounded-2xl border border-purple-200/60 bg-white/80 px-3 py-3"
                >
                  <p className="break-keep text-sm font-bold text-purple-950">{product.name}</p>
                  <p className="mt-1 text-base font-black text-purple-700">{product.price}</p>
                  {product.note && (
                    <p className="mt-1 text-xs leading-5 text-purple-900/70">{product.note}</p>
                  )}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-purple-200/60 bg-white/65 px-3 py-3 text-xs leading-5 text-purple-950/75">
              <p className="font-bold text-purple-950">10월 7일부터 순차 출고 예정</p>
              <p>가격·판매 상태·배송 조건은 팬텀픽에서 최종 확인해 주세요.</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </SectionTracker>
  );
}
~~~

`frontend/app/components/promotions/index.ts`에 export를 추가한다.

~~~ts
export { MerchPromotionBanner } from "./MerchPromotionBanner";
export { MerchPromotionCard } from "./MerchPromotionCard";
~~~

- [ ] **Step 4: 홈과 관리자 Analytics 라벨에 연결한다**

`frontend/app/page.tsx`에 import를 추가하고, Hero의 `</LiveStatusProvider>` 다음이자 생일 배너 이전에 카드를 삽입한다.

~~~tsx
import { MerchPromotionCard } from "@/app/components/promotions";

</LiveStatusProvider>
<MerchPromotionCard />
{showBirthdayBanner && birthdayBannerCopy && (
~~~

`frontend/app/admin/analytics/page.tsx`의 label map에 정확히 다음 항목을 추가한다.

~~~ts
const SECTION_LABELS: Record<string, string> = {
  "promotion-summer-atelier": "여름의 공방 굿즈 홍보",
  // existing labels remain unchanged
};

const LOCATION_LABELS: Record<string, string> = {
  merch_promotion_banner: "굿즈 전역 배너",
  merch_promotion_card: "굿즈 홈 카드",
  // existing labels remain unchanged
};
~~~

- [ ] **Step 5: 홈 카드 스모크와 전체 프론트 단위 테스트를 통과시킨다**

~~~powershell
Set-Location frontend
npm run smoke:promotion
npm test
npm run typecheck
npm run lint
~~~

Expected: promotion smoke and all Vitest files pass; typecheck/lint exit 0.

검증 후 첫 번째 터미널에서 `Ctrl+C`로 dev server를 종료한다.

- [ ] **Step 6: 홈 카드와 Analytics 변경을 커밋한다**

~~~powershell
git add -- frontend/app/components/promotions/MerchPromotionCard.tsx frontend/app/components/promotions/index.ts frontend/app/page.tsx frontend/app/admin/analytics/page.tsx frontend/scripts/smoke-merch-promotion.mjs
git diff --cached --check
git commit -m "Add summer atelier promotion card"
~~~

---

### Task 4: 운영 문서와 프로젝트 컨텍스트

**Files:**
- Create: `docs/SUMMER_ATELIER_PROMOTION.md`
- Modify: `AGENTS.md` in the recent changes section
- Reference: `docs/superpowers/specs/2026-08-10-summer-atelier-merch-promotion-design.md`

**Interfaces:**
- Consumes: Task 1~3의 실제 파일·명령·Analytics ID
- Produces: 운영자가 날짜·문구·가격을 안전하게 갱신하고 종료 후 정리할 수 있는 runbook

- [ ] **Step 1: 문서가 아직 없음을 확인하는 검사를 실행한다**

~~~powershell
if (Test-Path 'docs/SUMMER_ATELIER_PROMOTION.md') { throw 'Unexpected pre-existing promotion runbook' }
if (Select-String -LiteralPath 'AGENTS.md' -Pattern 'SUMMER_ATELIER_PROMOTION' -Quiet) {
  throw 'Unexpected pre-existing AGENTS entry'
}
~~~

Expected: command exits 0 because neither document entry exists.

- [ ] **Step 2: 운영 문서를 실제 값으로 작성한다**

`docs/SUMMER_ATELIER_PROMOTION.md`에 다음 내용을 작성한다.

~~~markdown
# 모잉 「여름의 공방」 굿즈 홍보 운영 가이드

## 캠페인 기준

- 캠페인 ID: moing-summer-atelier-2026
- 판매 기간: 2026-08-05 19:00 ~ 2026-08-31 23:59 (UTC+09:00 문맥)
- 종료 배타 경계: 2026-09-01T00:00:00+09:00
- 판매처: https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/
- 출고 안내: 2026-10-07부터 순차 출고 예정
- 가격·판매 상태·배송 조건은 팬텀픽을 최종 기준으로 한다.

## 화면 동작

- 공개 페이지: 세션 동안 닫을 수 있는 전역 띠배너
- 홈: 히어로 다음 상세 카드와 분 단위 카운트다운
- 관리자: /admin 및 하위 경로에서 전역 배너 제외
- 종료 후: 브라우저 경계 타이머가 배너와 카드를 자동으로 숨김

## 변경 위치

- 캠페인 데이터·기간: frontend/app/lib/promotions/summerAtelier.ts
- 전역 배너: frontend/app/components/promotions/MerchPromotionBanner.tsx
- 홈 카드: frontend/app/components/promotions/MerchPromotionCard.tsx
- 브라우저 시간 처리: frontend/app/hooks/usePromotionCampaign.ts
- 브라우저 검증: frontend/scripts/smoke-merch-promotion.mjs

## 안전한 수정 절차

1. 팬텀픽 공식 이벤트·카테고리와 모잉 공식 팬카페 공지를 다시 확인한다.
2. startAt과 endAtExclusive를 명시적 +09:00 ISO 문자열로 수정한다.
3. 가격·특전·출고 문구를 같은 커밋에서 갱신한다.
4. summerAtelier.test.ts의 경계값을 함께 갱신한다.
5. npm test, npm run typecheck, npm run lint, npm run build를 실행한다.
6. 고정 브라우저 시각을 사용하는 npm run smoke:promotion을 실행한다.

## Analytics

- 배너 클릭 ID: moing-summer-atelier-2026:banner
- 카드 클릭 ID: moing-summer-atelier-2026:card
- 배너 위치: merch_promotion_banner
- 카드 위치: merch_promotion_card
- 카드 섹션: promotion-summer-atelier

## 알려진 제약

- 브라우저 시각이 잘못되면 노출 경계도 어긋날 수 있다.
- 판매처의 가격·판매 상태는 실시간 동기화하지 않는다.
- 공식 이미지 재사용 권한을 확인하지 않아 외부 이미지를 사용하지 않는다.
- 자바스크립트가 비활성화되면 정확한 경계를 우선해 프로모션을 표시하지 않는다.

## 종료 후 정리

판매 종료 직후 자동 숨김을 확인한다. 재사용 계획이 없으면 별도 변경으로 layout/page 연결과 캠페인 전용 컴포넌트를 제거하되, 배포 기록과 Analytics 과거 라벨은 보존한다.
~~~

- [ ] **Step 3: AGENTS 최근 변경에 운영 링크를 추가한다**

`AGENTS.md`의 `## 최근 변경` 바로 아래에 다음 항목을 추가한다.

~~~markdown
- **모잉 「여름의 공방」 기간 한정 굿즈 홍보** - 2026-08-31 23:59까지 전역 띠배너와 홈 상세 카드 자동 노출, 마감 카운트다운·세션 닫기·Analytics 추적 추가. 운영 기준은 [굿즈 홍보 운영 가이드](docs/SUMMER_ATELIER_PROMOTION.md) 참조
~~~

- [ ] **Step 4: 문서의 핵심 값과 링크를 검증한다**

~~~powershell
$doc = Get-Content -LiteralPath 'docs/SUMMER_ATELIER_PROMOTION.md' -Raw
foreach ($required in @(
  'moing-summer-atelier-2026',
  '2026-09-01T00:00:00+09:00',
  'https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/',
  'npm run smoke:promotion',
  'merch_promotion_banner',
  'promotion-summer-atelier'
)) {
  if (-not $doc.Contains($required)) { throw "Missing runbook evidence: $required" }
}
if (-not (Select-String -LiteralPath 'AGENTS.md' -Pattern 'docs/SUMMER_ATELIER_PROMOTION.md' -Quiet)) {
  throw 'AGENTS runbook link missing'
}
git diff --check
~~~

- [ ] **Step 5: 운영 문서를 커밋한다**

~~~powershell
git add -- docs/SUMMER_ATELIER_PROMOTION.md AGENTS.md
git diff --cached --check
git commit -m "Document summer merch promotion operations"
~~~

---

### Task 5: 독립 코드 검토와 전체 로컬 검증

**Files:**
- Review: all changes since `d1d233f`
- Temporary output only: `frontend/playwright-snapshots/`

**Interfaces:**
- Consumes: Task 1~4의 구현과 문서
- Produces: 릴리스 가능한 검증 증거와 해결된 review findings

- [ ] **Step 1: 변경 범위와 민감정보를 사전 점검한다**

~~~powershell
git status --short
git diff d1d233f..HEAD --check
git diff d1d233f..HEAD --stat
git diff d1d233f..HEAD --name-only
$changedDiff = git diff d1d233f..HEAD -- . ':!package-lock.json'
if ($changedDiff -match '(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|password\s*=|api[_-]?key\s*=)') {
  throw 'Changed lines may contain credential material'
}
~~~

Expected: only planned feature/docs files; no private key or literal credential.

- [ ] **Step 2: 프론트엔드 전체 품질 게이트를 실행한다**

~~~powershell
Set-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
~~~

Expected: all commands exit 0. Existing lint warnings, if any, must not increase due to changed files.

- [ ] **Step 3: production build를 실행하고 브라우저 스모크를 수행한다**

첫 번째 터미널:

~~~powershell
Set-Location frontend
npm run start
~~~

두 번째 터미널:

~~~powershell
Set-Location frontend
npm run smoke:promotion
npm run capture:screens
~~~

Expected: promotion smoke passes; screenshots are created for 1440, 1024, 390 and admin desktop.

검증이 끝나면 첫 번째 터미널에서 `Ctrl+C`로 production server를 종료한다. 스크린샷은 시각 검토 증거일 뿐 커밋하지 않는다.

- [ ] **Step 4: 스크린샷을 직접 검토한다**

- 1440px: 띠배너, 홈 카드 2열, CTA와 상품 가격이 잘리지 않는다.
- 1024px: 카드 내용이 자연스럽게 재배치되고 가로 스크롤이 없다.
- 390px: 배너 문구, CTA, 닫기 버튼과 카드 상품 목록이 화면 폭 안에 있다.
- 관리자: 홍보 띠배너가 보이지 않는다.
- 버튼 포커스, 44px 터치 영역, 색 대비, 정확한 마감 문구가 확인된다.

- [ ] **Step 5: 필수 리뷰 스킬과 독립 reviewer를 실행한다**

- 여러 TSX를 수정했으므로 `vercel:react-best-practices`를 읽고 변경 파일에 적용한다.
- `superpowers:requesting-code-review`를 사용해 spec compliance와 code quality를 별도 단계로 검토한다.
- reviewer에게 기준 커밋 `d1d233f`, 대상 `HEAD`, 승인 사양 경로를 제공한다.
- P0/P1은 배포 전 반드시 수정한다. P2는 정확성·접근성·회귀 관련이면 수정하고, 보류 시 근거를 운영 문서에 남긴다.

- [ ] **Step 6: 지적이 있으면 실패 재현부터 수정한다**

각 지적마다 관련 Vitest 또는 Playwright assertion을 먼저 추가해 실패를 확인하고, 최소 수정 후 다음을 다시 실행한다.

~~~powershell
Set-Location frontend
npm test
npm run typecheck
npm run lint
npm run build
npm run smoke:promotion
~~~

수정이 있었다면 의도한 파일만 stage하고 다음 메시지로 커밋한다.

~~~powershell
git commit -m "Address merch promotion review findings"
~~~

- [ ] **Step 7: 완료 주장 직전에 verification skill을 실행한다**

`superpowers:verification-before-completion`을 읽고, 최신 HEAD에서 품질 게이트와 clean worktree 증거를 다시 확인한다.

---

### Task 6: PR 검증, merge, GitHub Actions 운영 배포

**Files:**
- No source edits
- Inspect: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- Verify: `https://moingfans.com`

**Interfaces:**
- Consumes: 검토 완료된 clean HEAD
- Produces: green CI를 거쳐 merge된 `origin/main`, 성공한 CD run, 프로덕션 스모크 증거

- [ ] **Step 1: 게시 스킬과 원격 fast-forward 조건을 확인한다**

`github:yeet`를 읽고 scope·커밋·push 안전 점검을 적용한다.

~~~powershell
git status --short
git fetch origin
$head = git rev-parse HEAD
$originMain = git rev-parse origin/main
git merge-base --is-ancestor origin/main HEAD
if ($LASTEXITCODE -ne 0) { throw 'HEAD is not a fast-forward of origin/main' }
"HEAD=$head"
"ORIGIN_MAIN=$originMain"
~~~

Expected: worktree clean and HEAD is a fast-forward of origin/main.

- [ ] **Step 2: 작업 브랜치를 push하고 PR을 만든다**

~~~powershell
git push -u origin codex/local-wip-20260712
$existing = gh pr list --repo ReverserofCode/witchs-cauldron --head codex/local-wip-20260712 --base main --state open --json url | ConvertFrom-Json
if ($existing.Count -eq 0) {
  gh pr create --repo ReverserofCode/witchs-cauldron --base main --head codex/local-wip-20260712 --title "Add summer atelier merch promotion" --body "Adds the date-gated global banner and home promotion card, campaign countdown, Analytics labels, tests, and operations documentation."
}
~~~

Expected: remote feature branch exists and one open PR targets main.

- [ ] **Step 3: PR CI를 완료까지 감시하고 merge한다**

~~~powershell
gh pr checks codex/local-wip-20260712 --repo ReverserofCode/witchs-cauldron --watch
if ($LASTEXITCODE -ne 0) { throw 'PR checks failed' }
gh pr merge codex/local-wip-20260712 --repo ReverserofCode/witchs-cauldron --merge --delete-branch=false
git fetch origin main
git merge --ff-only origin/main
~~~

Expected: CI passes, PR merges, local branch fast-forwards to the main merge commit. If CI fails, use `github:gh-fix-ci` before changing code.

- [ ] **Step 4: 정확한 merge SHA의 CD run을 찾아 완료까지 감시한다**

~~~powershell
$targetSha = git rev-parse origin/main
$runs = gh run list --repo ReverserofCode/witchs-cauldron --workflow CD --branch main --event push --limit 10 --json databaseId,headSha,status,conclusion,url | ConvertFrom-Json
$run = $runs | Where-Object { $_.headSha -eq $targetSha } | Select-Object -First 1
if (-not $run) { throw "CD run not found for $targetSha" }
gh run watch $run.databaseId --repo ReverserofCode/witchs-cauldron --exit-status
gh run view $run.databaseId --repo ReverserofCode/witchs-cauldron
~~~

Expected: build-and-test and deploy jobs both succeed. 배포가 시작되기 전 실패는 fix-forward한다. 배포 후 UI 회귀가 확인되면 main에서 정상 `git revert`를 만들고 CD로 롤백하며 force-push/reset은 사용하지 않는다.

- [ ] **Step 5: 프로덕션 HTTP와 브라우저 스모크를 실행한다**

~~~powershell
$health = Invoke-RestMethod -Uri 'https://moingfans.com/api/health' -TimeoutSec 30
if (-not $health.ok) { throw 'Frontend health is not ok' }
$home = Invoke-WebRequest -Uri 'https://moingfans.com/' -UseBasicParsing -TimeoutSec 30
$broadcasts = Invoke-WebRequest -Uri 'https://moingfans.com/broadcasts' -UseBasicParsing -TimeoutSec 30
if ($home.StatusCode -ne 200 -or $broadcasts.StatusCode -ne 200) {
  throw 'Public route smoke failed'
}
Set-Location frontend
$env:SMOKE_BASE_URL = 'https://moingfans.com'
npm run smoke:promotion
Remove-Item Env:SMOKE_BASE_URL
~~~

Expected: health `ok=true`, public routes 200, active browser promotion smoke passes.

- [ ] **Step 6: 운영 Analytics 보호와 신규 오류를 확인한다**

~~~powershell
try {
  Invoke-WebRequest -Uri 'https://moingfans.com/admin/analytics' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
  throw 'Admin endpoint unexpectedly allowed an unauthenticated request'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
}
~~~

CD의 인증된 Analytics stats 검증이 성공했는지 run log에서 확인한다. 필요하면 `tools/Invoke-ProdSsh.ps1`로 container 상태와 frontend/backend health를 읽기 전용 확인하되, 암호나 host fingerprint를 출력하지 않는다.

---

### Task 7: 실제 배포 결과 문서화와 최종 동기화

**Files:**
- Create: `docs/DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md`
- Modify: `docs/SUMMER_ATELIER_PROMOTION.md`

**Interfaces:**
- Consumes: Task 6에서 관측한 정확한 merge SHA, CD run URL/ID, production smoke 결과
- Produces: 재현 가능한 배포 기록과 최종 clean/pushed repository state

- [ ] **Step 1: 실제 관측값을 수집한다**

~~~powershell
$featureSha = git rev-parse origin/main
$runs = gh run list --repo ReverserofCode/witchs-cauldron --workflow CD --branch main --event push --limit 10 --json databaseId,headSha,conclusion,url,createdAt | ConvertFrom-Json
$featureRun = $runs | Where-Object { $_.headSha -eq $featureSha -and $_.conclusion -eq 'success' } | Select-Object -First 1
if (-not $featureRun) { throw 'Successful feature deployment run evidence is missing' }
$featureRun | Select-Object databaseId,headSha,conclusion,url,createdAt | Format-List
~~~

- [ ] **Step 2: 날짜별 배포 기록을 작성한다**

`docs/DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md`에 다음을 실제 관측값으로 기록한다.

- 운영 URL과 2026-08-10 KST 배포 일자
- 전체 merge SHA와 짧은 SHA
- 실제 GitHub Actions CD run ID 및 링크
- 포함 범위: 시간 모델, 전역 배너, 홈 카드, Analytics 라벨, 운영 문서
- 검증 결과: Vitest, typecheck, lint, build, promotion Playwright, 1440/1024/390 시각 검토
- 운영 스모크: home 200, broadcasts 200, health ok, admin unauthenticated 401, 프로모션 배너·카드·canonical CTA
- 개인정보·secret·SSH fingerprint를 기록하지 않았다는 확인
- 알려진 제약: 브라우저 시각, 정적 가격, 외부 이미지 미사용, 2026-09-01 00:00 +09:00 자동 종료
- 재현 명령: 관측한 숫자 run ID를 넣은 `gh run view`, 공개 health/home/broadcasts 요청, `SMOKE_BASE_URL=https://moingfans.com npm run smoke:promotion`

파일에 예시 run ID나 미완성 표식을 남기지 않는다.

- [ ] **Step 3: 운영 가이드에 배포 결과 링크를 추가한다**

`docs/SUMMER_ATELIER_PROMOTION.md` 끝에 `## 배포 결과` 섹션을 추가하고 다음을 기록한다.

- 기능 배포 성공 일자 2026-08-10 KST
- 배포 기록 상대 링크 `DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md`
- Task 6에서 확인한 실제 merge SHA와 CD run 링크
- 판매 종료 후 자동 숨김 시각 `2026-09-01 00:00:00+09:00`

- [ ] **Step 4: 문서 증거·미완성 표식·secret 검사를 실행한다**

~~~powershell
$record = Get-Content -LiteralPath 'docs/DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md' -Raw
foreach ($required in @(
  'https://moingfans.com',
  '2026-09-01 00:00:00+09:00',
  'smoke:promotion',
  'GitHub Actions'
)) {
  if (-not $record.Contains($required)) { throw "Missing deployment evidence: $required" }
}
$unfinishedMarkers = @('<실제', ('TO' + 'DO'), ('TB' + 'D'), ('PLACE' + 'HOLDER'))
foreach ($marker in $unfinishedMarkers) {
  if ($record.Contains($marker)) { throw "Deployment record contains an unfinished marker: $marker" }
}
if ($record -match '(?i)(password\s*[=:]|private[_-]?key|ssh_host_fingerprint\s*[=:])') {
  throw 'Deployment record may contain secret material'
}
git diff --check
~~~

- [ ] **Step 5: 배포 기록을 documentation-only 커밋으로 만든다**

~~~powershell
git add -- docs/DEPLOYMENT_RECORD_2026-08-10_SUMMER_ATELIER_PROMOTION.md docs/SUMMER_ATELIER_PROMOTION.md
git diff --cached --check
git commit -m "Document summer merch promotion deployment [skip ci]"
~~~

- [ ] **Step 6: 문서 커밋을 브랜치와 main에 동기화한다**

~~~powershell
git push origin HEAD:codex/local-wip-20260712
git push origin HEAD:main
$head = git rev-parse HEAD
$remoteMain = (git ls-remote origin refs/heads/main).Split([char]9)[0]
if ($remoteMain -ne $head) { throw 'Final documentation commit is not on origin/main' }
git status --short
~~~

Expected: both remote refs point to HEAD and worktree is clean. `[skip ci]` 때문에 CD가 생기지 않는 것이 정상이다. 해당 SHA의 run이 생성되면 건너뛰었다고 가정하지 말고 완료까지 감시한다.

- [ ] **Step 7: 최종 사용자 보고 근거를 정리한다**

- 구현된 전역 배너·홈 카드·자동 기간·카운트다운·Analytics
- 공식 판매 기간과 canonical 팬텀픽 링크
- 테스트·리뷰·브라우저·production smoke 결과
- feature merge SHA, documentation SHA, PR URL, CD run 링크
- 자동 종료 시각과 정적 가격/브라우저 시각 제약
- 설계, 구현 계획, 운영 가이드, 배포 기록의 절대 경로 링크
