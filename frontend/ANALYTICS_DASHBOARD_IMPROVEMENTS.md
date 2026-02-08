# /admin/analytics 개선안 (보안 항목 제외)

작성일: 2026-02-08  
대상: `frontend/app/admin/analytics/page.tsx`, `frontend/app/api/analytics/stats/route.ts`

## 범위

이 문서는 `/admin/analytics` 개선안 중 **보안/인증 관련 항목을 제외**한 실행 계획입니다.

제외 항목:
- 인증/인가 정책 변경
- 관리자 헤더 검증 로직 변경
- 공개 모드(`ANALYTICS_PUBLIC`) 정책 변경

## 우선순위 개선안

## P1 (즉시)

1. 지표 정의 정합성 정리
- 현상: `visitors`와 `pageviews`가 동일 집계로 보일 수 있음.
- 개선:
  - 지표 정의를 확정하고(예: `visitors=중복 허용 방문`, `pageviews=페이지뷰`) UI 라벨/설명을 일치시킴.
  - 필요 시 `visitors`를 `COUNT(DISTINCT session_id)` 또는 `COUNT(DISTINCT ip)`로 전환.
- 대상 파일:
  - `frontend/app/api/analytics/stats/route.ts`
  - `frontend/app/admin/analytics/page.tsx`

2. 날짜 범위 UX 개선 (To 포함 규칙 명확화)
- 현상: API는 `created_at < to`(exclusive) 비교.
- 개선:
  - UI에서 `To(포함)` 기준으로 안내.
  - 서버에서 `to + 1 day`로 처리하여 사용자 기대와 일치.
- 대상 파일:
  - `frontend/app/admin/analytics/page.tsx`
  - `frontend/app/api/analytics/stats/route.ts`

3. `sectionViews` 시각화 복원/추가
- 현상: API는 `sectionViews`를 반환하지만 화면에 표시하지 않음.
- 개선:
  - 섹션별 조회수 카드/바 차트 추가.
  - 기존 `SECTION_LABELS` 매핑 활용.
- 대상 파일:
  - `frontend/app/admin/analytics/page.tsx`
  - `frontend/app/api/analytics/stats/route.ts` (필드 일관성 확인)

4. 로딩/재시도 UX
- 현상: fetch 중 로딩 피드백 부족.
- 개선:
  - `isLoading` 상태와 스켈레톤/로더 추가.
  - 실패 시 재시도 버튼 제공.
- 대상 파일:
  - `frontend/app/admin/analytics/page.tsx`

## P2 (단기)

1. 기간 프리셋/편의 기능
- `오늘`, `7일`, `30일`, `90일` 프리셋 버튼.
- 선택된 프리셋 시 날짜 입력 자동 반영.
- 대상 파일:
  - `frontend/app/admin/analytics/page.tsx`

2. 운영 지표 확장
- CTR (`menuClicks / pageviews`) 카드 추가.
- `top paths`, `top referrers` 추가 (이미 수집 중인 `path`, `referrer` 활용).
- 대상 파일:
  - `frontend/app/api/analytics/stats/route.ts`
  - `frontend/app/admin/analytics/page.tsx`

3. 자동 새로고침 옵션
- 15s/30s/60s 토글 + 수동 새로고침 버튼.
- 대상 파일:
  - `frontend/app/admin/analytics/page.tsx`

## P3 (중기)

1. 쿼리/인덱스 최적화
- 이벤트 타입별 조회 빈도가 높으므로 복합 인덱스 검토:
  - `(event_type, created_at)`
  - `(ip, created_at)`
- 중복 스캔을 줄이도록 집계 쿼리 구조 단순화.
- 대상 파일:
  - `frontend/app/api/analytics/db.ts`
  - `frontend/app/api/analytics/stats/route.ts`

## 구현 체크리스트

- [ ] 지표 정의 문구와 실제 SQL 집계가 일치한다.
- [ ] 날짜 범위 안내(포함/제외)가 UI와 서버 로직에서 일치한다.
- [ ] `sectionViews`가 대시보드에 노출된다.
- [ ] 로딩/에러/빈 데이터 상태가 명확하다.
- [ ] 프리셋/새로고침 동작이 충돌 없이 동작한다.

## 검증 기준

1. 정적 검증
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`

2. API 스모크
- `curl.exe -i "http://localhost:3000/api/analytics/stats?from=2026-02-01&to=2026-02-08"`
- `daily`, `topMenuClicks`, `sectionViews` 구조 확인

3. 화면 확인
- `http://localhost:3000/admin/analytics`
- 기간 변경/프리셋/재시도/로딩 상태 확인
