# FantomPick Official Product Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 권리자 허가 없이 팬텀픽 이미지를 복제·핫링크하지 않으면서, 모잉 「여름의 공방」 상품 5개의 공식 상세 이미지 확인 경로를 프로모션 카드에 제공하고 운영 배포까지 검증한다.

**Architecture:** 캠페인 정적 데이터에 안정적인 상품 ID와 팬텀픽 공식 상세 URL만 추가한다. 기존 카드가 그 데이터를 사용해 상품별 보조 CTA를 렌더링하고 기존 전역 Analytics 클릭 계약을 재사용한다. 이미지 파일·이미지 URL·원격 이미지 설정·런타임 외부 요청은 추가하지 않으며, 단위 테스트와 Playwright smoke가 데이터·DOM·접근성·모바일·비복제 계약을 함께 고정한다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, Vitest 4, Playwright 1.59, GitHub Actions CI/CD, GitHub CLI

## Global Constraints

- 승인된 설계는 `docs/superpowers/specs/2026-08-11-fantompick-product-links-design.md`이며 구현 중 계약의 기준으로 사용한다.
- 팬텀픽 또는 권리자의 재게시 허가는 없다. 팬텀픽 상품 이미지, 스크린샷, OG 이미지, CSS 원격 배경, 이미지 URL을 다운로드·저장·캐싱·핫링크하지 않는다.
- 앱은 팬텀픽 상품 상태를 런타임에 조회하지 않는다. 외부 HTTP 확인은 배포 전 공식 상세 5개의 상태와 최종 호스트를 읽기 전용으로 검증할 때만 수행한다.
- 기존 카테고리 CTA, 배너, 가격, 판매 기간, 카운트다운, 세션 닫기, 관리자 제외, Analytics API·DB 계약은 변경하지 않는다.
- `frontend/next.config.js`, `frontend/package.json`, `frontend/package-lock.json`과 `frontend/public/`은 변경하지 않는다.
- 로컬/운영 브라우저 smoke의 `/api/analytics/track` 요청은 컨텍스트별 HTTP 204로 차단해 합성 이벤트를 저장하지 않는다.
- 자격 증명은 환경 변수로만 전달하고 명령줄, 로그, 문서, 커밋에 실제 값을 쓰지 않는다. primary/fallback 쌍 중 일부만 설정된 상태는 fail closed로 유지한다.
- 기존 2026-08-11 최초 배포 기록은 역사적 사실로 보존한다. 이번 릴리스는 별도 배포 기록으로 남긴다.
- 사용자 소유 변경을 되돌리지 않는다. 각 커밋 전 `git status --short`와 staged scope를 확인한다.

## File and Contract Map

| 책임 | 파일 | 변경 |
|---|---|---|
| 상품 타입·정적 매핑 | `frontend/app/lib/promotions/summerAtelier.ts` | `PromotionProduct.id`, `detailUrl`과 5개 공식 상세 URL 추가 |
| 정적 데이터 계약 | `frontend/app/lib/promotions/summerAtelier.test.ts` | 정확한 ID/URL, 유일성, HTTPS/호스트/상품 번호, 이미지 URL 부재 테스트 |
| 상품별 보조 CTA | `frontend/app/components/promotions/MerchPromotionCard.tsx` | `공식 이미지 보기` 링크, 접근성 이름, 보안/Analytics 속성, 안내 문구 |
| 브라우저 계약 | `frontend/scripts/smoke-merch-promotion.mjs` | 5개 링크·DOM·44px·무오버플로·이미지 비복제 검증 |
| 운영 가이드 | `docs/SUMMER_ATELIER_PROMOTION.md` | 상품별 상세 매핑, 무허가 이미지 정책, 변경·검증 절차, 후속 배포 링크 |
| 후속 배포 기록 | `docs/DEPLOYMENT_RECORD_${deploymentDate}_FANTOMPICK_PRODUCT_LINKS.md` | 실제 merge SHA, PR/CI/CD, 운영 smoke, 참고·롤백 기록 |

`PromotionProduct`의 최종 계약은 다음과 같다.

```ts
export interface PromotionProduct {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly note?: string;
  readonly detailUrl: string;
}
```

Analytics의 최종 상품 링크 계약은 다음과 같다.

```text
data-analytics-menu="true"
data-analytics-id="moing-summer-atelier-2026:product:${product.id}"
data-analytics-label="${product.name} 공식 이미지 보기"
data-analytics-location="merch_promotion_product"
data-analytics-type="promotion_product"
```

---

### Task 1: Lock the five official product-detail contracts with unit-test RED/GREEN

**Files:**
- Modify: `frontend/app/lib/promotions/summerAtelier.test.ts`
- Modify: `frontend/app/lib/promotions/summerAtelier.ts`

- [ ] **Step 1: Add the exact expected product records to the canonical-data test**

Replace the loose `expect.objectContaining` list with an exact list containing the current name, price and optional note plus these ID/URL pairs:

```ts
const expectedProducts = [
  {
    id: "full-set",
    name: "여름의 공방 풀세트",
    price: "77,000원",
    note: "친필 사인 투명 포토카드 1장 증정",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%92%80%EC%84%B8%ED%8A%B8/375/",
  },
  {
    id: "desk-mat",
    name: "여름의 공방 장패드",
    price: "30,000원",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%EC%9E%A5%ED%8C%A8%EB%93%9C/376/",
  },
  {
    id: "acrylic-stand",
    name: "비키니 모잉 아크릴 스탠드",
    price: "35,000원",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%95%84%ED%81%AC%EB%A6%B4-%EC%8A%A4%ED%83%A0%EB%93%9C/377/",
  },
  {
    id: "can-badge",
    name: "비키니 모잉 캔뱃지",
    price: "7,500원",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%BA%94%EB%B1%83%EC%A7%80/378/",
  },
  {
    id: "photocard-set",
    name: "여름의 공방 포토카드 세트",
    price: "7,000원",
    detailUrl:
      "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%8F%AC%ED%86%A0%EC%B9%B4%EB%93%9C-%EC%84%B8%ED%8A%B8/379/",
  },
] as const;

expect(SUMMER_ATELIER_CAMPAIGN.products).toEqual(expectedProducts);
```

- [ ] **Step 2: Add invariant tests for uniqueness, official URLs and image non-reuse**

Add a dedicated test that parses every `detailUrl` and checks:

```ts
const products = SUMMER_ATELIER_CAMPAIGN.products;
expect(new Set(products.map(({ id }) => id)).size).toBe(products.length);
expect(new Set(products.map(({ detailUrl }) => detailUrl)).size).toBe(products.length);

const productNumbers = products.map(({ detailUrl }) => {
  const url = new URL(detailUrl);
  expect(url.protocol).toBe("https:");
  expect(url.hostname).toBe("fantompick.com");
  expect(url.search).toBe("");
  expect(url.hash).toBe("");
  expect(url.pathname).toMatch(/^\/product\/.+\/(37[5-9])\/$/);
  expect(url.pathname).not.toMatch(/\/web\/(product|upload)\//);
  return url.pathname.match(/\/(37[5-9])\/$/)?.[1];
});

expect(productNumbers).toEqual(["375", "376", "377", "378", "379"]);
for (const product of products) {
  expect("imageSrc" in product).toBe(false);
  expect("imageUrl" in product).toBe(false);
}
```

- [ ] **Step 3: Run the focused test and capture the expected RED**

Run:

```powershell
Set-Location frontend
npx vitest run app/lib/promotions/summerAtelier.test.ts
```

Expected RED: the exact product records fail because `id` and `detailUrl` do not exist. Preserve the exit code and concise failure in the ignored task report; do not commit the failing state.

- [ ] **Step 4: Add the minimal type fields and exact five mappings**

Update `PromotionProduct` exactly as defined in the File and Contract Map. Add each stable ID and its matching official URL to the existing five objects without changing current names, prices or the full-set note. Use `product.id` as the later DOM key; do not add any image metadata.

- [ ] **Step 5: Run focused GREEN and type checking**

Run:

```powershell
Set-Location frontend
npx vitest run app/lib/promotions/summerAtelier.test.ts
npm run typecheck
```

Expected GREEN: all promotion unit tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the data contract**

Run from the worktree root:

```powershell
git diff --check
git status --short
git add frontend/app/lib/promotions/summerAtelier.ts frontend/app/lib/promotions/summerAtelier.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "Add official FantomPick product links"
```

Expected staged scope: exactly the two listed files.

---

### Task 2: Render accessible, tracked per-product links with browser-test RED/GREEN

**Files:**
- Modify: `frontend/scripts/smoke-merch-promotion.mjs`
- Modify: `frontend/app/components/promotions/MerchPromotionCard.tsx`

- [ ] **Step 1: Define exact expected link metadata in the smoke script**

Near `canonicalStoreUrl`, add an immutable `officialProducts` array containing the same five `id`, `name` and `detailUrl` values from Task 1. Do not include an image URL.

- [ ] **Step 2: Add desktop link, security, Analytics and no-image assertions before UI code**

Before creating `activePage`, observe all requests from `activeContext` so rendered CSS backgrounds, image loads and other runtime fetches are covered while passive external link `href` values remain harmless:

```js
const fantompickRuntimeRequests = [];
activeContext.on("request", (request) => {
  const hostname = new URL(request.url()).hostname;
  if (hostname === "fantompick.com" || hostname.endsWith(".fantompick.com")) {
    fantompickRuntimeRequests.push(request.url());
  }
});
```

After the existing product text checks, assert exactly five marked links and verify each item:

```js
const productLinks = card.locator("[data-promotion-product-link]");
assert.equal(await productLinks.count(), officialProducts.length);

for (const product of officialProducts) {
  const link = card.getByRole("link", {
    name: `${product.name} 공식 이미지 보기, 새 탭에서 열림`,
    exact: true,
  });
  assert.equal(await link.count(), 1);
  assert.equal(await link.getAttribute("href"), product.detailUrl);
  assert.equal(await link.getAttribute("target"), "_blank");
  assert.match(await link.getAttribute("rel"), /noopener/);
  assert.match(await link.getAttribute("rel"), /noreferrer/);
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
```

- [ ] **Step 3: Extend the 390px contract**

Wait for the mobile card and check page overflow plus all five product-link hit targets:

```js
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

assert.equal(
  await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true
);
```

- [ ] **Step 4: Start a scoped production server and capture the expected browser RED**

Use non-secret local credentials in environment variables only, build the current pre-UI state, and start it on an unused loopback port. In terminal 1:

```powershell
Set-Location frontend
$env:ADMIN_BASIC_AUTH_USERNAME = 'local-smoke-admin'
$env:ADMIN_BASIC_AUTH_PASSWORD = 'local-smoke-password-3161-only'
npm run build
npx next start -H 127.0.0.1 -p 3161
```

In terminal 2, pass the same in-memory pair and run:

```powershell
Set-Location frontend
$env:ADMIN_BASIC_AUTH_USERNAME = 'local-smoke-admin'
$env:ADMIN_BASIC_AUTH_PASSWORD = 'local-smoke-password-3161-only'
$env:SMOKE_BASE_URL = 'http://127.0.0.1:3161'
$env:SMOKE_ADMIN_USERNAME = $env:ADMIN_BASIC_AUTH_USERNAME
$env:SMOKE_ADMIN_PASSWORD = $env:ADMIN_BASIC_AUTH_PASSWORD
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run smoke:promotion
```

Expected RED: the product-link count or accessible-link lookup fails. Record the exact first failing assertion and nonzero exit. Stop only the server process started for this task and clear task-specific environment variables.

- [ ] **Step 5: Implement the minimal product-link UI**

Change the product key to `product.id`. Below the existing note, add this link:

```tsx
<a
  href={product.detailUrl}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={`${product.name} 공식 이미지 보기, 새 탭에서 열림`}
  className="mt-2 inline-flex min-h-11 items-center rounded-xl border border-purple-200 bg-white/80 px-3 py-2 text-xs font-bold text-purple-800 transition-colors hover:border-purple-300 hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2"
  data-promotion-product-link={product.id}
  data-analytics-menu="true"
  data-analytics-id={`${SUMMER_ATELIER_CAMPAIGN.id}:product:${product.id}`}
  data-analytics-label={`${product.name} 공식 이미지 보기`}
  data-analytics-location="merch_promotion_product"
  data-analytics-type="promotion_product"
>
  공식 이미지 보기
</a>
```

Add `상품 이미지는 팬텀픽 공식 상세에서 확인해 주세요.` to the existing shipping/verification block. Keep the existing category CTA unchanged.

- [ ] **Step 6: Rebuild and run browser GREEN against the same loopback contract**

Build after the implementation and start on port 3162 with `ADMIN_BASIC_AUTH_USERNAME=local-smoke-admin` and `ADMIN_BASIC_AUTH_PASSWORD=local-smoke-password-3162-only`. In the smoke terminal explicitly set the same two server variables, set `SMOKE_ADMIN_USERNAME`/`SMOKE_ADMIN_PASSWORD` from them, and set `SMOKE_BASE_URL=http://127.0.0.1:3162`. Expected output:

```text
merch promotion smoke ok
```

Also confirm the server process is closed and both ports 3161 and 3162 no longer listen.

- [ ] **Step 7: Run focused code gates**

Run:

```powershell
Set-Location frontend
npx eslint app/components/promotions/MerchPromotionCard.tsx app/lib/promotions/summerAtelier.ts app/lib/promotions/summerAtelier.test.ts scripts/smoke-merch-promotion.mjs --max-warnings=0
npm run typecheck
```

Expected: both commands exit 0 with zero warnings in the changed scope.

- [ ] **Step 8: Commit the UI and browser contract**

Run from the worktree root:

```powershell
git diff --check
git add frontend/app/components/promotions/MerchPromotionCard.tsx frontend/scripts/smoke-merch-promotion.mjs
git diff --cached --check
git diff --cached --name-only
git commit -m "Show official images through product links"
```

Expected staged scope: exactly the card and smoke files.

---

### Task 3: Update the operating policy and verify the complete local release candidate

**Files:**
- Modify: `docs/SUMMER_ATELIER_PROMOTION.md`
- Do not modify: `docs/DEPLOYMENT_RECORD_2026-08-11_SUMMER_ATELIER_PROMOTION.md`

- [ ] **Step 1: Document the five official detail mappings and rights-safe behavior**

Update the runbook's confirmation date to `2026-08-11`. Add a product-detail URL column or a compact mapping table for product numbers 375–379. State explicitly:

- each `공식 이미지 보기` opens the matching official product detail in a new tab;
- the project stores only official detail-page URLs, not image files or image delivery URLs;
- absent reuse permission, images remain neither copied nor hotlinked;
- detail URL changes require `summerAtelier.ts`, unit expectations, browser smoke expectations and this runbook to change together;
- the item links use `merch_promotion_product` / `promotion_product` Analytics with IDs under `moing-summer-atelier-2026:product:`;
- `next.config.js` remote-image patterns remain unchanged.

- [ ] **Step 2: Add the local verification contract to the runbook**

Describe that `smoke:promotion` verifies exactly five official links, accessible names, `_blank`, `noopener noreferrer`, per-product Analytics, 44px mobile height, no horizontal overflow and no FantomPick image element/background. Preserve the existing credential and Analytics interception guidance.

- [ ] **Step 3: Run the full local quality gate from fresh source state**

Run from `frontend` without modifying dependencies:

```powershell
npm test
npm run typecheck
npx eslint app/components/promotions/MerchPromotionCard.tsx app/lib/promotions/summerAtelier.ts app/lib/promotions/summerAtelier.test.ts scripts/smoke-merch-promotion.mjs --max-warnings=0
npm run lint
npm run build
```

Expected:

- all Vitest files and tests pass;
- typecheck exits 0;
- changed scope has zero ESLint warnings;
- full lint has zero errors (known unrelated warnings may remain only if unchanged from the recorded baseline);
- production build exits 0.

- [ ] **Step 4: Run authenticated GREEN smoke and capture responsive evidence**

Start the new production build on fresh loopback port 3163. In terminal 1:

```powershell
Set-Location frontend
$env:ADMIN_BASIC_AUTH_USERNAME = 'local-smoke-admin'
$env:ADMIN_BASIC_AUTH_PASSWORD = 'local-smoke-password-3163-only'
npx next start -H 127.0.0.1 -p 3163
```

In terminal 2, set the same local-only server pair plus each consumer's explicit primary pair and an ignored evidence directory, then run:

```powershell
Set-Location frontend
$env:ADMIN_BASIC_AUTH_USERNAME = 'local-smoke-admin'
$env:ADMIN_BASIC_AUTH_PASSWORD = 'local-smoke-password-3163-only'
$env:SMOKE_BASE_URL = 'http://127.0.0.1:3163'
$env:SMOKE_ADMIN_USERNAME = $env:ADMIN_BASIC_AUTH_USERNAME
$env:SMOKE_ADMIN_PASSWORD = $env:ADMIN_BASIC_AUTH_PASSWORD
$env:SNAP_BASE_URL = $env:SMOKE_BASE_URL
$env:SNAP_ADMIN_USERNAME = $env:ADMIN_BASIC_AUTH_USERNAME
$env:SNAP_ADMIN_PASSWORD = $env:ADMIN_BASIC_AUTH_PASSWORD
$env:SNAP_OUT_DIR = 'playwright-screenshots/fantompick-product-links-local'
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run smoke:promotion
npm run capture:screens
```

Use `SMOKE_BASE_URL`/`SNAP_BASE_URL`, `SMOKE_ADMIN_*`/`SNAP_ADMIN_*`, and `CHROMIUM_PATH` as documented. Expected:

- `merch promotion smoke ok`;
- desktop 1440px, tablet 1024px, mobile 390px and authenticated admin captures are created;
- the five product links are legible, remain inside their tiles, and do not visually overpower the primary category CTA;
- no screenshot or image from FantomPick is captured into tracked project paths.

Inspect the captures at original detail and record their absolute local evidence paths only in the ignored task report. Verify `git check-ignore -v frontend/playwright-screenshots/fantompick-product-links-local/*` reports the `playwright-screenshots` rule, do not stage generated captures, stop the port-3163 server, clear task-specific environment variables, and confirm the port is closed.

- [ ] **Step 5: Check forbidden artifacts, dependency drift, secrets and diff scope**

Run from the worktree root:

```powershell
git diff --check
git status --short
git diff -- frontend/next.config.js frontend/package.json frontend/package-lock.json
rg -n "fantompick\.com/(web/product|web/upload)|<img[^>]+fantompick|url\([^)]*fantompick" frontend docs --glob '!docs/superpowers/specs/**' --glob '!docs/superpowers/plans/**'
rg -n "(BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})" . --glob '!.git/**' --glob '!node_modules/**'
```

Expected:

- `git diff --check` is clean;
- config and dependency diff is empty;
- forbidden image-delivery search has no matches;
- secret-pattern scan has no new matches;
- tracked changes are only planned source/test/doc files.

- [ ] **Step 6: Commit the runbook update**

Run:

```powershell
git add docs/SUMMER_ATELIER_PROMOTION.md
git diff --cached --check
git diff --cached --name-only
git commit -m "Document official product link policy"
```

Expected staged scope: exactly the runbook.

---

### Task 4: Obtain independent implementation and release-candidate reviews

**Files:**
- Review the full branch diff from `origin/main` through `HEAD`
- Modify only files implicated by validated findings

- [ ] **Step 1: Dispatch a spec-compliance reviewer**

Ask a read-only reviewer to compare the branch against the approved design and this plan. The reviewer must explicitly verify:

- exact five item IDs and official URLs;
- no copied/hotlinked product imagery or remote image configuration;
- accessible names and 44px targets;
- new-tab security attributes;
- product Analytics tuple;
- unchanged campaign timing/category CTA/banner/admin behavior;
- tests and documentation.

- [ ] **Step 2: Dispatch a code-quality and test-quality reviewer independently**

Ask a second read-only reviewer to inspect TypeScript/React correctness, DOM semantics, responsive Tailwind behavior, smoke determinism, Analytics interception, URL validation and secret/dependency scope. The second review must not rely on the first review's conclusion.

- [ ] **Step 3: Triage every finding with evidence**

For each finding:

1. reproduce or inspect the exact code path;
2. accept only actionable, in-scope findings;
3. add or strengthen a failing test first when behavior changes;
4. implement the smallest fix;
5. rerun focused GREEN plus affected full gates;
6. commit with a descriptive message.

Do not make speculative changes to unrelated warnings or infrastructure.

- [ ] **Step 4: Request clean re-review**

Re-run both scoped reviews after fixes. Do not publish while either reviewer reports an unresolved correctness, security, accessibility, rights-policy or test-evidence concern.

- [ ] **Step 5: Run final verification immediately before publishing**

Run fresh:

```powershell
Set-Location frontend
npm test
npm run typecheck
npx eslint app/components/promotions/MerchPromotionCard.tsx app/lib/promotions/summerAtelier.ts app/lib/promotions/summerAtelier.test.ts scripts/smoke-merch-promotion.mjs --max-warnings=0
npm run lint
npm run build
Set-Location ..
git diff --check origin/main...HEAD
git status --short --branch
```

Expected: all gates pass, branch is ahead only by intended commits, and worktree has no uncommitted tracked changes.

---

### Task 5: Publish through PR, CI, merge and the exact production CD run

**Files:**
- No source edits expected before deployment
- Read: `.github/workflows/ci.yml`
- Read: `.github/workflows/cd.yml`

- [ ] **Step 1: Re-verify external targets without downloading their content**

Issue `HEAD` requests for the five exact `detailUrl` values with redirects enabled and never read or persist a response body. Use the Task 1 `expectedProducts` URLs as `$officialProductTargets`, then run:

```powershell
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.AllowAutoRedirect = $true
$client = [System.Net.Http.HttpClient]::new($handler)
try {
  foreach ($target in $officialProductTargets) {
    $request = [System.Net.Http.HttpRequestMessage]::new(
      [System.Net.Http.HttpMethod]::Head,
      $target.detailUrl
    )
    $response = $client.SendAsync(
      $request,
      [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead
    ).GetAwaiter().GetResult()
    try {
      $finalUri = $response.RequestMessage.RequestUri
      if ([int]$response.StatusCode -ne 200) { throw "Unexpected HTTP status" }
      if ($finalUri.Scheme -ne 'https' -or $finalUri.Host -ne 'fantompick.com') {
        throw "Unexpected final FantomPick URI"
      }
    } finally {
      $response.Dispose()
      $request.Dispose()
    }
  }
} finally {
  $client.Dispose()
  $handler.Dispose()
}
```

For each result require:

- HTTP 200 after redirects;
- final URI scheme `https`;
- final host exactly `fantompick.com`;
- final product path still ends in `/375/` through `/379/` respectively.

Record only status, final URL and KST verification time; do not store response bodies or images.

- [ ] **Step 2: Load the publishing skill and verify GitHub authentication**

Before any external write, read and follow `github:yeet`. Then run read-only checks:

```powershell
gh auth status
git remote -v
git status --short --branch
git log --oneline origin/main..HEAD
```

Confirm the repository is `ReverserofCode/witchs-cauldron`, the branch is `codex/fantompick-product-links-20260811`, and only intended commits will be pushed.

- [ ] **Step 3: Push the feature branch and open a ready PR**

Run:

```powershell
git push -u origin codex/fantompick-product-links-20260811
gh pr create --base main --head codex/fantompick-product-links-20260811 --title "Add official FantomPick product links" --body "Adds rights-safe per-product links to official FantomPick detail pages without copying or hotlinking product images. Includes exact data contracts, accessible 44px CTAs, per-product Analytics, browser regression coverage, and operating documentation."
```

Record the PR number and URL.

- [ ] **Step 4: Wait for and inspect the exact PR CI run**

Run:

```powershell
gh pr checks --watch --interval 15
gh run list --workflow CI --branch codex/fantompick-product-links-20260811 --limit 3
```

Require every mandatory check to conclude `success`. If CI fails, inspect logs, reproduce locally, fix through a new commit, rerun full relevant gates, push and wait again.

- [ ] **Step 5: Merge without rewriting history and capture the merge SHA**

After clean CI and reviews:

```powershell
gh pr merge --merge --delete-branch
gh pr view --json number,url,state,mergedAt,mergeCommit
```

Require state `MERGED`. Store the exact 40-character `mergeCommit.oid` in a shell variable for subsequent run matching.

- [ ] **Step 6: Match and monitor the CD run for that exact merge SHA**

Poll `gh run list --workflow CD --commit $mergeSha` until the new run appears, then:

```powershell
gh run watch $cdRunId --exit-status
gh run view $cdRunId --json databaseId,url,headSha,status,conclusion,createdAt,updatedAt,jobs
```

Require:

- `headSha` equals the exact merge SHA;
- `build-and-test` concludes `success`;
- `deploy` concludes `success`;
- overall conclusion is `success`.

Do not substitute an older green run.

---

### Task 6: Verify production behavior without creating analytics or navigating to FantomPick

**Files:**
- No tracked source edits expected
- Use: `frontend/scripts/smoke-merch-promotion.mjs`

- [ ] **Step 1: Run public HTTP health and route probes**

Run:

```powershell
$health = Invoke-RestMethod -Uri 'https://moingfans.com/api/health' -TimeoutSec 30
if (-not $health.ok) { throw 'Frontend health is not ok' }

$home = Invoke-WebRequest -Uri 'https://moingfans.com/' -UseBasicParsing -TimeoutSec 30
$broadcasts = Invoke-WebRequest -Uri 'https://moingfans.com/broadcasts' -UseBasicParsing -TimeoutSec 30
if ($home.StatusCode -ne 200 -or $broadcasts.StatusCode -ne 200) {
  throw 'Public route smoke failed'
}

try {
  Invoke-WebRequest -Uri 'https://moingfans.com/admin/analytics' -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
  throw 'Admin route unexpectedly allowed anonymous access'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
}
```

Expected: health `ok=true`, home 200, broadcasts 200, anonymous admin 401.

- [ ] **Step 2: Run the production browser smoke with analytics interception**

Provide the complete admin pair through environment variables, never command arguments:

```powershell
Set-Location frontend
$env:SMOKE_BASE_URL = 'https://moingfans.com'
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run smoke:promotion
Remove-Item Env:SMOKE_BASE_URL
Remove-Item Env:CHROMIUM_PATH
```

Expected output: `merch promotion smoke ok`. The script must inspect link attributes only and must not click or navigate to FantomPick. Its synthetic Analytics requests must be fulfilled locally with 204.

- [ ] **Step 3: Capture and inspect fresh production evidence**

Run the existing screenshot capture against `https://moingfans.com` with a complete authenticated admin pair, Analytics interception and `SNAP_OUT_DIR=playwright-screenshots/fantompick-product-links-production`. Inspect 1440px, 1024px, 390px and admin captures at original detail. Confirm:

- five link controls fit their tiles;
- no horizontal overflow or clipped link label;
- primary category CTA and timer retain visual hierarchy;
- no copied product art appears;
- authenticated admin remains promotion-free.

Confirm the output with `git check-ignore -v`, keep captures in that ignored evidence location and record their absolute paths in the task report, not in Git.

- [ ] **Step 4: Check production assertion failures and CD evidence**

Inspect the production smoke/capture exit status and assertion output, then inspect the exact CD job logs for deployment errors. Any assertion failure, wrong URL, unexpected FantomPick runtime request, missing link, Analytics leakage, rights-policy violation or layout regression blocks completion and triggers a normal fix/revert deployment. Do not claim page-error or console-error evidence unless a script explicitly collected it.

---

### Task 7: Record the deployment and finish the remote state

**Files:**
- Create: `docs/DEPLOYMENT_RECORD_${deploymentDate}_FANTOMPICK_PRODUCT_LINKS.md`
- Modify: `docs/SUMMER_ATELIER_PROMOTION.md`
- Preserve: `docs/DEPLOYMENT_RECORD_2026-08-11_SUMMER_ATELIER_PROMOTION.md`

- [ ] **Step 1: Derive the deployment record date from the actual CD run**

Convert the CD run `createdAt` from UTC to `Asia/Seoul` and use that date in both the filename and document heading. Do not hard-code the date if the run crosses a KST day boundary.

- [ ] **Step 2: Write the standalone follow-up deployment record**

Include only observed evidence:

- objective and rights decision (no permission, therefore no image reproduction/hotlink);
- exact five official product pages and verification time;
- implementation commits, PR URL/number, merge SHA;
- CI run and exact matching CD run IDs/URLs/timestamps/jobs;
- local test/typecheck/lint/build/smoke counts and outcomes;
- production health/home/broadcasts/admin outcomes;
- production browser link, accessibility, security, Analytics interception and responsive outcomes;
- evidence capture paths and ignored/untracked policy;
- no dependency/config/image asset changes;
- operational caveats, URL-maintenance steps, auto-expiry and `git revert` rollback procedure.

Do not write secrets, invented values or unverified claims.

- [ ] **Step 3: Add the follow-up deployment result to the runbook**

Append a clearly labeled follow-up release entry linking the new deployment record. Preserve the original PR #3 / SHA / CD entry as the initial campaign deployment history.

- [ ] **Step 4: Validate the documentation-only delta**

Run:

```powershell
git diff --check
$placeholderPattern = ('TO' + 'DO|TB' + 'D|PLACE' + 'HOLDER|ghp_|github_pat_|BEGIN .* PRIVATE KEY')
rg -n $placeholderPattern docs/DEPLOYMENT_RECORD_*_FANTOMPICK_PRODUCT_LINKS.md docs/SUMMER_ATELIER_PROMOTION.md
git status --short
```

Expected: no placeholders/secrets, clean whitespace and only the intended docs delta.

- [ ] **Step 5: Commit and publish the post-deploy record without launching a redundant CD**

Fetch `origin/main`, create a docs-only branch from the deployed main head if needed, and commit:

```powershell
git add docs/DEPLOYMENT_RECORD_*_FANTOMPICK_PRODUCT_LINKS.md docs/SUMMER_ATELIER_PROMOTION.md
git diff --cached --check
git diff --cached --name-only
git commit -m "Document FantomPick product link deployment [skip ci]"
```

Push through the repository's safe GitHub workflow. If branch protection requires a PR, open and merge a docs-only PR. Confirm the resulting main commit contains `[skip ci]` and does not start an unnecessary CD run; if repository behavior still creates a skipped run, record its skipped conclusion.

- [ ] **Step 6: Perform the final remote and production audit**

Verify:

```powershell
git fetch origin main
git log -1 --oneline origin/main
git status --short --branch
gh pr view $featurePrNumber --json state,mergeCommit,url
gh run view $cdRunId --json headSha,conclusion,url,jobs
```

Then repeat a non-mutating health probe. Completion requires:

- feature PR merged;
- exact merge CD green;
- documentation present on `origin/main`;
- local tracked worktree clean;
- production health still `ok=true`;
- no official image files or delivery URLs in tracked runtime code;
- campaign auto-expiry remains `2026-09-01T00:00:00+09:00`.

## Completion Evidence Checklist

- [ ] Exact five product IDs/URLs unit-tested and mapped one-to-one to 375–379
- [ ] Exactly five accessible product links rendered during the active campaign
- [ ] `_blank` plus `noopener noreferrer` on every product link
- [ ] Per-product Analytics IDs/labels/location/type verified
- [ ] 390px link height at least 44px and no horizontal overflow
- [ ] No FantomPick image file, image delivery URL, hotlink, remote image config or new dependency
- [ ] Full local tests, typecheck, scoped lint, full lint, build and authenticated browser smoke green
- [ ] Two independent clean reviews
- [ ] Official URLs rechecked as HTTPS 200 on exact FantomPick host
- [ ] PR CI green, merged, exact merge SHA CD green
- [ ] Production health/routes/admin/browser/responsive evidence green without Analytics writes
- [ ] Separate follow-up deployment record committed to `origin/main`
- [ ] Final local and remote state clean; automatic campaign expiry unchanged
