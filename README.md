# Frontend (Next.js + Tailwind v4)

이 패키지는 Docker 컨테이너에서 실행되는 Next.js 14 + React 18 프론트엔드입니다. Tailwind CSS v4를 사용하며 PostCSS 플러그인은 `@tailwindcss/postcss`만 필요합니다.

## 프로젝트 개요

- 홈 화면은 3열 레이아웃(왼쪽 사이드바 · 메인 콘텐츠 · 오른쪽 사이드바)으로 구성되며, 메인 컬럼에서 히어로 카드와 유튜브/방송 일정 관련 섹션을 순차적으로 노출합니다.
- 왼쪽 사이드바(`LeftSidebar`)는 방송 일정, 유튜브 최신/인기 영상, 팬아트 갤러리 스냅샷을 제공하며 API 상태에 따른 메시지를 표시합니다.
- 오른쪽 사이드바(`RightSidebar`)는 커뮤니티 바로가기 카드와 팬아트 갤러리를 노출합니다. 팬아트는 `public/rightAside` 폴더의 이미지를 자동으로 스캔하여 보여주며, 항목이 없으면 업로드 가이드를 안내합니다.
- 메인 콘텐츠는 다음 섹션으로 구성됩니다:
  - 히어로 카드: 실시간 치지직 상태, 소개 문구, 아바타 이미지.
  - 최신 영상 카드(`LatestYouTubeVideoCard`), 지난달 조회수 1위 카드(`TopOfficialYouTubeVideoCard`).
  - 방송 일정(`ScheduleSection`) 및 유튜브 카테고리 섹션(공식, 다시보기, 팬 하이라이트 등).
- 테스트/실험용 페이지는 `app/test/page.tsx`에서 별도로 확인할 수 있습니다.

### 데이터 소스 요약

- **치지직**: `app/api/chzzkPlayer/chzzkPlayer.ts`에서 라이브 상세 API를 직접 호출하여 현재 방송 상태를 구성합니다.
- **방송 일정**: `/api/broadCastSchedule`이 구글 시트 CSV를 가져와 파싱합니다. 진단 쿼리 파라미터로 각 단계를 점검할 수 있습니다.
- **유튜브**: `/api/youTubePlayer`, `/api/youTubePlayer/topOfficial`, `/api/youtubeShorts`가 업로드 플레이리스트 기반으로 최신 영상·월간 인기 영상·쇼츠를 제공합니다. 모든 엔드포인트는 `YOUTUBE_API_KEY`가 필요하며, 캐시와 Playlist API를 활용해 호출 수를 절감합니다.
- **클라이언트 캐시**: `useYouTubeVideos` 훅이 5분 TTL 캐시와 중복 요청 방지를 담당하여, 동일 세션에서 API 호출을 최소화합니다.

### 디렉터리 안내

- `app/components/cards`: 레이아웃 카드, 유튜브 카드 등 UI 컴포넌트 모음.
- `app/components/layout`: 헤더/푸터, LeftSidebar, RightSidebar 등 레이아웃 구성 요소.
- `app/components/sections`: 방송 일정 및 유튜브 섹션별 렌더링 컴포넌트.
- `app/hooks`: 프런트엔드 데이터 훅(`useYouTubeVideos` 등).
- `public/mainPage`, `public/rightAside`: 정적 리소스(프로필 이미지, 팬아트 이미지 등).
- `docker-compose.yml`: 로컬 개발을 위한 프론트엔드 컨테이너 정의.

## 현재 상태

- Next.js dev 서버가 http://localhost:3000 에서 정상 동작합니다.
- Tailwind v4 구성으로 마이그레이션 완료:
  - `postcss.config.js`는 `@tailwindcss/postcss`만 사용합니다.
  - `autoprefixer`는 제거되었습니다(Tailwind v4에 내장).
  - 불필요한 `tailwind.config.js`는 제거 대상이나 커스텀 설정이 없어도 동작합니다.
- 샘플 경로:
  - `/` 홈 페이지
  - `/api/health` 헬스체크 API (200 응답 시 정상)
- 기본 폰트: [Noto Sans KR](https://fonts.google.com/specimen/Noto+Sans+KR) (SIL Open Font License)

## 개발 환경 실행

프로젝트 루트의 docker-compose를 사용하세요.

```cmd
docker compose up -d --build
```

로그 확인:

```cmd
docker logs -f --tail=200 witchs-cauldron-frontend
```

종료:

```cmd
docker compose down
```

> Windows/OneDrive 환경 안정화를 위해 파일 변경 감지 폴링이 활성화되어 있습니다.

## 패키지 설치/명령 실행 (컨테이너 내부)

로컬 호스트에서 직접 npm을 실행하지 말고 컨테이너를 통해 실행하세요.

```cmd
docker exec -it witchs-cauldron-frontend npm install <pkg>
docker exec -it witchs-cauldron-frontend npm run dev
docker exec -it witchs-cauldron-frontend npm run build
docker exec -it witchs-cauldron-frontend npm run start
```

타입 체크:

```cmd
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
```

## Tailwind CSS (v4)

- 전역 스타일: `app/globals.css`
- PostCSS 구성: `postcss.config.js`
- 별도의 `tailwind.config.js`가 없어도 동작합니다(필요 시 생성하여 테마/플러그인 확장 가능).

## 트러블슈팅

- 에러: `It looks like you're trying to use tailwindcss directly as a PostCSS plugin` 발생 시
  - `postcss.config.js`에 `@tailwindcss/postcss`만 남겨두세요.
  - `autoprefixer`를 의존성에서 제거하고 재설치하세요.
  - 컨테이너 재시작 후 캐시가 남아있다면 `rm -rf .next && npm ci`를 컨테이너에서 실행하세요.

## 스크립트

- `npm run dev`: 개발 서버
- `npm run build`: 빌드
- `npm run start`: 프로덕션 서버

## 방송 일정 연동

- API 엔드포인트: `/api/broadCastSchedule`
- 기본값: 환경 변수 `BROADCAST_SCHEDULE_CSV_URL`가 비어 있으면 프로젝트에 내장된 구글 시트(편집 링크)를 자동으로 사용합니다.
- URL 정규화: 편집/보기 링크를 전달해도 내부에서 CSV export URL로 변환하므로 별도의 "Publish to web" 주소를 기억할 필요가 없습니다.
- 맞춤 시트를 사용하려면 컨테이너 환경 변수에 `BROADCAST_SCHEDULE_CSV_URL`을 설정하세요. (예: `docker compose`의 `environment` 항목)
- 디버깅: `/api/broadCastSchedule?diagnostics=1` 또는 `?debug=1`로 호출하면 각 단계(정규화 → 다운로드 → 파싱) 결과가 JSON으로 반환됩니다. 환경 변수가 비어 있을 경우 기본 시트를 사용했다는 `hint`가 포함됩니다.

## 유튜브 데이터 연동 & 최적화

- 전체 API는 `YOUTUBE_API_KEY` 환경 변수가 필요합니다. 누락 시 런타임에서 명시적으로 오류를 던지므로 배포 전에 키가 설정되어 있는지 확인하세요.
- `/api/youTubePlayer`는 이제 채널 검색(`search.list`) 대신 업로드 플레이리스트(`playlistItems.list`)를 사용합니다. 동일한 최신 업로드 정보를 훨씬 적은 쿼터로 가져오며, 채널 메타데이터(채널 ID + 업로드 플레이리스트 ID)는 1시간 캐시에 저장됩니다.
- `/api/youTubePlayer/topOfficial` 역시 업로드 플레이리스트를 기반으로 지난달 영상을 모은 뒤, 필요한 경우에만 `videos.list`로 조회수를 보강합니다. 월별 탐색에 필요한 호출 수가 크게 줄어듭니다.
- `/api/youtubeShorts`는 업로드 플레이리스트에서 후보를 가져온 뒤 `videos.list`로 길이를 확인하여 65초 이하의 쇼츠만 반환합니다. 페이지네이션과 중복 ID 처리를 통해 최소 호출만 수행하며, 모든 외부 요청에 `revalidate: 60` 캐시 힌트를 부여했습니다.
- 클라이언트 훅 `useYouTubeVideos`는 5분 TTL 로컬 캐시를 사용하도록 개선되었습니다. 신선한 데이터만 재사용하고 만료 시 자동으로 재호출합니다. 강제로 초기화하려면 `resetYouTubeVideosCache()`를 호출하세요.
- UI 측면에서는 오른쪽 사이드바가 팬 아트 이미지를 `public/rightAside` 디렉터리에서 자동으로 수집해 표시하며, 커뮤니티 카드만 유지하도록 단순화되었습니다.

## 디렉터리

- `app/` Next.js App Router 소스
- `app/api/health/route.ts` 헬스체크 엔드포인트
- `postcss.config.js` Tailwind v4 PostCSS 설정

<!-- gpt-codex 관련 내용은 프로젝트에서 제거되었습니다. 필요 시 별도 백엔드 연동 섹션을 새로 추가하세요. -->
