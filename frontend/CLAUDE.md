# CLAUDE.md - Frontend 상세 컨텍스트

> **빠른 탐색**: 프로젝트 전체 개요는 루트의 [`../CLAUDE.md`](../CLAUDE.md)를 참조하세요.

이 문서는 frontend 디렉터리의 상세 구조와 API를 설명합니다.

## 프로젝트 개요

**프로젝트명**: 마녀의 포션 공방 (Moing Fan Page)

버튜버 "모잉(Moing)"을 위한 **팬 커뮤니티 웹사이트**입니다. 방송 스케줄, YouTube 콘텐츠, 치지직 라이브 상태, 팬아트 갤러리 등을 통합 제공합니다.

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js (App Router) | 14.2.5 |
| 언어 | TypeScript | 5.9.2 |
| UI 라이브러리 | React | 18.3.1 |
| 스타일링 | Tailwind CSS | v4 |
| 런타임 | Node.js (Alpine) | 22 |
| 배포 | Docker | multi-stage build |

## 디렉토리 구조

```
witchs-cauldron/                      # 프로젝트 루트
├── .claude/                          # Claude Code 에이전트 설정 (루트 레벨)
│   └── agents/
│       ├── code-generator.md         # 코드 생성/수정 에이전트
│       ├── code-tester.md            # 코드 테스트/빌드 검증 에이전트
│       ├── code-validator.md         # 코드 리뷰/검증 에이전트
│       ├── codebase-structure-analyzer.md  # 코드베이스 구조 분석
│       ├── dependency-analyzer.md    # 패키지 의존성 분석 (NEW)
│       ├── documentation-generator.md # 문서 생성/업데이트 (NEW)
│       ├── external-tool-integrator.md     # 외부 도구 연동 에이전트
│       ├── lint-checker.md           # ESLint/TypeScript 빠른 검사 (NEW)
│       ├── orchestrator-planner.md   # 멀티 에이전트 조율/계획
│       ├── requirements-analyzer.md  # 요구사항 분석 에이전트
│       └── token-optimizer.md        # 토큰 최적화 에이전트
│
├── frontend/                         # Next.js 프론트엔드 앱
│   ├── app/                          # Next.js App Router 소스 코드
│   │   ├── api/                      # API Routes (서버 사이드)
│   │   ├── health/
│   │   │   └── route.ts              # 헬스체크 엔드포인트
│   │   ├── broadCastSchedule/
│   │   │   ├── route.ts              # 방송 일정 API 엔드포인트
│   │   │   └── schedule.tsx          # Google Sheets CSV 파싱 로직 (1168줄)
│   │   ├── chzzkPlayer/
│   │   │   ├── route.ts              # 치지직 메인 라우트
│   │   │   ├── chzzkPlayer.ts        # 라이브 상태 조회 로직
│   │   │   ├── chzzkClip.ts          # 클립 조회 로직
│   │   │   └── chzzkClip/
│   │   │       └── route.ts
│   │   ├── youTubePlayer/
│   │   │   ├── route.ts              # YouTube 최신 영상
│   │   │   ├── youTubeRe.ts          # 영상 데이터 처리
│   │   │   ├── shared.ts             # 공유 유틸리티 (API 키, 채널 메타)
│   │   │   └── topOfficial/
│   │   │       └── route.ts          # 월간 인기 영상
│   │   ├── youtubeShorts/
│   │   │   ├── route.ts              # YouTube Shorts
│   │   │   └── youTubeShorts.ts      # Shorts 필터링 로직
│   │   └── analytics/                # 방문자/클릭 분석 API
│   │       ├── db.ts                 # PostgreSQL 연결/스키마
│   │       ├── track/route.ts        # 이벤트 수집
│   │       └── stats/route.ts        # 통계 조회
│   │
│   ├── admin/                        # 운영자 전용 페이지
│   │   └── analytics/page.tsx        # 분석 대시보드
│   │
│   ├── components/                   # React 컴포넌트
│   │   ├── cards/                    # 재사용 가능한 카드 컴포넌트
│   │   │   ├── index.ts
│   │   │   ├── SectionCard.tsx       # 범용 섹션 카드 (tone 시스템)
│   │   │   ├── LatestYouTubeVideoCard.tsx
│   │   │   ├── TopOfficialYouTubeVideoCard.tsx
│   │   │   ├── TodayBroadcastStatusCard.tsx
│   │   │   └── VideoCard.tsx
│   │   ├── gallery/                  # 갤러리 컴포넌트
│   │   │   ├── index.ts
│   │   │   └── FanArtGallery.tsx     # 팬아트 갤러리 (클릭 시 Modal)
│   │   ├── modals/                   # 모달 컴포넌트
│   │   │   ├── index.ts
│   │   │   └── FanArtModal.tsx       # 팬아트 상세 보기 Modal (Portal)
│   │   ├── layout/                   # 레이아웃 컴포넌트
│   │   │   ├── index.ts
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── LeftSidebar.tsx       # 스케줄, 빠른 영상, 팬아트
│   │   │   ├── RightSidebar.tsx      # 커뮤니티 링크, 팬아트 갤러리
│   │   │   └── SideNav.tsx
│   │   ├── sections/                 # 메인 콘텐츠 섹션
│   │   │   ├── index.ts
│   │   │   ├── ClipsSection.tsx
│   │   │   ├── ClipsViewer.tsx
│   │   │   ├── ScheduleSection.tsx
│   │   │   ├── YouTubeCategorySection.tsx
│   │   │   ├── YouTubeOfficialVideosSection.tsx
│   │   │   ├── YouTubeFullMoingVideosSection.tsx
│   │   │   ├── YouTubeFanVideosSection.tsx
│   │   │   ├── YouTubeShortsSection.tsx
│   │   │   └── YouTubeVideosSection.tsx
│   │   ├── status/
│   │   │   ├── index.ts
│   │   │   └── YouTubeSectionStatus.tsx
│   │   ├── analytics/                # 분석 추적 유틸
│   │   │   ├── track.ts              # 클라이언트 이벤트 전송
│   │   │   └── SectionTracker.tsx    # 섹션 뷰 추적 래퍼 컴포넌트
│   │   ├── footer.tsx                # 레거시 (사용하지 않음)
│   │   ├── header.tsx                # 레거시 (사용하지 않음)
│   │   └── latestYouTubeVideoCard.tsx # 레거시
│   │
│   ├── hooks/
│   │   ├── useYouTubeVideos.ts       # YouTube 데이터 캐싱 훅 (5분 TTL)
│   │   └── useSectionView.ts         # 섹션 뷰 추적 훅 (Intersection Observer)
│   │
│   ├── layout.tsx                    # 루트 레이아웃 (메타데이터, 폰트)
│   ├── page.tsx                      # 홈페이지 (3-column 그리드)
│   ├── globals.css                   # 전역 스타일, 디자인 토큰
│   ├── robots.ts                     # SEO robots 설정
│   ├── sitemap.ts                    # SEO 사이트맵
│   ├── icon.svg                      # 앱 아이콘
│   └── test/
│       └── page.tsx                  # 테스트 페이지
│
├── public/                           # 정적 자산
│   ├── mainPage/
│   │   ├── Profile.png               # 프로필 이미지
│   │   ├── favicon_moing.png
│   │   ├── moing_colors.json         # 디자인 토큰
│   │   └── moing_palette.png
│   ├── rightAside/                   # 팬아트 갤러리 (자동 스캔)
│   │   └── 모잉팬아트*.jpg
│   ├── clips/                        # 클립 비디오 (10개)
│   │   └── clip_*.mp4
│   ├── gnbIcon/                      # 네비게이션 아이콘
│   │   ├── chzzk Icon.png
│   │   └── NaverCafe.png
│   └── broadcast-schedule.csv        # 로컬 방송 일정 (백업)
│
├── 설정 파일
│   ├── next.config.js                # standalone 출력, 이미지 최적화
│   ├── tailwind.config.js            # Moing 컬러 팔레트
│   ├── postcss.config.js             # Tailwind CSS v4 플러그인
│   ├── tsconfig.json                 # TypeScript 설정, @/* 경로 별칭
│   ├── docker-compose.yml            # 개발 환경
│   ├── docker-compose.prod.yml       # 프로덕션 환경
│   ├── Dockerfile                    # multi-stage 빌드
│   └── healthcheck.js                # Docker 헬스체크
│
└── 문서
    ├── README.md                     # 프로젝트 소개
    ├── CLAUDE.md                     # 이 문서
    ├── MAINTENANCE.md                # 운영 가이드
    └── DEPLOYMENT.md                 # 배포 가이드
```

## 컴포넌트 계층 구조

```
RootLayout (app/layout.tsx)
│
├─ Header (공통)
│
├─ Page (app/page.tsx)
│   │
│   └─ 3-Column Grid Layout
│       │
│       ├─ LeftSidebar
│       │   ├─ 방송 일정 스냅샷
│       │   ├─ 빠른 영상 링크
│       │   └─ 팬아트 프리뷰
│       │
│       ├─ Main Content
│       │   ├─ Hero Section (치지직 라이브 상태, 프로필)
│       │   ├─ Featured Cards
│       │   │   ├─ LatestYouTubeVideoCard
│       │   │   └─ TopOfficialYouTubeVideoCard
│       │   ├─ ClipsSection
│       │   ├─ ScheduleSection
│       │   ├─ YouTubeOfficialVideosSection
│       │   ├─ YouTubeFullMoingVideosSection
│       │   └─ YouTubeFanVideosSection
│       │
│       └─ RightSidebar
│           ├─ 커뮤니티 링크
│           └─ 팬아트 갤러리
│
└─ Footer (공통)
```

## API 라우트 상세

### 1. `/api/health`
- **목적**: Docker 헬스체크
- **응답**: `{ status: "ok" }`

### 2. `/api/broadCastSchedule`
- **목적**: Google Sheets CSV → 방송 일정 파싱
- **데이터 소스**: 환경변수 `BROADCAST_SCHEDULE_CSV_URL` 또는 기본 Google Sheets
- **Google Sheets ID**: `1Gb0zwlzL-CGf9QP3iuY1oD-dhaUEowhUz4EFgTXg1I8`
- **파싱 모드**: Flat Row + Matrix 이중 파싱
- **캐싱**: ISR 3분 (revalidate: 180)
- **디버그**: `?debug=1` 또는 `?diagnostics=1`

### 3. `/api/chzzkPlayer`
- **목적**: 치지직 실시간 방송 상태
- **채널 ID**: `1d333ff175b4db5bd06f87a88579ec1e`
- **외부 API**: `https://api.chzzk.naver.com/service/v1/channels/{channelId}/live-detail`
- **응답**: isLive, title, viewers, thumbnail 등

### 4. `/api/chzzkPlayer/chzzkClip`
- **목적**: 치지직 클립 데이터 조회

### 5. `/api/youTubePlayer`
- **목적**: 3개 채널의 최신 YouTube 영상 조회
- **채널**:
  - `@moing` (공식 채널)
  - `@fullmoing` (다시보기 채널)
  - `모잉수제문어포션` (팬 채널)
- **API**: YouTube Data API v3 (Playlist API → quota 절약)
- **캐싱**: revalidate: 60 (1분)

### 6. `/api/youTubePlayer/topOfficial`
- **목적**: 지난달 공식 채널 최다 조회수 영상
- **로직**: 업로드 플레이리스트 → 지난달 필터 → 조회수 정렬

### 7. `/api/youtubeShorts`
- **목적**: 65초 이하 YouTube Shorts 필터링

### 8. `/api/analytics/track`
- **목적**: 페이지뷰/클릭/섹션뷰 이벤트 수집
- **메서드**: POST
- **이벤트 타입**: `pageview`, `menu_click`, `content_click`, `section_view`
- **세션 관리**: UUID 기반 (클라이언트에서 생성)

### 9. `/api/analytics/stats`
- **목적**: 통계 집계
- **메서드**: GET
- **응답**:
  - `totals`: 고유 방문자, 재방문자, 페이지뷰, 메뉴 클릭
  - `daily[]`: 일별 페이지뷰, 고유 방문자, 메뉴 클릭
  - `topMenuClicks[]`: 메뉴 클릭 TOP 10
  - `sectionViews[]`: 섹션별 조회 수
  - `topPaths[]`: 페이지뷰 경로 TOP 10
  - `topReferrers[]`: referrer TOP 10

### 10. `/admin/analytics`
- **목적**: 분석 대시보드

## 캐싱 전략

### 서버 사이드 (ISR)
```typescript
// 방송 일정: 3분
export const revalidate = 180;

// YouTube: 1분
fetch(url, { next: { revalidate: 60 } });
```

### 클라이언트 사이드 (`useYouTubeVideos`)
```typescript
// 5분 TTL, 모듈 레벨 캐시, 요청 중복 제거
const CACHE_TTL_MS = 5 * 60 * 1000;
```

### API 메타데이터 캐싱
```typescript
// YouTube 채널 메타데이터: 1시간
const channelCache = new Map<string, ChannelMetadata>();
```

## 디자인 토큰

```css
--color-moing-primary: #A020F0    /* 메인 보라색 */
--color-moing-accent: #ADD8E6     /* 액센트 하늘색 */
--color-moing-deep: #191970       /* 딥 네이비 */
```

**SectionCard tone 시스템**: `neutral` | `lavender` | `dimmed`

## 환경 변수

```bash
# 필수
YOUTUBE_API_KEY=your_youtube_api_key

# 분석 기능 (선택)
ANALYTICS_DATABASE_URL=postgres://analytics:analytics@analytics-db:5432/analytics

# 기타 선택
BROADCAST_SCHEDULE_CSV_URL=custom_google_sheets_url
NEXT_TELEMETRY_DISABLED=1
```

## 빌드 및 실행

```bash
# 개발 서버
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm start

# Docker 개발
docker-compose up -d

# Docker 프로덕션
docker-compose -f docker-compose.prod.yml up -d
```

## 주요 파일 위치 (빠른 참조)

| 기능 | 파일 경로 |
|------|----------|
| 홈페이지 | `app/page.tsx` |
| 루트 레이아웃 | `app/layout.tsx` |
| 전역 스타일 | `app/globals.css` |
| 방송 일정 파싱 | `app/api/broadCastSchedule/schedule.tsx` |
| 치지직 API | `app/api/chzzkPlayer/chzzkPlayer.ts` |
| YouTube API | `app/api/youTubePlayer/youTubeRe.ts` |
| YouTube 공유 유틸 | `app/api/youTubePlayer/shared.ts` |
| YouTube 캐싱 훅 | `app/hooks/useYouTubeVideos.ts` |
| 팬아트 갤러리 | `app/components/gallery/FanArtGallery.tsx` |
| 팬아트 Modal | `app/components/modals/FanArtModal.tsx` |
| 오른쪽 사이드바 | `app/components/layout/RightSidebar.tsx` |
| 범용 카드 | `app/components/cards/SectionCard.tsx` |
| 분석 대시보드 | `app/admin/analytics/page.tsx` |
| 분석 DB 연결 | `app/api/analytics/db.ts` |
| 이벤트 수집 API | `app/api/analytics/track/route.ts` |
| 통계 조회 API | `app/api/analytics/stats/route.ts` |
| 클라이언트 추적 | `app/components/analytics/track.ts` |
| 섹션 뷰 훅 | `app/hooks/useSectionView.ts` |
| 섹션 추적 래퍼 | `app/components/analytics/SectionTracker.tsx` |

## 코드 작업 가이드

### API 라우트 추가
```typescript
// app/api/{endpoint}/route.ts
export const revalidate = 60; // ISR 주기

export async function GET(request: Request) {
  // 구현
  return Response.json({ data });
}
```

### 컴포넌트 추가
- **카드**: `app/components/cards/`
- **섹션**: `app/components/sections/`
- **레이아웃**: `app/components/layout/`

### 스타일링
- Tailwind CSS 유틸리티 클래스 사용
- 커스텀 색상: `moing-primary`, `moing-accent`, `moing-deep`
- 반응형: mobile-first 접근

### 이미지 추가
- 팬아트: `public/rightAside/`에 파일 추가 (자동 인식)
- 클립: `public/clips/`에 `clip_*.mp4` 형식으로 추가

## 외부 의존성

| 서비스 | 용도 | API |
|--------|------|-----|
| 치지직 | 실시간 방송 상태, 클립 | Chzzk API |
| YouTube | 영상 메타데이터 | YouTube Data API v3 |
| Google Sheets | 방송 스케줄 | CSV export URL |
| PostgreSQL | 방문자/클릭 분석 | pg (Node.js 드라이버) |

## 관련 문서

- `README.md` - 프로젝트 소개
- `MAINTENANCE.md` - 운영 가이드
- `DEPLOYMENT.md` - 배포 가이드

## 최근 변경 이력

- **Analytics 대시보드 전면 리디자인** - ResizeObserver 기반 인터랙티브 SVG 차트(호버 툴팁, 데이터 포인트), 메트릭별 고유 색상, `TrendChart`/`PeriodSummary` 컴포넌트 분리, 기간 요약 사이드 패널(일평균/최고/최저 트래픽/CTR)
- **Analytics 대시보드 원복** - Recharts 제거, 오리지널 막대형 UI로 복귀
- **방문자 집계 기준 변경** - 순 방문자 → 중복 허용 방문자(`totals.visitors`)
- **Analytics 대시보드 Recharts 개선** - 꺾은선 그래프(일별 순 방문자/페이지뷰/메뉴 클릭), 섹션별 조회 수 차트
- **섹션 뷰 추적 기능** - `useSectionView` 훅, `SectionTracker` 컴포넌트, `section_view` 이벤트 타입
- **방문자/클릭 분석 기능 추가** - Postgres 기반 자체 분석, 운영자 대시보드 `/admin/analytics`
- **ScheduleModal 추가** - 전체 일정 보기 캘린더 Modal (`app/components/modals/ScheduleModal.tsx`)
- **코드베이스 정리** - 미사용 레거시 파일 11개 삭제, 518줄 dead code 제거
- **deploy.sh 실행 권한 수정** - CD 배포 시 Permission denied 오류 해결 (chmod +x)
- **병렬 처리 에이전트 추가** - `lint-checker`, `dependency-analyzer`, `documentation-generator` 에이전트 추가
- **무중단 배포** - deploy.sh 스크립트 개선 (빌드 후 컨테이너 교체)
- **YouTube Shorts 제외** - 최신 영상 API에서 65초 이하 Shorts 필터링
- **2열 숏폼 레이아웃** - 치지직 클립 + YouTube Shorts 동시 표시
- **숏폼 클립 뷰어** - 틱톡/릴스 스타일 UI (9:16, 스와이프, 키보드)
- **팬아트 Modal 기능 추가** - 이미지 클릭 시 전체 화면 Modal로 상세 보기, 키보드 네비게이션 지원
- **갤러리/모달 컴포넌트 분리** - `FanArtGallery`, `FanArtModal` 컴포넌트 생성 (React Portal 사용)
- **Claude Code 에이전트 확장** - `code-tester`, `external-tool-integrator`, `token-optimizer` 에이전트 추가
- **팬아트 추가** - `public/rightAside/` 디렉토리
- **시간 오표기 수정** - 방송 일정 파싱 로직
- **신규 폼 적용** - 스케줄러 업데이트
- **검색어 노출 메타데이터** - SEO 최적화
