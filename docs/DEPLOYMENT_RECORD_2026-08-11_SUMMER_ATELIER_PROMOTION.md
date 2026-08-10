# 모잉 「여름의 공방」 굿즈 홍보 배포 기록

> ScopeTag: `frontend`
> 배포 기록일: 2026-08-11 (KST)

## 개요 (Overview)

모잉 「여름의 공방」 기간 한정 굿즈 홍보 기능의 실제 배포와 운영 검증 결과입니다. 판매 기간은 `2026-08-05T19:00:00+09:00` 이상부터 `2026-09-01T00:00:00+09:00` 미만이며, 종료 경계에서 배너와 홈 카드가 자동으로 숨겨집니다.

## 배포 식별 정보

| 항목 | 관측값 |
|---|---|
| 운영 URL | [https://moingfans.com](https://moingfans.com) |
| Pull Request | [#3](https://github.com/ReverserofCode/witchs-cauldron/pull/3) |
| PR CI run | `31440545525` (성공) |
| feature head | `56bddbd870e1510c065951aa4119526a5975a41e` |
| main merge SHA | `1bb8609014503d333e1b61ea2154cca28a016b31` (`1bb8609`) |
| GitHub Actions CD | [run 31440665421](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/31440665421) |
| CD run 생성 시각 | 2026-08-10T23:00:57Z = 2026-08-11T08:00:57+09:00 |
| CD run 완료 시각 | 2026-08-10T23:04:48Z = 2026-08-11T08:04:48+09:00 |

배포 기록의 날짜 기준은 CD run의 **생성 시각**이며, 실제 완료 시각과 구분해 기록했습니다. CD의 `build-and-test` job은 1분 13초, `deploy` job은 2분 17초에 성공했고, retry job은 skipped였습니다. 배포 job 로그에서 인증된 Analytics stats 검증의 `analytics stats verification ok` 출력도 확인했습니다.

## 포함 범위와 결과

- 정적 캠페인 시간 모델, 마감 카운트다운, 시작 포함·종료 배타 경계를 구현했습니다.
- 공개 경로 전역 배너와 홈 상세 상품 카드를 추가했고, `/admin` 및 하위 경로에서는 배너를 표시하지 않습니다.
- canonical 판매 CTA는 [팬텀픽 모잉 카테고리](https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/)만 사용합니다.
- 기존 Analytics 계약으로 배너·카드 클릭과 카드 섹션 노출을 기록하며, 운영 검증에서 생성되는 Analytics 요청은 브라우저 컨텍스트별 HTTP 204으로 차단했습니다.
- 캠페인 기간은 종료 배타 경계인 `2026-09-01 00:00:00+09:00`부터 자동 숨김입니다.

## 검증 결과

### 로컬 release 검증

| 검증 | 결과 |
|---|---|
| Vitest | 18 files, 96 tests 통과 |
| TypeScript | `npm run typecheck` 통과 |
| promotion scoped lint | 경고 0건 |
| 전체 lint | exit 0; 기존 경고 22건 유지 |
| production build | 통과 |
| 인증된 로컬 promotion smoke | 통과 |
| 시각 검토 | 1440px, 1024px, 390px 및 인증된 관리자 화면 통과 |
| 독립 최종 리뷰 | clean |

전체 lint의 22건은 본 기능 이전부터 있던 경고로, 이번 홍보 기능 변경에서 새 경고는 추가되지 않았습니다. GitHub의 Node 20 deprecation annotation은 비차단 안내였으며 CI/CD 성공 결과에 영향을 주지 않았습니다.

### 운영 smoke

| 항목 | 결과 |
|---|---|
| `/api/health` | `ok=true` |
| `/` | HTTP 200 |
| `/broadcasts` | HTTP 200 |
| 인증되지 않은 `/admin/analytics` | HTTP 401 |
| 실제 브라우저 콘텐츠 | 배너, 홈 카드, canonical 링크, 5개 가격, 풀세트 특전, `2026-10-07` 출고 안내 확인 |
| 390px 반응형 | `scrollWidth=390`, `innerWidth=390` |
| 터치 대상 | CTA `104.64×44`, 닫기 버튼 `44×44` |
| Analytics 오염 방지 | 3개 요청을 HTTP 204으로 가로채 운영 Analytics에 저장되지 않음 |

## 재현 절차

다음 명령은 비파괴 검증용입니다. 프로모션 smoke는 안전한 환경 변수에서 제공되는 **완전한 인증 자격 증명 쌍**이 필요합니다. 값, SSH fingerprint, 비밀 파일 경로는 명령 기록 또는 문서에 넣지 않습니다.

```powershell
gh run view 31440665421 --repo ReverserofCode/witchs-cauldron

$healthResponse = Invoke-RestMethod -Uri 'https://moingfans.com/api/health' -TimeoutSec 30
if (-not $healthResponse.ok) { throw 'Frontend health is not ok' }

$homeResponse = Invoke-WebRequest -Uri 'https://moingfans.com/' -UseBasicParsing -TimeoutSec 30
$broadcastsResponse = Invoke-WebRequest -Uri 'https://moingfans.com/broadcasts' -UseBasicParsing -TimeoutSec 30
if ($homeResponse.StatusCode -ne 200 -or $broadcastsResponse.StatusCode -ne 200) {
  throw 'Public route smoke failed'
}

Set-Location frontend
$env:SMOKE_BASE_URL = 'https://moingfans.com'
# 안전한 환경에서 SMOKE_ADMIN_* 또는 ADMIN_BASIC_AUTH_*의 완전한 쌍을 제공한 뒤 실행합니다.
npm run smoke:promotion
Remove-Item Env:SMOKE_BASE_URL
```

## 운영 및 롤백

가격, 재고, 배송 정책 또는 판매 상태가 바뀌면 팬텀픽 판매처를 최종 기준으로 확인한 뒤 [운영 가이드](SUMMER_ATELIER_PROMOTION.md)의 연장 절차를 따릅니다. 기간을 연장할 때는 `endAtExclusive`와 관련 문구·테스트를 같은 변경에 반영합니다.

잘못된 홍보 정보가 배포되면 마지막 정상 변경을 대상으로 `git revert` 커밋을 생성해 CD로 배포합니다. `reset` 또는 force-push로 운영 이력을 변경하지 않습니다. 판매가 종료된 경우에는 날짜를 되돌리지 않고 자동 숨김 상태를 유지합니다.

## 참고사항 (Notes)

- 노출 경계와 카운트다운은 클라이언트 브라우저 시각을 기준으로 하므로 사용자 기기 시간이 틀리면 표시도 어긋날 수 있습니다.
- 가격·상품 정보는 배포 시점의 정적 조사값입니다. 런타임 팬텀픽 fetch, 외부 상품 이미지, 새 의존성은 사용하지 않았으며 판매처가 최종 기준입니다.
- 배너 닫기는 `sessionStorage`를 사용하는 현재 브라우저 세션 한정 동작입니다.
- 개인정보, 인증정보, SSH host fingerprint는 이 기록과 저장소에 포함하지 않았습니다.
