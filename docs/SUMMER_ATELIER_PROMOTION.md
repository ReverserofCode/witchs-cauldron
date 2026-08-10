# 모잉 「여름의 공방」 굿즈 홍보 운영 가이드

> ScopeTag: `frontend`
> 최종 확인일: 2026-08-10

## 개요 (Overview)

모잉 「여름의 공방」 주문제작 예약 판매를 안내하는 기간 한정 프론트엔드 캠페인의 운영 runbook입니다. 판매 조건의 공식 기준은 항상 팬텀픽이며, 이 문서는 사이트 노출 기간과 안전한 변경·검증 절차를 설명합니다.

## 캠페인 기준

| 항목 | 값 |
|---|---|
| 캠페인 ID | `moing-summer-atelier-2026` |
| 공식 canonical 판매처 | <https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/> |
| 교차 확인 출처 | [팬텀픽 이벤트](https://fantompick.com/article/event/8/7353/), [모잉 공식 팬카페 공지](https://cafe.naver.com/moinge/10132) |
| 판매 기간 | 2026-08-05 19:00 ~ 2026-08-31 23:59 |
| 종료 배타 경계 | `2026-09-01T00:00:00+09:00` |
| 출고 안내 | 2026-10-07부터 순차 출고 예정 |

공식 원문에 `KST` 표기가 직접 확인되지 않았지만, 한국 국내몰과 한국어 공식 팬카페 공지가 같은 시각을 안내합니다. 따라서 사이트는 UTC+09:00(한국 시간) 문맥으로 운영합니다. 시작은 `startAt` 이상부터 노출하고, 종료는 `endAtExclusive` 이상인 순간부터 숨깁니다. 즉, 2026-08-31 23:59까지 판매 안내를 표시하며 2026-09-01 00:00:00+09:00부터는 종료 상태입니다.

가격·판매 상태·배송 조건은 실시간으로 동기화하지 않으므로, 변경 또는 안내 전에는 위 팬텀픽 canonical 판매처를 최종 기준으로 다시 확인합니다.

### 상품 및 배송 조건

| 상품 | 판매가 | 조건·규격 |
|---|---:|---|
| 여름의 공방 풀세트 | 77,000원 | 정가 79,500원. 풀세트 1개당 친필 사인 투명 포토카드 1장 증정 |
| 여름의 공방 장패드 | 30,000원 | 80×40cm |
| 비키니 모잉 아크릴 스탠드 | 35,000원 | 약 7×17cm |
| 비키니 모잉 캔뱃지 | 7,500원 | 43×70mm |
| 여름의 공방 포토카드 세트 | 7,000원 | 54×86mm |

- 국내 배송비는 4,000원입니다.
- 모잉 MD 합계 50,000원 이상은 무료 배송이며, 다른 크리에이터 상품과 합산할 수 없습니다.
- 개별 상품만 구매하면 풀세트 구매 특전은 지급되지 않습니다.

## 화면 동작과 변경 위치

| 화면 | 동작 |
|---|---|
| 공개 페이지 | 전역 띠배너를 표시합니다. 사용자는 현재 브라우저 세션에서만 닫을 수 있습니다. |
| 홈 (`/`) | 히어로 직후 상세 카드와 일·시간·분 단위 마감 카운트다운을 표시합니다. |
| 관리자 (`/admin` 및 하위 경로) | 전역 띠배너를 표시하지 않습니다. |
| 종료 경계 | 브라우저 타이머가 경계 시각에 배너와 카드를 자동으로 숨깁니다. 페이지 ISR 주기에 의존하지 않습니다. |

| 책임 | 파일 |
|---|---|
| 캠페인 데이터·기간·순수 시간 함수 | `frontend/app/lib/promotions/summerAtelier.ts` |
| 기간 경계 테스트 | `frontend/app/lib/promotions/summerAtelier.test.ts` |
| 전역 배너·세션 닫기 | `frontend/app/components/promotions/MerchPromotionBanner.tsx` |
| 홈 상세 카드 | `frontend/app/components/promotions/MerchPromotionCard.tsx` |
| 브라우저 시간 처리 | `frontend/app/hooks/usePromotionCampaign.ts` |
| 고정 시간 브라우저 검증 | `frontend/scripts/smoke-merch-promotion.mjs` |

캠페인은 런타임 판매처 API, DB, 재고 store에 의존하지 않습니다. CTA는 추적 파라미터가 없는 canonical 카테고리 URL만 사용합니다. 공식 이미지의 재사용 권한을 확인하지 않았으므로 외부 이미지를 다운로드·핫링크·복제하지 않으며, 기존 프로젝트 자산과 CSS만 사용합니다.

## 안전한 수정 및 연장 절차

1. 팬텀픽 공식 이벤트·canonical 카테고리·모잉 공식 팬카페 공지를 다시 확인합니다.
2. `summerAtelier.ts`의 `startAt`과 `endAtExclusive`를 명시적 `+09:00` ISO 문자열로 수정합니다. 종료 시각은 반드시 배타 경계로 저장합니다.
3. 가격, 정가, 특전, 배송비·무료 배송 조건, 출고 문구를 같은 커밋에서 함께 갱신합니다.
4. `summerAtelier.test.ts`의 시작·종료 경계값과 `smoke-merch-promotion.mjs`의 고정 시각/기대 문구를 함께 갱신합니다.
5. 아래 품질 게이트와 고정 브라우저 시각 smoke를 모두 실행합니다.
6. 배포 후 공개 홈과 `/broadcasts`에서 노출을, `/admin`에서 배너 미노출을 확인합니다.

기간 연장은 위 절차로 새 `endAtExclusive`와 판매 문구를 함께 배포합니다. 이미 종료된 캠페인을 연장할 때도 브라우저가 종료 상태를 캐시하지 않으므로, 새 배포본의 날짜를 기준으로 다시 노출됩니다.

잘못된 가격·기간·링크가 배포되었으면 가장 안전한 롤백은 마지막 정상 커밋을 대상으로 새 `git revert` 커밋을 만들고 기존 CD 절차로 배포하는 것입니다. `reset`이나 force-push로 운영 이력을 바꾸지 않습니다. 판매가 실제로 끝난 경우에는 날짜를 되돌리지 말고 자동 숨김을 유지합니다.

## Analytics

| 항목 | 값 |
|---|---|
| 배너 클릭 ID | `moing-summer-atelier-2026:banner` |
| 카드 클릭 ID | `moing-summer-atelier-2026:card` |
| 배너 위치 | `merch_promotion_banner` |
| 카드 위치 | `merch_promotion_card` |
| 카드 섹션 | `promotion-summer-atelier` |

카드 섹션 노출은 활성 기간에만 기존 `SectionTracker` 정책으로 기록됩니다. 종료 뒤 코드 정리를 하더라도 Analytics의 과거 라벨과 배포 기록은 보존합니다.

## 검증 및 배포 점검

### 로컬 품질 게이트

`frontend` 디렉터리에서 실행합니다.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

기본 smoke는 Playwright가 관리하는 Chromium을 사용합니다. 먼저 로컬 서버를 실행한 뒤 별도 터미널에서 실행합니다.
프로모션 smoke와 스크린샷 캡처는 합성 방문이 운영 분석에 섞이지 않도록 모든 `/api/analytics/track` 요청을 브라우저 컨텍스트에서 로컬 HTTP 204로 차단합니다.
관리자 검증은 인증된 실제 대시보드만 통과하도록 완전한 자격 증명 쌍을 요구합니다. smoke의 `SMOKE_ADMIN_USERNAME`/`SMOKE_ADMIN_PASSWORD` 또는 캡처의 `SNAP_ADMIN_USERNAME`/`SNAP_ADMIN_PASSWORD` 중 하나라도 설정했다면 해당 기본 쌍을 둘 다 비어 있지 않게 제공해야 합니다. 기본 쌍의 두 변수가 모두 미설정일 때만 완전한 `ADMIN_BASIC_AUTH_USERNAME`/`ADMIN_BASIC_AUTH_PASSWORD` 쌍을 fallback으로 사용합니다. 서버에도 일치하는 `ADMIN_BASIC_AUTH_*` 값을 안전한 로컬 환경 변수로 제공해야 하며 실제 값은 명령 기록이나 문서에 남기지 않습니다.

```powershell
# 터미널 1
Set-Location frontend
npm run dev

# 터미널 2
Set-Location frontend
npm run smoke:promotion
```

로컬 Google Chrome을 명시적으로 사용하려면 다음처럼 `CHROMIUM_PATH`를 설정합니다.

```powershell
Set-Location frontend
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
[Environment]::SetEnvironmentVariable('SMOKE_ADMIN_USERNAME', $env:ADMIN_BASIC_AUTH_USERNAME)
[Environment]::SetEnvironmentVariable('SMOKE_ADMIN_PASSWORD', $env:ADMIN_BASIC_AUTH_PASSWORD)
npm run smoke:promotion
Remove-Item Env:CHROMIUM_PATH
Remove-Item Env:SMOKE_ADMIN_USERNAME
Remove-Item Env:SMOKE_ADMIN_PASSWORD
```

기본 `127.0.0.1:3000` 대신 다른 로컬 포트 또는 호스트를 검증할 때는 `SMOKE_BASE_URL`을 사용합니다. 개발 서버의 dev-resource host 제약을 피하려면 `localhost` URL을 사용합니다.

```powershell
Set-Location frontend
$env:SMOKE_BASE_URL = 'http://localhost:3113'
npm run smoke:promotion
Remove-Item Env:SMOKE_BASE_URL
```

성공하면 `merch promotion smoke ok`가 출력됩니다. 이 smoke는 활성 시각의 배너·카드·상품 요약·canonical CTA·Analytics 속성, 합성 Analytics 요청 차단, 배너 세션 닫기, 인증된 `/admin/analytics` 대시보드와 관리자 배너 제외, 종료 시 배너·카드 미노출을 확인합니다. 스크린샷 캡처도 인증된 관리자 대시보드 제목과 배너 미노출을 확인한 뒤 이미지를 저장합니다.

### 프로덕션 smoke와 증거

배포 후에는 공개 경로와 인증된 읽기 전용 `/admin/analytics`를 비파괴로 확인하고, 인증 정보는 명령줄이나 문서에 기록하지 않습니다. 브라우저 smoke 중 발생하는 모든 합성 `/api/analytics/track` 요청은 컨텍스트별 로컬 HTTP 204 응답으로 차단됩니다.

```powershell
$healthResponse = Invoke-RestMethod -Uri 'https://moingfans.com/api/health' -TimeoutSec 30
if (-not $healthResponse.ok) { throw 'Frontend health is not ok' }
$homeResponse = Invoke-WebRequest -Uri 'https://moingfans.com/' -UseBasicParsing -TimeoutSec 30
$broadcastsResponse = Invoke-WebRequest -Uri 'https://moingfans.com/broadcasts' -UseBasicParsing -TimeoutSec 30
if ($homeResponse.StatusCode -ne 200 -or $broadcastsResponse.StatusCode -ne 200) { throw 'Public route smoke failed' }

Set-Location frontend
$env:SMOKE_BASE_URL = 'https://moingfans.com'
npm run smoke:promotion
Remove-Item Env:SMOKE_BASE_URL
```

배포 기록에는 health의 `ok=true`, 홈·`/broadcasts`의 HTTP 200, 인증된 읽기 전용 `/admin/analytics`의 실제 `Analytics Dashboard` 확인, `merch promotion smoke ok` 출력, 확인 시각과 배포 commit SHA를 남깁니다. 활성 기간에는 배너/카드/CTA와 관리자 경로 배너 제외를 확인하고, 종료 후에는 자동 미노출을 기록합니다. 신규 프론트엔드 오류와 CD 결과도 함께 점검합니다.

## 참고사항 (Notes)

- 브라우저 시각이 잘못되면 노출 경계와 카운트다운도 어긋날 수 있습니다.
- JavaScript가 비활성화되면 정확한 시간 경계를 우선하여 프로모션을 표시하지 않습니다.
- 판매처 장애, 재고, 가격·배송 정책 변경은 사이트가 자동 감지하지 않습니다. 팬텀픽 조건을 확인한 뒤 명시적 코드 변경과 재배포로 반영합니다.
- 판매 종료 직후 자동 숨김을 확인합니다. 재사용 계획이 없으면 별도 변경으로 layout/page 연결과 캠페인 전용 컴포넌트를 제거하되, 배포 기록과 Analytics 과거 라벨은 보존합니다.

## 배포 결과

- 배포 성공 일자: 2026-08-11 (KST). CD run 생성 시각은 `2026-08-11T08:00:57+09:00`이며, 완료 시각은 `2026-08-11T08:04:48+09:00`입니다.
- main merge SHA: `1bb8609014503d333e1b61ea2154cca28a016b31` (`1bb8609`). PR은 [#3](https://github.com/ReverserofCode/witchs-cauldron/pull/3), CD는 [GitHub Actions run 31440665421](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/31440665421)에서 확인할 수 있습니다.
- 상세한 과정·검증·운영 참고사항은 [2026-08-11 배포 기록](DEPLOYMENT_RECORD_2026-08-11_SUMMER_ATELIER_PROMOTION.md)에 남겼습니다.
- 캠페인은 `2026-09-01 00:00:00+09:00`부터 자동으로 숨겨집니다.
