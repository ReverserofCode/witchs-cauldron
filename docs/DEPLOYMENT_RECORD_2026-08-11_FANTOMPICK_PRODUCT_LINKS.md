# FantomPick 공식 상품 상세 링크 후속 배포 기록

> ScopeTag: `frontend`
> 배포 기록일: 2026-08-11 (KST, CD 생성 시각 기준)

## 개요 (Overview)

모잉 「여름의 공방」 캠페인 카드에 공식 FantomPick 상품 상세 링크 5개를 추가한 후속 릴리스의 실제 배포 및 검증 기록입니다. CD run 생성 시각 `2026-08-11T13:14:09Z`를 `Asia/Seoul`로 환산한 날짜를 기록일로 사용했습니다. 최초 캠페인 배포(PR #3)의 이력은 [초기 배포 기록](DEPLOYMENT_RECORD_2026-08-11_SUMMER_ATELIER_PROMOTION.md)에 보존합니다.

### 권리 및 범위 결정

- 공식 이미지 재사용 허가를 확인하지 못했으므로, 이미지 파일을 복제·다운로드하거나 외부 이미지를 hotlink하지 않았습니다.
- 사이트에는 공식 상세 페이지 URL만 보관하며, 사용자는 새 탭에서 FantomPick의 원본 상세 페이지를 통해 이미지를 확인합니다.
- 이 릴리스에는 이미지 자산, remote image 설정, 애플리케이션 설정, 의존성 추가·변경이 없습니다.

## 배포 식별 정보

| 항목 | 관측값 |
|---|---|
| 운영 URL | <https://moingfans.com> |
| Pull Request | [#4 — Add official FantomPick product links](https://github.com/ReverserofCode/witchs-cauldron/pull/4) |
| PR 상태 및 merge 시각 | `MERGED`, `2026-08-11T13:14:06Z` |
| feature head SHA | `1c229fa9c57ee00f7f2143ab42daa2f6dde0ecd3` |
| main merge SHA | `5c472fa34448f28bed22a0fcc701edbf146c5646` |
| PR CI | [run 31494997204](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/31494997204), `success` |
| CI 대상 SHA | `1c229fa9c57ee00f7f2143ab42daa2f6dde0ecd3` |
| merge CD | [run 31495138618](https://github.com/ReverserofCode/witchs-cauldron/actions/runs/31495138618), `success` |
| CD 대상 SHA | `5c472fa34448f28bed22a0fcc701edbf146c5646` |
| CD 생성/완료 | `2026-08-11T13:14:09Z` / `2026-08-11T13:17:42Z` = `2026-08-11T22:14:09+09:00` / `2026-08-11T22:17:42+09:00` |

구현 feature head에는 `bf36552`(공식 링크 데이터), `d880085`(카드와 브라우저 smoke), `8bd3631`(운영 정책 문서), `1c229fa`(정확한 `rel` 토큰 smoke 보강)가 포함됩니다. PR CI의 `test` job과 CD의 `build-and-test` job은 성공했습니다. CD `deploy` job은 primary deploy 성공, SSH 실패 시 1회 재시도 단계 skipped, 인증된 `Verify analytics stats endpoint` 성공으로 완료되었으며 job 로그에 `analytics stats verification ok`가 출력되었습니다.

## 공식 상품 상세 연결

2026-08-11T22:11:42+09:00에 아래 다섯 URL을 HEAD로 독립 확인했습니다. 모두 HTTP `200`, 최종 URL은 HTTPS이며 host는 정확히 `fantompick.com`입니다.

| 번호 | 상품 | 공식 상세 페이지 |
|---:|---|---|
| 375 | 여름의 공방 풀세트 | <https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%92%80%EC%84%B8%ED%8A%B8/375/> |
| 376 | 여름의 공방 장패드 | <https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%EC%9E%A5%ED%8C%A8%EB%93%9C/376/> |
| 377 | 비키니 모잉 아크릴 스탠드 | <https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%95%84%ED%81%AC%EB%A6%B4-%EC%8A%A4%ED%83%A0%EB%93%9C/377/> |
| 378 | 비키니 모잉 캔뱃지 | <https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%BA%94%EB%B1%83%EC%A7%80/378/> |
| 379 | 여름의 공방 포토카드 세트 | <https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%8F%AC%ED%86%A0%EC%B9%B4%EB%93%9C-%EC%84%B8%ED%8A%B8/379/> |

각 링크는 정확히 하나씩 렌더링되며, 접근 가능한 이름, `_blank`, 정확한 whitespace token의 `noopener noreferrer`, 상품별 `merch_promotion_product` / `promotion_product` Analytics 속성을 사용합니다. 카테고리 CTA는 기존 canonical 카테고리 URL을 유지하고, 보조 상품 링크만 위 상세 URL을 사용합니다.

## 검증 결과

### 코드 및 로컬 release candidate

feature head `1c229fa9c57ee00f7f2143ab42daa2f6dde0ecd3`에서 수행한 최종 검증입니다.

| 검증 | 결과 |
|---|---|
| Vitest | 18 test files, 97 tests 통과 |
| TypeScript | `npm run typecheck` 성공 (`next typegen`, `tsc --noEmit`) |
| promotion scoped ESLint | 0 errors, 0 warnings |
| 전체 ESLint | exit 0; 기존 비관련 경고 22건만 유지 |
| production build | 성공; 정적 페이지 12/12 생성 |
| 인증된 로컬 promotion smoke | `merch promotion smoke ok` |
| 로컬 브라우저 시각 검토 | 1440px, 1024px, 390px 및 인증된 Analytics Dashboard 캡처 확인 |

로컬 smoke는 5개 링크의 일대일 매핑, 접근성 이름, 새 탭 보안 속성, 상품별 Analytics 계약, 390px에서 44px 이상 hit target과 가로 overflow 부재를 검증했습니다. 또한 FantomPick 이미지 요소·CSS background·런타임 요청이 없음을 확인하고, 합성 `/api/analytics/track` 요청은 컨텍스트 내부 HTTP `204`으로 가로채 운영 분석 데이터에 기록하지 않았습니다. 전체 lint의 22개 경고와 Vite의 future `configLoader: 'native'` 안내는 기존 비차단 항목입니다.

### CI 및 CD

- CI run `31494997204`는 feature SHA `1c229fa9c57ee00f7f2143ab42daa2f6dde0ecd3`에서 성공했습니다.
- 정확한 merge SHA `5c472fa34448f28bed22a0fcc701edbf146c5646`의 CD run `31495138618`은 `build-and-test`와 `deploy` 모두 성공했습니다.
- CD의 primary deploy는 성공했고 `Retry deploy once on SSH failure`는 실행 조건이 충족되지 않아 skipped였습니다.
- CD job이 Production Basic Auth로 Analytics stats endpoint를 검증해 `analytics stats verification ok`를 출력했습니다.

### 운영 HTTP 및 공개 브라우저 검증

| 확인 시각 (KST) | 항목 | 결과 |
|---|---|---|
| 2026-08-11T22:18:56+09:00 | `/api/health` | `ok=true` |
| 2026-08-11T22:18:56+09:00 | `/`, `/broadcasts` | 각각 HTTP `200` |
| 2026-08-11T22:18:56+09:00 | 익명 `/admin/analytics` | HTTP `401` |
| 약 2026-08-11 22:20 | 공개 production browser | 정확한 5개 링크/URL, 접근성 이름, 새 탭 보안 속성, 상품별 Analytics 속성 확인 |
| 약 2026-08-11 22:20 | 390px 반응형 | 각 링크 44px 이상, 가로 overflow 없음 |
| 약 2026-08-11 22:20 | Analytics 및 외부 요청 | Analytics 요청은 HTTP `204`으로 interception, 링크 click 없음, FantomPick 런타임 요청 0건 |

공개 운영 화면은 아래 ignored 캡처를 원본 크기로 시각 검토했습니다. 캡처는 증거용이며 Git 추적 대상이 아닙니다.

- `frontend/playwright-screenshots/fantompick-product-links-production/home-desktop-1440.png` (1440×4000)
- `frontend/playwright-screenshots/fantompick-product-links-production/home-tablet-1024.png` (1024×5113)
- `frontend/playwright-screenshots/fantompick-product-links-production/home-mobile-390.png` (390×6243)

### 정확성 한계

로컬 shell에는 production admin secret을 export하지 않았습니다. 따라서 배포 후에는 CD job이 수행한 인증된 Analytics stats API 검증과 익명 admin의 HTTP `401`을 확인했지만, 인증된 운영 admin UI 브라우저 캡처는 반복하지 않았습니다. `Analytics Dashboard` 렌더링 및 배너 미노출의 인증된 브라우저 캡처는 배포 전 로컬 release candidate에서 수행한 증거입니다.

## 운영 및 롤백

### URL 유지보수

상품 상세 URL이 변경되면 FantomPick 공식 상세를 HEAD/브라우저로 재확인한 뒤 `frontend/app/lib/promotions/summerAtelier.ts`의 다섯 매핑, `summerAtelier.test.ts`, `frontend/scripts/smoke-merch-promotion.mjs`, 그리고 [운영 runbook](SUMMER_ATELIER_PROMOTION.md)을 같은 변경에서 갱신합니다. 이미지 재사용에 대한 명시적 허가가 없는 한 URL 외 이미지 자산·hotlink·remote image 설정을 추가하지 않습니다.

### 자동 종료 및 롤백

캠페인은 `2026-09-01T00:00:00+09:00`부터 자동으로 숨겨집니다. 종료된 판매를 다시 노출시키기 위해 날짜를 되돌리지 않습니다. 링크 또는 릴리스 자체를 되돌려야 하면 운영 이력을 보존하도록 merge commit에 대해 다음과 같이 revert 커밋을 만들고 일반 CD 절차로 배포합니다.

```powershell
git revert -m 1 5c472fa34448f28bed22a0fcc701edbf146c5646
```

`reset` 및 force-push는 사용하지 않습니다. 단순한 문서 정정은 이 기록 문서의 별도 커밋만 `git revert <documentation-commit>`으로 되돌립니다.

## 참고사항 (Notes)

- 런타임은 판매처 재고·가격·배송 정책이나 상품 URL을 자동 동기화하지 않습니다. 변경 전에는 공식 FantomPick 페이지를 기준으로 다시 확인합니다.
- 화면 검증은 Analytics를 기록하지 않도록 interception을 유지하며, 검증 목적상 상품 링크를 click하지 않습니다.
- 이 문서는 배포된 릴리스 `5c472fa34448f28bed22a0fcc701edbf146c5646`의 기록입니다. 문서 자체의 후속 커밋은 해당 배포 commit을 바꾸지 않습니다.
