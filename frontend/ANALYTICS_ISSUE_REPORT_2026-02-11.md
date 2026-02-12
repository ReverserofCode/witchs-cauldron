# Analytics/디자인 이슈 통합 보고서 (2026-02-11)

작성일: 2026-02-11  
대상 범위: `frontend/app/admin/analytics/page.tsx`, `frontend/app/components/analytics/*`, `frontend/app/components/layout/*`, `frontend/app/page.tsx`

## 1) 목적

- 현재 제기된 이슈를 단일 문서로 통합한다.
- 기능 이슈(집계 불일치)와 디자인 이슈(반응형/가독성/일관성)를 우선순위 기준으로 정리한다.
- 개발자가 바로 수정할 수 있도록 코드 근거와 수정 방향, 검증 기준을 함께 제공한다.

## 2) 이슈 요약

| ID | 분류 | 우선순위 | 현재 상태 | 요약 |
|---|---|---|---|---|
| A-01 | 기능/데이터 | P1 | Open | 클릭/페이지뷰가 실제 체감 대비 낮거나 불안정하게 집계됨 |
| A-02 | 디자인/반응형 | P1 | Open | 일별 트렌드가 모바일에서 정상 렌더링/상호작용되지 않음 |
| A-03 | 디자인/레이아웃 | P1 | Open | 관리자 상단 헤더(제목/기간/버튼) 한 줄 고정으로 모바일 겹침 위험 |
| A-04 | 디자인/UX | P1 | Open | 차트 인터랙션이 마우스 hover 중심이라 모바일 터치 UX 부재 |
| A-05 | 디자인/UX | P2 | Open | 차트 툴팁 위치 계산이 고정 폭 가정이라 작은 화면에서 잘림 가능 |
| A-06 | 디자인/타이포 | P2 | Open | 10~11px 텍스트 다수 사용으로 모바일 가독성 저하 |
| A-07 | 디자인/브랜드 일관성 | P2 | Open | 관리자 화면 비주얼 언어가 메인 사이트와 이질적 |
| A-08 | 디자인/정보구조 | P2 | Open | 모바일에서 좌/우 사이드바 정보가 대체 UI 없이 제거됨 |
| A-09 | 디자인/콘텐츠 전달 | P3 | Open | 메인 히어로 보조 설명이 모바일에서 숨김 처리됨 |

## 3) 상세 이슈

### A-01. 클릭/페이지뷰 집계 불안정

설명:
- 페이지뷰와 메뉴 클릭 데이터가 체감 대비 낮게 집계될 가능성이 있다.
- 특히 관리자 화면 자체는 페이지뷰 트래킹에서 제외된다.

코드 근거:
- `frontend/app/components/analytics/AnalyticsProvider.tsx:13` (`/admin` 경로 pageview 추적 제외)
- `frontend/app/components/analytics/AnalyticsProvider.tsx:17` (동일 path 중복 추적 방지)
- `frontend/app/components/layout/Header.tsx:76` (menu_click 이벤트가 헤더 링크 중심)
- `frontend/app/hooks/useSectionView.ts:6` (session 동안 section 중복 추적 방지 Set)

영향:
- 운영자가 보는 수치와 실제 이용 패턴 간 괴리가 커질 수 있다.
- 개선 전/후 효과 검증이 어려워진다.

개선 방향:
- pageview, menu_click 이벤트 정의와 수집 범위를 명확히 재정의한다.
- 메뉴 클릭 집계를 헤더 외 주요 클릭 지점까지 확대할지 정책 결정이 필요하다.
- dedupe 정책(동일 path, 동일 section)의 의도와 허용 오차를 문서화한다.

검증:
- 동일 유저 기준 1) 홈 진입, 2) 메뉴 클릭 3회, 3) 섹션 이동 후 수치 증가를 API와 대시보드에서 교차 확인.

### A-02. 일별 트렌드 모바일 렌더링/상호작용 문제

설명:
- 모바일에서 차트 렌더링 자체와 사용성이 모두 불완전하다.
- hover 전제 UX라서 터치 환경에서 핵심 정보 접근이 제한된다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:261`
- `frontend/app/admin/analytics/page.tsx:262`
- `frontend/app/admin/analytics/page.tsx:263`

영향:
- 모바일 관리 환경에서 일별 추세 해석이 어렵다.

개선 방향:
- `onTouchStart`/`onTouchMove`/`pointer` 이벤트 기반 상호작용을 추가한다.
- 모바일에서는 기본 요약값(당일/전일/증감률) 카드를 차트 위에 함께 제공한다.

검증:
- iOS Safari/Android Chrome에서 툴팁 표시, 점 선택, 축 라벨 가독성 확인.

### A-03. 관리자 헤더 한 줄 고정 배치

설명:
- 제목, 기간, 새로고침 버튼이 같은 행에 고정되어 소형 화면에서 줄바꿈/겹침 위험이 있다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:596`
- `frontend/app/admin/analytics/page.tsx:597`

영향:
- 첫 화면 인지성이 떨어지고 버튼 접근이 불편해진다.

개선 방향:
- `sm` 미만에서 2~3행 스택 배치로 전환한다.
- 제목 크기를 breakpoint별로 조정한다.

### A-04. 차트 UX의 데스크톱 편향

설명:
- 커서 기반 `crosshair`와 hover line 중심 설계로 모바일 터치 대응이 부족하다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:263`
- `frontend/app/admin/analytics/page.tsx:348`

영향:
- 모바일 사용자가 원하는 날짜 값에 정확히 접근하기 어렵다.

개선 방향:
- 데이터 포인트 탭 선택 UI(선택된 날짜 고정 표시)를 추가한다.
- 기본 상태에서도 마지막 날짜 값은 항상 노출한다.

### A-05. 툴팁 위치 계산의 고정폭 가정

설명:
- 툴팁 X 위치가 `dimensions.width - 120` 상수 기반으로 제한되어 폭이 좁은 화면에서 잘림 가능성이 있다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:367`
- `frontend/app/admin/analytics/page.tsx:368`

영향:
- 데이터 일부가 가려져 의미 전달이 저하된다.

개선 방향:
- 실제 툴팁 폭(`offsetWidth`)을 측정해 동적으로 clamp 처리한다.
- 상단 공간 부족 시 아래쪽에 렌더링하는 fallback을 둔다.

### A-06. 소형 폰트 과다 사용

설명:
- 관리자/사이드바 전반에 `10px`, `11px` 텍스트가 많아 모바일 가독성이 낮다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:428`
- `frontend/app/admin/analytics/page.tsx:432`
- `frontend/app/components/layout/LeftSidebar.tsx:164`
- `frontend/app/components/layout/RightSidebar.tsx:93`

영향:
- 빠른 스캔이 어려워지고 체류 시간 대비 정보 흡수율이 떨어진다.

개선 방향:
- 본문 최소 12px, 보조 최소 11px 이상으로 기준을 재정의한다.
- 숫자 정보(조회수/클릭수)는 한 단계 더 크게 설정한다.

### A-07. 관리자와 메인의 시각 언어 불일치

설명:
- 메인은 브랜드 톤(퍼플 글래스/그라데이션)인데, 관리자는 중립 회색 카드 중심이라 제품 경험이 분리된다.

코드 근거:
- `frontend/app/admin/analytics/page.tsx:593`
- `frontend/app/admin/analytics/page.tsx:720`
- `frontend/app/components/cards/SectionCard.tsx:21`

영향:
- 동일 제품 내 화면 전환 시 일관성 저하.

개선 방향:
- 관리 화면에도 디자인 토큰(색/radius/shadow)을 공통 레이어로 적용한다.
- 시각 계층은 유지하되 브랜드 컬러 사용 비율만 낮춰 통일성을 확보한다.

### A-08. 모바일에서 사이드바 정보 소실

설명:
- 데스크톱 전용 처리로 모바일에서 좌/우 사이드바 정보가 통째로 사라진다.

코드 근거:
- `frontend/app/page.tsx:40`
- `frontend/app/page.tsx:125`

영향:
- 일정 요약, 커뮤니티 바로가기, 팬아트 진입 동선 등 보조 탐색 정보가 손실된다.

개선 방향:
- 모바일 전용 compact 블록(아코디언/탭)을 메인 컬럼 하단에 대체 배치한다.

### A-09. 히어로 보조 설명의 모바일 숨김

설명:
- 핵심 보조 문구가 `sm` 미만에서 숨겨져 첫 인지 정보가 줄어든다.

코드 근거:
- `frontend/app/page.tsx:71`

영향:
- 처음 방문한 사용자에게 라이브 상태 맥락 전달이 약해진다.

개선 방향:
- 모바일에서도 1줄 요약 형태로 노출한다.

## 4) 우선 작업 순서 제안

1. P1 처리: A-01, A-02, A-03, A-04  
2. P2 처리: A-05, A-06, A-07, A-08  
3. P3 처리: A-09

## 5) 완료 기준 (Definition of Done)

- 기능:
  - pageview/menu_click 집계 로직과 UI 지표 정의가 문서와 일치한다.
  - 주요 사용자 플로우에서 누락 없이 이벤트가 증가한다.
- 디자인:
  - `360px` 폭 기준으로 관리자 화면의 첫 화면 요소가 겹치지 않는다.
  - 차트가 터치 환경에서 날짜 선택/값 확인이 가능하다.
  - 작은 글씨 가독성 기준(최소 폰트 크기)이 준수된다.
  - 모바일에서도 기존 사이드바 핵심 정보에 접근할 수 있다.

## 6) 비고

- 본 문서는 2026-02-11 기준 코드 상태를 근거로 작성되었으며, 구현 변경 시 라인 번호는 달라질 수 있다.
