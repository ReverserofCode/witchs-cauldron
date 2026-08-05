# 방송 단위 따라잡기 허브 구현 계획

> 설계: `docs/superpowers/specs/2026-08-05-broadcast-catchup-hub-design.md`
>
> 실행 원칙: 각 동작은 실패 테스트를 먼저 확인한 뒤 최소 구현으로 통과시키고, 관련 테스트를 다시 실행한다.

**목표:** `@fullmoing`의 최근 12주 분할 다시보기를 방송 날짜별 세션으로 묶고, `/broadcasts`에서 로컬 시청 상태와 지난 방문 이후 신규 표시를 제공한다.

**구조:** 순수 도메인 모듈이 제목 파싱과 그룹화를 담당하고, 서버 전용 소스 모듈이 YouTube Data API를 호출한다. 서버 페이지는 정규화한 직렬화 데이터만 클라이언트 허브에 넘기며, 시청 상태는 브라우저 로컬 저장소에만 둔다.

**기술:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, Vitest 4, YouTube Data API v3

---

## Task 1: 방송 도메인 계약과 제목 파싱

**Files:**

- Create: `frontend/app/lib/broadcasts/types.ts`
- Create: `frontend/app/lib/broadcasts/normalize.ts`
- Test: `frontend/app/lib/broadcasts/normalize.test.ts`

1. 날짜 접두사, 카테고리, 합방 상대, 화면 제목의 예상값을 테스트에 작성한다.
2. `npm test -- app/lib/broadcasts/normalize.test.ts`를 실행해 모듈 부재로 실패하는지 확인한다.
3. 최소 타입과 `normalizeReplayAsset()`을 구현한다.
4. 대상 테스트를 다시 실행해 통과시킨다.
5. 날짜 없는 제목이 게시 시각의 서울 날짜로 대체되는 테스트를 추가하고 실패를 확인한다.
6. 서울 날짜 대체와 `dateSource`를 구현해 통과시킨다.

## Task 2: 세션 그룹화와 표시 포맷

**Files:**

- Modify: `frontend/app/lib/broadcasts/normalize.ts`
- Test: `frontend/app/lib/broadcasts/normalize.test.ts`

1. 같은 방송일 그룹화, 영상 ID 중복 제거, 파트 정렬, 총 길이, 메타데이터 합집합 테스트를 작성한다.
2. 대상 테스트의 실패를 확인한다.
3. `groupBroadcastSessions()`를 최소 구현한다.
4. 최신 방송일 정렬과 제목 날짜 우선 `dateSource` 정책을 테스트하고 통과시킨다.
5. `formatDuration()`과 한국어 날짜 표시 테스트를 작성하고 구현한다.

## Task 3: YouTube 다시보기 수집기

**Files:**

- Create: `frontend/app/lib/broadcasts/youtube.ts`
- Test: `frontend/app/lib/broadcasts/youtube.test.ts`

1. 가짜 fetch 응답으로 플레이리스트 페이지네이션, 50개 단위 상세 조회, 최근 84일 필터를 테스트한다.
2. 대상 테스트의 실패를 확인한다.
3. `fetchBroadcastArchive()`에 API 키·fetch·현재 시각을 주입할 수 있게 구현한다.
4. 15분 `next.revalidate`, 최대 3페이지, 업로드 플레이리스트 상수를 적용한다.
5. API 키 누락, 첫 요청 실패, 부분 성공, 길이 누락 테스트를 추가하고 통과시킨다.

## Task 4: 서버 데이터 경계와 페이지 상태

**Files:**

- Create: `frontend/app/lib/broadcasts/server.ts`
- Create: `frontend/app/broadcasts/page.tsx`

1. 서버 모듈에서 `YOUTUBE_API_KEY`를 읽고 `fetchBroadcastArchive()` 결과를 반환한다.
2. `/broadcasts`에 한국어 metadata와 canonical을 선언하고, 런타임 환경 변수를 읽도록 `connection()` 이후 데이터를 조회한다.
3. 정상·빈 결과·설정 누락 상태를 직렬화 가능한 props로 분기한다.
4. 서버 컴포넌트가 내부 `/api`를 호출하지 않는지 코드 검토한다.

## Task 5: 로컬 시청/마지막 방문 모델

**Files:**

- Create: `frontend/app/lib/broadcasts/progress.ts`
- Test: `frontend/app/lib/broadcasts/progress.test.ts`

1. 손상된 JSON, 중복 ID, 허용 개수 제한, 신규 세션 판별 테스트를 작성한다.
2. 대상 테스트의 실패를 확인한다.
3. `parseWatchedSessionIds()`, `serializeWatchedSessionIds()`, `isSessionNew()`를 구현한다.
4. 대상 테스트를 재실행해 통과시킨다.

## Task 6: 방송 허브 클라이언트 UI

**Files:**

- Create: `frontend/app/components/broadcasts/BroadcastHub.tsx`
- Modify: `frontend/app/broadcasts/page.tsx`

1. 상단 소개, 출처 링크, 요약 지표를 구현한다.
2. 전체 / 시청 전 / 새 방송 필터와 빈 필터 결과를 구현한다.
3. 세션 카드와 파트 목록, 총 길이, 카테고리, 합방 정보를 구현한다.
4. 마운트 후에만 로컬 저장소를 읽고 Hydration 차이를 만들지 않도록 한다.
5. 시청 토글 `aria-pressed`와 키보드 포커스 스타일을 적용한다.
6. 외부 링크 클릭에 `content_click` 분석을 연결한다.

## Task 7: 사이트 진입점

**Files:**

- Modify: `frontend/app/components/layout/Header.tsx`
- Modify: `frontend/app/components/layout/Footer.tsx`

1. 내부 링크와 외부 링크를 구분하는 `HeaderItem` 계약을 만든다.
2. 데스크톱 헤더와 모바일 메뉴에 “방송 모아보기” 내부 링크를 추가한다.
3. 내부 링크에는 새 탭 속성을 사용하지 않고, 기존 외부 링크 동작은 유지한다.
4. 헤더 분석 속성에 내부 페이지 위치를 남긴다.
5. 푸터 사이트 링크에도 “방송 모아보기”를 추가한다.

## Task 8: 기술 문서 정리

**Files:**

- Create: `docs/BROADCAST_CATCHUP_HUB.md`
- Modify: `docs/superpowers/specs/2026-08-05-broadcast-catchup-hub-design.md`

1. 운영 환경 변수, 데이터 갱신 정책, 로컬 저장소 키, 장애 확인 방법을 작성한다.
2. 실제 구현과 달라진 설계 항목을 최종 코드에 맞게 보정한다.

## Task 9: 정적 검증

**Commands:**

1. `npm test`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm run build`

모든 명령의 종료 코드와 테스트 개수를 기록한다. 기존 사용자 변경에서 발생한 실패가 있으면 새 기능 관련 여부를 분리해 보고한다.

## Task 10: 브라우저와 컨테이너 검증

**Files:**

- Inspect: `frontend/app/broadcasts/page.tsx`
- Inspect: `frontend/app/components/broadcasts/BroadcastHub.tsx`

1. 개발 또는 프로덕션 서버에서 `/broadcasts`를 연다.
2. 데스크톱과 모바일 폭에서 레이아웃, 필터, 시청 토글, 새로고침 후 상태 유지를 확인한다.
3. YouTube 외부 링크의 URL과 분석 요청을 확인한다.
4. `docker compose -f docker-compose.prod.yml build frontend`를 실행한다.
5. 사용자 환경을 불필요하게 중단하지 않는 범위에서 컨테이너 재생성 및 `/api/health`, `/broadcasts` 응답을 확인한다.

## Task 11: 코드 리뷰와 완료 검증

1. 요구사항 대비 누락, 서버/클라이언트 경계, 날짜 처리, 접근성, API 키 노출 여부를 검토한다.
2. 리뷰 지적을 수정하고 관련 검증을 다시 실행한다.
3. `git diff --check`와 기능 관련 파일의 diff를 확인한다.
4. 변경 파일, 사용자 가치, 검증 결과, 남은 운영 의존성을 인계한다.
