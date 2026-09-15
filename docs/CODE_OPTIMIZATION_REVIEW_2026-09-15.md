# 기존 코드 최적화 검토

대상: `6c01ec0` 기반 코드와 포션 기능의 결합 영향. 실행 속도 향상률은 측정하지 않았으며 추정치를 성과로 제시하지 않는다.

## 이번 작업에 적용

| 조치 | 이유 | 검증 |
|---|---|---|
| 홈/헤더 게임 링크 `prefetch=false` | 방문만으로 미니게임 코드/날짜 요청을 가져오지 않도록 분리 | 홈 네트워크 smoke 및 정적 ISR 유지 확인 |
| 게임 게이지는 DOM ref, 점수는 monotonic clock | 매 프레임 React 상태 갱신을 피하고 렌더 주기와 채점을 분리 | 저프레임/지연 입력 smoke, 순수 규칙 테스트 |
| 게임 집계 분리·기본 비활성 | 기존 Analytics의 계약/수치를 변경하지 않고 실험 기능을 독립 운용 | 계약·provider fixture·관리자 smoke |
| 동일 round validator 공유 | 규칙 생성·상태 전이·API 해석 간 검증 조건의 차이 방지 | 리뷰 후 25개 domain 테스트 |
| Next/Sharp/Vitest 호환 보안 패치 | 의존성 검사에서 확인된 위험을 배포 전에 해소 | npm audit 0건, 회귀/빌드 검증 별도 |
| Vitest 설정을 `.mts`로 명시 | 기존 ESM 설정 형식을 정확히 선언해 Vite 경고 제거 | 경고 없는 신규 테스트 실행 |

Next `16.3.0→16.3.3`, eslint-config-next 같은 버전, sharp `0.35.3→0.35.4`, Vitest `4.1.11` 및 호환 transitive lock 갱신을 적용했다. 대규모 프레임워크 전환이 아니다. 근거: [Next 이미지 처리 보안 권고](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Next Windows 보안 권고](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Sharp 보안 권고](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

## 후속 권장 — 이번 출시에서는 변경하지 않음

1. **스크롤 이벤트 묶음 처리.** `frontend/app/components/analytics/AnalyticsProvider.tsx`의 scroll handler는 이벤트마다 `scrollHeight/clientHeight/scrollTop`을 읽는다. requestAnimationFrame으로 한 프레임에 한 번 처리하고 cleanup에서 예약을 취소하는 변경을 우선 후보로 둔다. 이벤트/threshold 건수 보존 테스트와 성능 프로파일을 함께 수행해야 한다.
2. **SPA 경로 전환의 체류 시간 의미.** 같은 provider에서 pathname 변경 시 체류 기준을 재설정하지만 page_exit 전송은 주로 visibility/pagehide에 의존한다. 내부 이동 전에 이전 경로의 exit를 기록할지 먼저 지표 정의를 확정해야 한다. 단순 최적화처럼 바꾸면 기존 대시보드 수치가 달라지므로 별도 정확성 개선으로 분리한다.
3. **기존 lint 경고 정리.** 전역 lint에서 22개 경고(오류 0)를 확인했다. effect 안의 동기 setState, render 중 Date.now, 미사용 값, any 등이 기존 파일에 있다. 신규 포션 소유 파일의 lint와 구분한다. 경고를 일괄 비활성화하거나 모든 effect에 불필요한 memo를 넣지 않는다.
4. **SectionTracker observer 공유.** 현재 홈의 관찰 대상 수가 적어 우선순위가 낮다. 대상/이벤트가 실제로 증가하고 비용이 관찰되면 공유 observer를 검토한다.
5. **팬아트 파일 조회와 컨테이너 크기.** 홈 ISR이 300초이므로 동기 파일 조회의 실제 병목 여부를 먼저 측정한다. Docker의 별도 production node_modules 복사 축소와 `npm ci` 전환도 재현성/이미지 크기 관점의 후속 후보이며, 검증 없이 런타임 의존성을 제거하지 않는다.

권장 순서: 스크롤 프로파일·회귀 테스트 → 체류 지표 정의/정확성 수정 → 기존 lint 경고의 파일별 정리 → 측정된 병목만 최적화. 게임이 잘 동작한다는 이유로 사이트 전체의 성능·접근성 평가가 완료되었다고 보지 않는다.
