# Witchs Cauldron (마녀의 포션 공방)

버튜버 **모잉(Moing)** 팬 커뮤니티 웹사이트입니다.

방송 스케줄, YouTube 콘텐츠, 치지직 라이브 상태, 방송별 다시보기, 팬아트 갤러리, 숏폼 하이라이트, 클립 자동 수집, 방문자 분석 기능을 제공합니다.

**GitHub**: https://github.com/ReverserofCode/witchs-cauldron

---

## 목차

- [기술 스택](#기술-스택)
- [아키텍처](#아키텍처)
- [프로젝트 구조](#프로젝트-구조)
- [구조 운영 원칙](#구조-운영-원칙)
- [빠른 시작](#빠른-시작)
- [환경 변수](#환경-변수)
- [API 엔드포인트](#api-엔드포인트)
- [Frontend 상세](#frontend-상세)
- [Backend 상세](#backend-상세)
- [ChizzkData (로컬 클립 수집기)](#chizzkdata-로컬-클립-수집기)
- [CI/CD](#cicd)
- [배포 가이드](#배포-가이드)
- [운영/유지보수](#운영유지보수)
- [클립 수집 운영 런북](docs/CLIP_COLLECTION_RUNBOOK.md)
- [방송 모아보기 운영](docs/BROADCAST_CATCHUP_HUB.md)
- [UI/UX 및 Analytics 개선안](docs/UI_ANALYTICS_IMPROVEMENT_PLAN.md)
- [Analytics 대시보드](#analytics-대시보드)
- [Agent Teams](#agent-teams)
- [Docker 테스트](#docker-테스트)
- [테스팅 가이드](#테스팅-가이드)
- [트러블슈팅](#트러블슈팅)
- [변경 이력](#변경-이력)

---

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **Frontend** | Next.js (App Router), TypeScript, React, Tailwind CSS v4 | 16.3.0 / 6.0.3 / 19.2.5 |
| **Backend** | FastAPI, Selenium, Chromium + Xvfb | 0.115.6 / 4.27.1 |
| **Database** | PostgreSQL (분석용) | 16 Alpine |
| **Infra** | Docker (multi-stage), GitHub Actions CI/CD | Node.js 22 |
| **로컬 유틸** | Python + Selenium + BeautifulSoup4 | 3.9+ |

### 외부 서비스

| 서비스 | 용도 | API |
|--------|------|-----|
| 치지직 | 라이브 상태, 클립 수집 | Chzzk API + Selenium |
| YouTube | 영상 메타데이터 | YouTube Data API v3 |
| Google Sheets | 방송 스케줄 | CSV export |
| PostgreSQL | 방문자/클릭 분석 | pg (Node.js 드라이버) |

---

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend      │     │    Backend       │     │  Analytics DB   │
│   (Next.js)      │────▶│   (FastAPI)      │     │  (PostgreSQL)   │
│   Port: 3000     │     │   Port: 8000     │     │   Port: 5432    │
└────────┬─────────┘     └────────┬─────────┘     └────────▲────────┘
         │  shared_clips 볼륨     │                        │
         └───────────┬────────────┘       Analytics API    │
                     │                                     │
              ┌──────▼──────┐        Frontend ─────────────┘
              │  Clips (MP4) │
              └──────────────┘
```

### 컴포넌트 계층

```
RootLayout
├── Header
├── Page (3-Column Grid)
│   ├── LeftSidebar (일정, 영상 링크, 팬아트 프리뷰)
│   ├── Main Content
│   │   ├── Hero (치지직 라이브 + 프로필)
│   │   ├── Featured Cards (최신/인기 영상)
│   │   ├── ClipsSection (숏폼 하이라이트)
│   │   ├── ScheduleSection
│   │   └── YouTube Sections (공식/다시보기/팬)
│   └── RightSidebar (커뮤니티 + 팬아트 갤러리)
└── Footer
```

---

## 프로젝트 구조

```
witchs-cauldron/
├── AGENTS.md                     # Codex 작업 컨텍스트 및 프로젝트 지침
├── README.md                     # 프로젝트 개요와 운영 문서 허브
├── docs/                         # 운영 런북, 개선안, 템플릿 문서
├── frontend/                    # Next.js 프론트엔드
│   ├── app/
│   │   ├── api/                 # API Routes
│   │   │   ├── health/          # 헬스체크
│   │   │   ├── broadCastSchedule/ # 방송 일정 (Google Sheets)
│   │   │   ├── chzzkPlayer/     # 치지직 라이브/클립
│   │   │   ├── clips/           # 클립 수집 작업 프록시
│   │   │   │   └── _shared.ts   # 클립 API 프록시 공통 유틸
│   │   │   ├── youTubePlayer/   # YouTube 영상
│   │   │   ├── youtubeShorts/   # YouTube Shorts
│   │   │   └── analytics/       # 방문자/클릭 분석 API
│   │   ├── clips/[...filename]/ # 클립 스트림 구현 및 기존 URL 호환
│   │   ├── media/clips/[...filename]/ # canonical 클립 스트리밍 (Range 지원)
│   │   ├── broadcasts/           # 최근 방송 단위 따라잡기 허브
│   │   ├── admin/analytics/     # 운영자 분석 대시보드
│   │   ├── components/
│   │   │   ├── cards/           # 카드 컴포넌트
│   │   │   ├── gallery/         # 팬아트 갤러리
│   │   │   ├── modals/          # FanArtModal, ScheduleModal
│   │   │   ├── layout/          # Header, Footer, Sidebars
│   │   │   ├── sections/        # 메인 콘텐츠 섹션
│   │   │   └── analytics/       # 분석 추적 유틸
│   │   └── hooks/               # useYouTubeVideos, useSectionView
│   └── public/                  # 정적 자산 (프로필, 팬아트, 클립)
│
├── backend/                     # FastAPI 백엔드 (클립 수집)
│   └── app/
│       ├── api/endpoints/       # clips, health, jobs
│       ├── services/            # Selenium 클립 수집기
│       └── core/                # WebDriver 팩토리
│
├── chizzkData/                  # 로컬 클립 수집 유틸리티
│   └── ShortForm.py             # 메인 스크립트
│
├── .github/workflows/           # CI/CD (ci.yml, cd.yml)
├── docker-compose.yml            # 통합 개발 환경
├── docker-compose.prod.yml       # 통합 프로덕션 환경
└── docker-compose.server.yml     # 서버 배포용 compose
```

---

## 구조 운영 원칙

- **루트가 운영 기준**입니다. Docker Compose, CI/CD, 배포 스크립트는 루트 저장소 기준으로 실행합니다.
- **프론트엔드 API Routes는 BFF 역할**을 합니다. 외부 API, analytics DB, FastAPI 백엔드 프록시는 `frontend/app/api` 아래에서 관리합니다.
- **백엔드는 클립 수집 전용 서비스**입니다. Selenium/Chromium/Xvfb 의존성은 `backend` 컨테이너 안에 격리합니다.
- **공유 자산의 경계**는 `frontend/public`입니다. 수집 클립은 운영에서는 shared volume, 정적 포함이 필요한 파일은 `frontend/public/clips`에 둡니다.
- **로컬 산출물은 커밋하지 않습니다.** `.next`, `node_modules`, `tsconfig.tsbuildinfo`, Playwright 스크린샷, 로그 파일은 ignore 대상입니다.
- **`frontend/docker-compose*.yml`은 프론트 단독 실행용 레거시 보조 파일**입니다. 통합 실행과 배포는 루트 compose 파일을 우선 사용합니다.

---

## 빠른 시작

### Docker (권장)

```bash
# 프로덕션 빌드 및 실행
docker compose -f docker-compose.prod.yml up -d --build

# 헬스 체크
curl http://localhost:3000/api/health  # Frontend
curl http://localhost:8000/api/health  # Backend
```

### 개발 환경

```bash
# Frontend + Backend 함께
docker compose up -d

# 로그 확인
docker compose logs -f

# 개별 서비스 재시작
docker compose restart frontend
docker compose restart backend
```

### Frontend만 로컬

```bash
cd frontend && npm run dev
```

### Backend만 로컬

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## 환경 변수

### Frontend

```bash
# 필수
YOUTUBE_API_KEY=your_youtube_api_key

# 분석 기능 (DB 연결)
ANALYTICS_DATABASE_URL=postgres://analytics:analytics@analytics-db:5432/analytics

# 운영자 보호 (프로덕션 필수, development 미설정 시 우회)
ADMIN_BASIC_AUTH_USERNAME=admin
ADMIN_BASIC_AUTH_PASSWORD=change-this-before-deploy

# 기타 선택
BROADCAST_SCHEDULE_CSV_URL=custom_google_sheets_url
NEXT_TELEMETRY_DISABLED=1
BACKEND_URL=http://backend:8000  # Docker 환경
```

### Backend

```bash
DEBUG=false
APP_NAME=Witchs Cauldron Backend
CHZZK_CHANNEL_ID=1d333ff175b4db5bd06f87a88579ec1e
CLIPS_DIR=/app/shared/clips

# Selenium (Xvfb 가상 디스플레이)
CHROME_BINARY=/usr/bin/chromium
CHROMEDRIVER_PATH=/usr/bin/chromedriver
HEADLESS=false
USE_XVFB=true

# 수집 설정
MAX_CLIPS_PER_COLLECTION=2
COLLECTION_TIMEOUT=180

# 자동 갱신 설정 (운영 compose 기본값: disabled)
CLIP_AUTO_COLLECT_ENABLED=false
CLIP_AUTO_COLLECT_INTERVAL_MINUTES=720
CLIP_AUTO_COLLECT_RUN_ON_STARTUP=false
CLIP_AUTO_COLLECT_STARTUP_DELAY_SECONDS=60
CLIP_AUTO_COLLECT_MAX_CLIPS=1
CLIP_AUTO_COLLECT_FILTER_TYPE=ALL
CLIP_AUTO_COLLECT_ORDER_TYPE=RECENT
```

---

## API 엔드포인트

### Frontend (Next.js)

| 엔드포인트 | 목적 | 캐싱 |
|------------|------|------|
| `/api/health` | Docker 헬스체크 | - |
| `/api/broadCastSchedule` | Google Sheets → 방송 일정 | ISR 3분 |
| `/api/chzzkPlayer` | 치지직 라이브 상태 | no-store |
| `/api/youTubePlayer` | 최신 YouTube 영상 | no-store |
| `/api/youTubePlayer/topOfficial` | 월간 인기 영상 | no-store |
| `/api/youtubeShorts` | YouTube Shorts (팬채널) | no-store |
| `/api/youtubeShorts/official` | YouTube Shorts (공식채널) | no-store |
| `/api/clips/automation` | 치지직 클립 자동 갱신 상태 프록시 | no-store |
| `/api/analytics/track` | 페이지뷰/클릭 이벤트 수집 | no-store |
| `/api/analytics/stats` | 통계 조회 (프로덕션 Basic Auth) | no-store |
| `/admin/analytics` | 분석 대시보드 (프로덕션 Basic Auth) | - |

### Backend (FastAPI)

| Method | 엔드포인트 | 목적 |
|--------|------------|------|
| GET | `/api/health` | 헬스체크 (Selenium 상태 포함) |
| GET | `/api/clips` | 클립 목록 조회 |
| GET | `/api/clips/{clip_id}` | 개별 클립 상세 |
| POST | `/api/clips/collect` | 클립 수집 트리거 |
| DELETE | `/api/clips/{clip_id}` | 클립 삭제 |
| GET | `/api/jobs/automation` | 클립 자동 갱신 스케줄러 상태 |
| GET | `/api/jobs/{job_id}` | 수집 작업 상태 확인 |
| GET | `/api/jobs` | 최근 작업 목록 |

- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

---

## Frontend 상세

### 데이터 소스

- **치지직**: 라이브 상세 API 직접 호출로 실시간 방송 상태 확인
- **방송 일정**: Google Sheets CSV 파싱 (Flat Row + Matrix 이중 파싱). 디버그: `?diagnostics=1`
- **YouTube**: 업로드 플레이리스트 기반으로 최신/인기/Shorts 제공 (쿼터 절약). `YOUTUBE_API_KEY` 필수
- **클라이언트 캐시**: `useYouTubeVideos` 훅 (5분 TTL, 중복 요청 방지)
- **분석**: Postgres 기반 자체 이벤트 수집 (페이지뷰, 메뉴 클릭, 섹션 뷰)

### YouTube Shorts 필터링

- **기준**: `duration <= 185초` (YouTube 2024.10 정책: 최대 3분)
- 공식 채널(`@moing`)에서만 탐색, 팬 채널(`@모잉수제문어포션`)은 Shorts 미업로드
- `MAX_LOOKAHEAD=100`으로 긴 영상 사이 Shorts 탐색 범위 확보

### Tailwind CSS v4

- 전역 스타일: `app/globals.css`
- PostCSS: `@tailwindcss/postcss`만 사용 (autoprefixer 내장)
- 별도 `tailwind.config.js` 없이도 동작

### 디자인 토큰

```css
--color-moing-primary: #A020F0    /* 메인 보라색 */
--color-moing-accent: #ADD8E6     /* 액센트 하늘색 */
--color-moing-deep: #191970       /* 딥 네이비 */
```

**SectionCard tone**: `neutral` | `lavender` | `dimmed`

### 컴포넌트 아키텍처

- 서버 컴포넌트 기본, `"use client"` 필요 시만 적용
- 클라이언트: Header, LeftSidebar, ClipsViewer, ScheduleSection
- 서버: Footer, RightSidebar, ClipsSection
- 모달: React Portal 패턴 (FanArtModal, ScheduleModal)

### 반응형 브레이크포인트

- `md` (768px): 모바일 네비게이션, 일정 그리드 확장
- `lg` (1024px): 사이드바 표시 (3열 레이아웃)
- `xl` (1280px): 넓은 사이드바

### 팬아트 갤러리

- `public/rightAside/` 이미지 자동 스캔
- 클릭 시 전체 화면 Modal (키보드 네비게이션: 좌우 화살표, ESC)
- 썸네일 스트립 지원

### 치지직 클립 렌더링

- 운영 서버에서 Backend가 치지직 클립을 수집해 Docker `shared_clips` 볼륨에 저장
- Frontend는 같은 볼륨을 `/app/shared/clips`에 읽기 전용으로 마운트하고, `ClipsSection`에서 최신 10개만 표시
- `/media/clips/[...filename]` 동적 라우트가 공유 볼륨을 우선해 MP4 파일을 직접 스트리밍하며 `Range` 요청을 지원. 기존 `/clips/*` 요청은 `beforeFiles` rewrite로 같은 핸들러에 연결
- 한글/공백 파일명 안전 로드를 위해 파일명 URL 인코딩과 `?v=<mtime>` 캐시 버스터 적용
- Next standalone 정적 `public` 캐시에 의존하지 않음. 서버 시작 후 새로 생성된 클립도 재배포 없이 재생 가능

### 패키지 관리 (Docker)

```bash
docker exec -it witchs-cauldron-frontend npm install <pkg>
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
docker exec -it witchs-cauldron-frontend npm run build
```

---

## Backend 상세

FastAPI + Selenium 기반 치지직 클립 수집 서비스입니다.

### 구조

```
app/
├── main.py              # FastAPI 앱 엔트리
├── config.py            # Settings (pydantic-settings)
├── api/endpoints/       # clips, health, jobs
├── schemas/             # Pydantic 모델
├── services/
│   ├── clip_collector.py   # Selenium 수집기
│   ├── file_manager.py     # 파일 관리
│   ├── clip_scheduler.py   # 자동 갱신 스케줄러
│   └── job_manager.py      # 백그라운드 작업
└── core/
    └── selenium_driver.py  # WebDriver 팩토리
```

### 클립 수집

```bash
# 수집 시작 (5개, 인기순)
curl -X POST http://localhost:8000/api/clips/collect \
  -H "Content-Type: application/json" \
  -d '{"max_clips": 5, "filter_type": "ALL", "order_type": "POPULAR"}'

# 작업 상태 확인
curl http://localhost:8000/api/jobs/{job_id}

# 클립 목록
curl http://localhost:8000/api/clips
```

- 운영 기본 최대 2개 수집 (`MAX_CLIPS_PER_COLLECTION=2`)
- 클립당 약 30~60초 소요
- 최소 1GB RAM 권장 (Selenium)
- 파일명: `clip_{clip_id}_{title}.mp4`
- 저장: Backend `/app/shared/clips` → Frontend `/app/shared/clips:ro` (공유 볼륨), 공개 URL `/media/clips/*`
- HLS/TS 후보는 `ffmpeg -c copy -movflags +faststart`로 브라우저 재생 가능한 MP4 컨테이너로 remux
- 기존에 TS 세그먼트가 `.mp4` 확장자로 잘못 저장된 경우 `ftyp` 헤더 검사 후 제거하고 재수집
- 수집 결과가 0건이고 오류가 있으면 작업을 `failed`로 표시해 실패 원인을 API 응답에 노출

### 클립 자동 갱신

운영 compose(`docker-compose.prod.yml`, `docker-compose.server.yml`)는 서버 안정성을 위해 클립 자동 수집을 기본 비활성화합니다. 수동 수집은 API 키가 필요하며, 1회 2개 이하로 제한됩니다.

```bash
# 자동 갱신 상태 확인 (프론트엔드 프록시)
curl http://localhost:3000/api/clips/automation

# 백엔드 직접 확인
curl http://localhost:8000/api/jobs/automation
```

- `CLIP_AUTO_COLLECT_INTERVAL_MINUTES`: 반복 주기(최소 5분)
- `CLIP_AUTO_COLLECT_RUN_ON_STARTUP`: 컨테이너 시작 후 1회 실행 여부
- `CLIP_AUTO_COLLECT_ORDER_TYPE`: 기본 `RECENT`
- 이미 수집된 클립은 기존 파일 검사로 건너뛰고, 수동 수집 작업이 실행 중이면 예약 실행은 스킵됩니다.

### Xvfb 가상 디스플레이

헤드리스 모드에서 비디오 플레이어가 완전히 초기화되지 않는 문제를 해결하기 위해 Xvfb 가상 X11 디스플레이를 사용합니다.

- Dockerfile에 `xvfb`, `x11-utils` 설치
- `DISPLAY=:99` 환경변수 설정
- Chrome이 GUI 모드로 실행되어 비디오 재생 정상 동작

### 클립 수집 실패 기록

| 시도 | 방법 | 결과 |
|------|------|------|
| 1 | 기본 포팅 (헤드리스) | 미디어 URL 미발견 |
| 2 | URL 필터 확장 | 비-비디오 URL 캡처 (CSS, JS) |
| 3 | ffmpeg HLS 다운로드 | m3u8 미발견 |
| 4 | Xvfb 가상 디스플레이 | 클립 목록 추출 성공, 비디오 로딩 부분 성공 |

**원본 코드(ShortForm.py)의 핵심 차이점**: GUI 브라우저로 실행, `Network.responseReceived`만 확인, 엄격한 3단계 도메인 필터 (`naver-vod.pstatic.net`, `chzzk`, `glive-clip`)

---

## ChizzkData (로컬 클립 수집기)

치지직 플랫폼에서 클립을 자동 수집하는 Python 스크립트입니다.

### 요구사항

- Python 3.9+, Chrome 브라우저
- `selenium`, `beautifulsoup4`, `requests`, `webdriver-manager`

### 사용법

```bash
# 기본 실행
cd chizzkData && python ShortForm.py

# 커스텀 옵션
python ShortForm.py --max-clips 10 --order POPULAR --filter ALL \
  --idle-seconds 6 --max-wait-seconds 0 --min-segments 8 --min-duration 5
```

### 파일명 규칙

`clip_{클립ID}.mp4` - 동일 클립 중복 다운로드 자동 방지

### 저장 위치

- `ShortForm.py` 기본: `frontend/public/clips/`
- `test_bug_fix.py`: `프로젝트 루트/clips/`

### 안정화 개선 (2026-02-02)

- ts 세그먼트 혼합 방지 (그룹화 후 최대 그룹만 사용)
- 세그먼트 유입 중지 감지 (idle 기반 대기)
- ts concat 병합 다운로드 및 최소 세그먼트/길이 검증

---

## CI/CD

### 파이프라인

```
┌──────────────────────────────────────────────────────┐
│                   GitHub Actions                      │
├──────────────────────────────────────────────────────┤
│  CI (Pull Request)          CD (main branch push)     │
│  1. Checkout                1. Checkout                │
│  2. Setup Node 22           2. Setup Node 22           │
│  3. Install deps            3. Install deps            │
│  4. Type Check              4. Type Check              │
│  5. Lint                    5. Lint                     │
│  6. Test                    6. Test                     │
│  7. Backend validation      7. Backend validation       │
│  8. Build                   8. Build                    │
│                             9. SSH Deploy               │
└──────────────────────────────────────────────────────┘
                                 │ SSH
                                 ▼
                    ┌─────────────────────────┐
                    │   Ubuntu Server          │
                    │  reset main → deploy.sh  │
                    └─────────────────────────┘
```

Backend validation은 `backend/requirements.txt`를 설치한 뒤 `backend/app` 전체 컴파일과 `app.main` import를 수행합니다. 배포 후 헬스체크는 프론트엔드 URL과 backend 컨테이너 내부 `http://localhost:8000/api/health`를 모두 확인합니다.

배포 스크립트는 새 이미지를 빌드하기 전에 현재 실행 중인 frontend/backend 이미지 ID를 rollback tag로 보존합니다. 새 배포의 헬스체크가 실패하면 보존한 이미지를 `latest`로 복구해 컨테이너를 다시 만들고 헬스체크를 재실행합니다. 기존 실행 이미지가 없어 안전한 rollback을 준비할 수 없으면 배포를 시작하지 않습니다.

### GitHub Secrets

| Secret | 설명 |
|--------|------|
| `SSH_HOST` | 서버 IP |
| `SSH_USERNAME` | SSH 사용자명 |
| `SSH_PASSWORD` | SSH 비밀번호 |
| `DESK_SSH_PASSWORD` | 배포 비밀번호 대체 fallback (`SSH_PASSWORD`가 비어 있을 때 사용) |
| `SSH_PORT` | SSH 포트 |
| `SSH_HOST_FINGERPRINT` | 별도 채널로 확인한 운영 서버 host key의 SHA256 fingerprint |
| `DEPLOY_PATH` | 서버 프로젝트 경로 |

운영 SSH secret은 GitHub의 `production` environment에 저장합니다. 이 environment는 `main` branch만 허용하고 required reviewer를 설정해야 합니다. CD, rebuild, analytics maintenance, uptime recovery는 동일한 `production-operations` concurrency group을 사용하므로 운영 변경이 동시에 실행되지 않습니다.

### 직접 SSH 접속용 비밀번호 파일

로컬에서 운영 서버에 직접 접속할 때는 비밀번호를 명령줄에 쓰지 않고 암호화된 로컬 파일을 사용합니다. 이 파일은 `.secrets/` 아래에 두며 Git에 커밋하지 않습니다.

```powershell
# 로컬 도구 의존성 설치
python -m pip install -r tools/requirements.txt

# 최초 1회: 현재 Windows 사용자로만 복호화 가능한 비밀번호 파일 생성
New-Item -ItemType Directory -Force .secrets
Read-Host "SSH password" -AsSecureString |
  ConvertFrom-SecureString |
  Set-Content -NoNewline .secrets/prod-ssh-password.secure.txt

# 접속 정보 설정
$env:WITCHS_SSH_USERNAME = "<ssh-user>"
$env:WITCHS_SSH_PORT = "22"
$env:WITCHS_DEPLOY_PATH = "<server-project-path>"
$env:WITCHS_SSH_KNOWN_HOSTS = "$env:USERPROFILE\.ssh\known_hosts"

# 원격 명령 실행
.\tools\Invoke-ProdSsh.ps1 -RemoteCommand "pwd && docker ps"
```

- `tools/Invoke-ProdSsh.ps1`는 `.secrets/prod-ssh-password.secure.txt`를 읽어 SSH 접속에 사용합니다.
- 서버 공개키 fingerprint를 별도 채널로 확인한 뒤 `known_hosts`에 등록해야 하며, 등록되지 않았거나 달라진 키는 연결을 거부합니다.
- 비밀번호 파일은 `ConvertFrom-SecureString` 기반이므로 생성한 Windows 계정에서만 복호화됩니다. 다른 PC나 계정에서는 다시 생성해야 합니다.
- 비밀번호를 README, AGENTS, shell command, GitHub issue/comment, Git commit에 직접 쓰지 않습니다.

### 워크플로우 파일

- `.github/workflows/ci.yml` - PR 검증
- `.github/workflows/cd.yml` - 자동 배포
- `.github/workflows/rebuild.yml` - 수동 상태 점검 또는 데이터 볼륨을 보존하는 애플리케이션 재빌드 (`profile`이 기본값)
- `.github/workflows/analytics-maintenance.yml` - 승인 후 실행하는 운영 분석 DB 유지보수
- `.github/workflows/uptime-monitor.yml` - 공개 상태 확인 및 승인된 SSH 복구
- 작업 디렉터리: `frontend/`
- 배포 스크립트: `frontend/deploy.sh --clean`

---

## 배포 가이드

### 사전 요구사항

- Ubuntu 18.04+, 최소 2GB RAM, 10GB 디스크
- Docker, Docker Compose, Git 설치

### 배포 절차

```bash
# 프로젝트 클론
git clone <repository-url> ~/projects/witchs-cauldron
cd ~/projects/witchs-cauldron

# 환경 설정
cp .env.example .env
nano .env  # YOUTUBE_API_KEY, ADMIN_BASIC_AUTH_USERNAME, ADMIN_BASIC_AUTH_PASSWORD 등 설정

# 배포 실행
chmod +x frontend/deploy.sh frontend/manage.sh
./frontend/deploy.sh --clean
```

- GitHub Actions CD를 쓰는 경우 `ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`를 `production` environment secrets로 등록하면 서버 `.env`에 자동 반영됩니다.
- 프로덕션에서 두 값이 비어 있으면 `/admin/*` 와 `/api/analytics/stats` 는 503으로 차단됩니다.

### 관리 스크립트 (manage.sh)

```bash
./manage.sh start      # 시작
./manage.sh stop       # 중지
./manage.sh restart    # 재시작
./manage.sh status     # 상태 확인
./manage.sh health     # 헬스체크
./manage.sh logs       # 실시간 로그
./manage.sh logs-tail  # 최근 로그
./manage.sh update     # 업데이트 (빌드 + 재시작)
./manage.sh shell      # 컨테이너 쉘
./manage.sh clean      # 전체 정리 (주의)
```

### Nginx 리버스 프록시 (권장)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 멀티 프로젝트 동일 서버 운영 (Desk 프로젝트 공존)

기존 서비스 CI/CD에 영향 없이 같은 서버에서 Desk 프로젝트와 함께 운영하려면:

- Witchs Cauldron: `docker-compose.server.yml` 사용 (신규, 서버 공존용)
- Desk Support System: 별도 레포의 `docker-compose.server.yml` 사용
- 공용 Reverse Proxy: `/opt/apps/deploy/reverse-proxy`에서 도메인 라우팅

권장 도메인 분리:
- Witchs Cauldron: `moingfans.com`
- Desk: `deskops.example.net` *(완전히 다른 도메인)*

핵심 규칙:
- 앱 컨테이너는 외부 `ports` 최소화/제거, 프록시만 80/443 오픈
- 두 프로젝트 모두 Docker external network `web`에 연결
- 기존 `docker-compose.prod.yml` 및 기존 GitHub Actions 흐름은 유지

### SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 자동 시작 (systemd)

```ini
[Unit]
Description=Witchs Cauldron Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/witchs-cauldron
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down

[Install]
WantedBy=multi-user.target
```

---

## 운영/유지보수

### 정기 점검

| 주기 | 항목 |
|------|------|
| 일일 | `./manage.sh health`, 오류 로그 스캔 |
| 주간 | `docker stats`, `df -h`, API 키 쿼터 확인 |
| 월간 | 전체 로그 점검, `docker builder prune -f` |

### 장애 대응

| 증상 | 조치 |
|------|------|
| Frontend 응답 없음 | `docker compose logs frontend` → 재시작 |
| Backend 응답 없음 | `docker compose logs backend` → 재시작 |
| YouTube API 오류 | `YOUTUBE_API_KEY` 확인/교체 |
| 클립 수집 실패 | `/api/health`로 Selenium 상태 확인, 메모리 확인 (최소 1GB) |
| 수집 작업이 완료됐지만 클립이 0개 | `/api/clips/jobs/{job_id}`의 `error` 확인. 미디어 URL/다운로드 실패가 숨겨지지 않고 노출되어야 함 |
| 수집된 클립이 404 | Frontend `/media/clips/[...filename]` 동적 라우트 배포 여부, `SHARED_CLIPS_DIR`와 `shared_clips` 볼륨 마운트 확인 |
| 수집된 클립이 재생되지 않음 | `curl -H "Range: bytes=0-31" <clip-url>` 결과가 `206`, `video/mp4`, `ftyp` 헤더인지 확인. `0x47`로 시작하면 TS 조각이므로 재수집 필요 |
| Analytics DB 연결 실패 | `ANALYTICS_DATABASE_URL` 확인, `docker compose logs analytics-db` |
| 디스크 부족 | `docker system prune -a` |
| 빌드 실패 (SWC) | Docker 환경에서 빌드 (Node.js 22) |
| 컴포넌트 렌더링 안됨 | `--force-recreate` 옵션으로 컨테이너 재생성 |

### 백업 포인트

- `.env` 파일 (API 키 포함) - 변경 전 백업 필수
- 정적 자산: `public/rightAside`, `public/mainPage`, `public/clips`
- 코드: Git 기준 관리, 문제 시 직전 커밋으로 롤백 후 `./manage.sh update`

---

## Analytics 대시보드

### 개요

- **경로**: `/admin/analytics` (실제 대시보드) / `/admin` (운영자용 짧은 진입점, `/admin/analytics` 로 리다이렉트)
- **보호 범위**: `/admin/:path*`, `/api/analytics/stats`
- **DB**: PostgreSQL 기반 자체 분석 (외부 서비스 없음)
- **이벤트 타입**: `pageview`, `menu_click`, `content_click`, `section_view`, `scroll_depth`, `page_exit`
- **세션**: UUID 쿠키(`wc_session`, 30일 만료) 기반, IP/User-Agent 저장
- **재방문자**: 조회 기간 내 첫 방문 이전 30일 내 pageview 기록이 있는 방문자

### 데이터 수집 흐름

```
[브라우저]                    [서버]                     [DB]
    │                          │                         │
    ├── AnalyticsProvider ─────┤                         │
    │   ├── pageview           │                         │
    │   │   (라우트 변경 시)   │                         │
    │   └── menu_click         │                         │
    │       ([data-analytics-  │                         │
    │        menu] 클릭)       │                         │
    │                          │                         │
    ├── useSectionView ────────┤                         │
    │   └── section_view       │                         │
    │       (50% 가시성,       │                         │
    │        세션당 1회)       │                         │
    │                          │                         │
    └── trackEvent() ─────────▶ POST /api/analytics/track│
        (sendBeacon 우선,      │    ├── 세션 UPSERT ─────▶ analytics_sessions
         fetch 폴백)           │    └── 이벤트 INSERT ───▶ analytics_events
                               │                         │
        GET /api/analytics/stats◀── 병렬 SQL 집계 ────────┘
```

### 클라이언트 수집 메커니즘

#### 1. AnalyticsProvider (`components/analytics/AnalyticsProvider.tsx`)

루트 레이아웃에 마운트되어 자동으로 네 가지 이벤트를 수집합니다.

**pageview**: Next.js 라우트 변경 시 자동 발송
- `/admin` 경로는 제외
- 동일 path 중복 전송 방지 (`lastTrackedPathRef`)
- bfcache 복귀(`pageshow` 이벤트) 시에도 재기록
- 수집 필드: `path`, `referrer`

**menu_click**: `[data-analytics-menu]` 속성이 있는 요소 클릭 시 발송
- document 레벨 클릭 이벤트 위임 (capture phase)
- 위치 자동 추론: `header`, `footer`, `aside`, `nav`, `unknown`
- 수집 필드: `element.type`, `element.id`, `element.label`, `metadata.location`
- 라벨 우선순위: `data-analytics-label` > `aria-label` > `textContent`

**scroll_depth**: 25/50/75/100% 스크롤 도달 시 threshold별 1회 발송
- 수집 필드: `metadata.threshold`, `metadata.depth`
- 깊은 스크롤 도달률은 75% 이상 threshold를 방문자 기준으로 계산

**page_exit**: `pagehide` 또는 `visibilitychange=hidden` 시 발송
- 수집 필드: `metadata.dwell_seconds`, `metadata.max_scroll_depth`
- 체류 시간, 빠른 이탈률, 평균 이탈 스크롤 계산에 사용

#### 2. useSectionView 훅 (`hooks/useSectionView.ts`)

**section_view**: IntersectionObserver 기반, 섹션이 50% 이상 화면에 노출되면 발송
- 모듈 레벨 `Set`으로 세션당 섹션별 1회만 추적 (페이지 새로고침 전까지 중복 방지)
- 수집 필드: `element.type` = `"section"`, `element.id` = sectionId, `element.label` = sectionId

#### 3. trackEvent 전송 함수 (`components/analytics/track.ts`)

모든 이벤트의 공통 전송 레이어입니다.
- **1차**: `navigator.sendBeacon` (페이지 이탈 시에도 안전하게 전송)
- **2차**: `fetch` (sendBeacon 실패 시 폴백, `keepalive: true`)
- 전송 실패 시 조용히 무시 (사용자 경험 보호)

### 서버 수집 API (`api/analytics/track/route.ts`)

`POST /api/analytics/track`로 이벤트를 수신합니다.

**세션 관리**:
1. `wc_session` 쿠키에서 세션 ID 확인
2. 없으면 `crypto.randomUUID()`로 새 세션 생성, 응답에 쿠키 설정 (30일 만료)
3. `analytics_sessions` 테이블에 UPSERT (IP/User-Agent 최신값 갱신)

**이벤트 저장**:
- `analytics_events` 테이블에 INSERT
- 저장 필드: `session_id`, `ip`, `event_type`, `path`, `referrer`, `element_type`, `element_id`, `element_label`, `metadata`
- 텍스트 필드 길이 제한: event_type 64자, path/referrer 512자, label 128자

### 통계 집계 API (`api/analytics/stats/route.ts`)

`GET /api/analytics/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`로 집계 결과를 반환합니다.

이 엔드포인트는 프로덕션에서 Basic Auth로 보호됩니다 (`ADMIN_BASIC_AUTH_USERNAME`, `ADMIN_BASIC_AUTH_PASSWORD`).

기본 범위: 최근 7일 (`today - 6일` ~ `today`). `to` 날짜는 **포함** (내부적으로 다음날 00:00 UTC 미만으로 처리).

### 대시보드 컬럼별 수집/집계 방법

| 대시보드 섹션 | API 필드 | 집계 SQL | 수집 원천 |
|---|---|---|---|
| **방문자** | `totals.visitors` | `COUNT(DISTINCT COALESCE(session_id, ip))` (pageview만) | AnalyticsProvider pageview |
| **재방문자** | `totals.returningVisitors` | 조회 기간 내 첫 pageview 이전 30일 내 동일 visitor_key의 pageview 존재 여부 | AnalyticsProvider pageview |
| **페이지뷰** | `totals.pageviews` | `COUNT(*)` WHERE event_type = 'pageview' | AnalyticsProvider pageview |
| **메뉴 클릭** | `totals.menuClicks` | `COUNT(*)` WHERE event_type = 'menu_click' | AnalyticsProvider menu_click |
| **클릭률** | `metrics.clickThroughRate` | `(menu_click + content_click) / pageviews * 100` | pageview, click 이벤트 |
| **페이지/방문** | `metrics.pagesPerVisitor` | `pageviews / visitors` | pageview |
| **재방문율** | `metrics.returningVisitorRate` | `returningVisitors / visitors * 100` | pageview |
| **깊은 스크롤** | `metrics.deepScrollRate` | 75% 이상 scroll_depth visitor / visitors * 100 | AnalyticsProvider scroll_depth |
| **일별 트렌드** | `daily[]` | `generate_series`로 날짜를 채우고 일별 event_type별 집계 | pageview, menu_click, section_view, page_exit |
| **기간 요약** | 클라이언트 계산 | 일평균, 최고/최저 트래픽일, 페이지/방문, 재방문율, 빠른 이탈률 | daily[] + metrics |
| **이벤트 구성** | `eventTypes[]` | event_type별 `COUNT(*)`, DISTINCT visitor | analytics_events |
| **섹션 조회 수** | `sectionViews[]` | `COUNT(*)`, DISTINCT visitor WHERE event_type = 'section_view' GROUP BY element_id, element_label | useSectionView section_view |
| **상호작용 TOP 12** | `topInteractions[]` | `menu_click`, `content_click` 통합 GROUP BY element/location | AnalyticsProvider click 이벤트 |
| **메뉴 클릭 TOP 10** | `topMenuClicks[]` | `COUNT(*)`, DISTINCT visitor WHERE event_type = 'menu_click' GROUP BY element/location LIMIT 10 | AnalyticsProvider menu_click |
| **페이지 경로 TOP 10** | `topPaths[]` | `COUNT(*)`, DISTINCT visitor WHERE event_type = 'pageview' GROUP BY path LIMIT 10 | AnalyticsProvider pageview |
| **Referrer TOP 10** | `topReferrers[]` | referrer 호스트명 GROUP BY, NULL/빈값은 '(direct)', 방문자 수 포함 | AnalyticsProvider pageview |

### 추적 대상 섹션 (7개)

| 섹션 ID | 한글 라벨 | 트리거 |
|---------|----------|--------|
| `featured-latest` | 최신 영상 | 스크롤하여 50% 노출 시 |
| `featured-top` | 인기 영상 | 스크롤하여 50% 노출 시 |
| `clips-section` | 숏폼 하이라이트 | 스크롤하여 50% 노출 시 |
| `schedule-section` | 방송 일정 | 스크롤하여 50% 노출 시 |
| `youtube-official` | 공식 유튜브 | 스크롤하여 50% 노출 시 |
| `youtube-full` | 다시보기 | 스크롤하여 50% 노출 시 |
| `youtube-fan` | 팬 영상 | 스크롤하여 50% 노출 시 |

### 알려진 이슈

| ID | 우선순위 | 상태 | 요약 |
|---|---|---|---|
| A-01 | P1 | Open | 클릭/페이지뷰 집계 불안정 (`/admin` 경로 추적 제외, 동일 path 중복 방지) |
| A-02 | P1 | Open | 일별 트렌드 모바일 렌더링/터치 UX 문제 |
| A-03 | P1 | Open | 관리자 헤더 모바일 겹침 위험 |
| A-04 | P1 | Open | 차트 hover 중심 UX, 모바일 터치 대응 부족 |
| A-05 | P2 | Open | 툴팁 위치 계산 고정폭 가정 |
| A-06 | P2 | Open | 10~11px 텍스트 모바일 가독성 저하 |
| A-07 | P2 | Open | 관리자/메인 화면 비주얼 언어 불일치 |

---

## Agent Teams

프로젝트 컨텍스트는 루트 `AGENTS.md`, 역할별 에이전트 지침은 `.codex/agents/*.toml`에서 관리합니다. 모델 선택은 저장소에 고정하지 않고 실행 환경을 따릅니다.

기능 변경은 요구사항·구현·정적 검증·런타임 검증·문서화 순서로 진행하고, 독립적인 검토는 병렬 실행할 수 있습니다. 같은 파일을 수정하는 작업이나 배포처럼 외부 상태를 바꾸는 작업은 직렬로 수행합니다.

---

## Docker 테스트

### 스택 실행

```bash
docker compose up -d --build
docker compose ps
# frontend, backend, analytics-db 모두 Up 확인
```

### 정적 검증 (컨테이너 내부)

```bash
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
docker exec -it witchs-cauldron-frontend npm run lint
docker exec -it witchs-cauldron-frontend npm run build
```

### Analytics API 스모크

```bash
# 이벤트 적재
curl -i -X POST http://localhost:3000/api/analytics/track \
  -H "Content-Type: application/json" \
  -d '{"type":"pageview","path":"/admin/analytics","referrer":"cli-test"}'

# 통계 조회 (프로덕션과 동일하게 Basic Auth 포함)
curl -i -u '<admin-username>:<admin-password>' \
  'http://localhost:3000/api/analytics/stats'
# totals.visitors >= 0, daily[], topMenuClicks[] 구조 확인
```

### 정리

```bash
docker compose down        # 컨테이너만
docker compose down -v     # 데이터 포함
```

---

## 테스팅 가이드

### 1) 코드 검증 (로컬)

```bash
cd frontend
npx tsc --noEmit     # TypeScript 타입 체크
npm run lint         # ESLint 검사
```

### 2) Docker 빌드 및 재시작

```bash
docker compose -f docker-compose.prod.yml build frontend
docker compose -f docker-compose.prod.yml up -d --force-recreate frontend
```

### 3) API 검증

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/youTubePlayer
curl http://localhost:3000/api/youTubePlayer/topOfficial
curl http://localhost:3000/api/youtubeShorts
curl -u '<admin-username>:<admin-password>' 'http://localhost:3000/api/analytics/stats'
```

### 4) 클립 수집/재생 검증

```bash
# 수집 시작 (운영 기본 최대 2개, API 키 필요)
curl -X POST http://localhost:3000/api/clips/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <COLLECT_API_KEY>" \
  -d '{"max_clips":1,"filter_type":"ALL","order_type":"RECENT"}'

# 작업 상태 확인
curl http://localhost:3000/api/clips/jobs/<job_id>

# 자동 갱신 상태 확인
curl http://localhost:3000/api/clips/automation

# 클립 Range/MP4 헤더 확인
curl -I -H "Range: bytes=0-31" "http://localhost:3000/media/clips/<filename>.mp4"
```

정상 조건:
- 페이지에 치지직 클립이 10개 이하로 렌더링됨
- 클립 응답이 `206 Partial Content`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`
- 첫 32바이트에 `ftyp` 문자열 포함
- 브라우저 `<video>`가 `readyState >= 2`, `error = null`, `currentTime` 증가

### 5) 사이트 방문 테스트

| URL | 확인 사항 |
|-----|----------|
| http://localhost:3000 | 메인 페이지 렌더링, YouTube 영상 표시 |
| http://localhost:3000/admin | 브라우저 Basic Auth 로그인 후 `/admin/analytics` 로 이동 |
| http://localhost:3000/admin/analytics | 브라우저 Basic Auth 로그인 후 대시보드/차트 표시 |

### 알려진 경고 (사전 존재, 비차단)

- `VideoCard.tsx` - `<img>` 대신 Next.js `<Image>` 사용 권고
- themeColor in metadata (viewport export 필요)
- sharp 패키지 미설치 (Image Optimization)

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Tailwind CSS 빌드 오류 | `postcss.config.js` 설정 문제 | `@tailwindcss/postcss`만 남기고 autoprefixer 제거 |
| `/admin` / `/admin/analytics` / `/api/analytics/stats` 가 401 | Basic Auth 미입력/오입력 | 브라우저 또는 `curl -u '<admin-username>:<admin-password>' ...` 로 확인 |
| `/admin` / `/admin/analytics` / `/api/analytics/stats` 가 503 | `ADMIN_BASIC_AUTH_USERNAME` / `ADMIN_BASIC_AUTH_PASSWORD` 미설정 | `.env` 또는 GitHub Actions secrets 설정 후 재배포 |
| 모듈 찾을 수 없음 | 빌드 캐시 | `docker builder prune -f && ./deploy.sh --clean` |
| Docker Compose 버전 경고 | 최신 Compose에서 불필요 | 무시 가능 |
| YouTube API 키 오류 | `YOUTUBE_API_KEY` 미설정 | `.env`에 키 추가 후 컨테이너 재시작 |
| 포트 충돌 | 3000 포트 사용 중 | `sudo netstat -tlnp \| grep :3000` → 프로세스 종료 |
| Docker 권한 | 사용자가 docker 그룹에 없음 | `sudo usermod -aG docker $USER && newgrp docker` |
| 메모리 부족 | Selenium/빌드 시 OOM | `free -h` 확인, `docker system prune -a` |
| 방송 일정 비정상 | CSV URL 문제 | `/api/broadCastSchedule?diagnostics=1`로 단계별 확인 |
| ISR 캐시 미갱신 | Docker standalone 환경 | `no-store` 사용 |

---

## 변경 이력

### 2026-04-28
- 치지직 클립 수집 상한을 10개로 고정
- Backend 수집 작업 실패 상태 보고 개선 (`0 collected + errors`를 실패로 노출)
- 운영 Docker `shared_clips` 볼륨 권한 보정 (`docker-entrypoint.sh`)
- Next standalone 환경에서 새 클립이 404가 되지 않도록 `/media/clips/[...filename]` 동적 스트리밍 라우트와 `/clips/*` 호환 rewrite 추가
- HLS/TS 클립을 브라우저 재생 가능한 MP4로 remux하고, 잘못 저장된 TS 기반 `.mp4`를 재수집하도록 보정
- 운영 검증: CD 성공, 최신 수집 job 10개 완료, 10개 클립 모두 `206`/`video/mp4`/`ftyp` 확인, Chrome 재생 확인

### 2026-04-06
- `/admin/*`, `/api/analytics/stats` 에 Basic Auth 보호 추가
- 배포용 `.env.example`, docker compose, GitHub Actions CD 문서/환경 반영

### 2026-02-26
- 전체 MD 문서를 README.md로 통합

### 2026-02-20
- Character Design Sheet 기반 컬러 시스템 적용

### 2026-02-11
- Analytics/디자인 이슈 통합 보고서 작성 (A-01 ~ A-09)
- Analytics QA 보고서: 코드 수정 완료, 자동 검증 통과, 수동 QA 대기

### 2026-02-08
- `/admin/analytics` 공개 접근 변경 (인증 제거)
- Analytics 대시보드 UI 개선 (일별 트렌드, 기간 프리셋, 로딩/재시도)
- `codex` 기본 권한 설정, Agent Teams 기능 활성화
- Agent Teams 점검 및 보완 (런타임 모니터링, 워크플로우 시각화 추가)

### 2026-02-05
- 섹션 뷰 추적 기능 (`useSectionView` 훅, `SectionTracker` 컴포넌트)

### 2026-02-03
- 방문자/클릭 분석 시스템 (Postgres 기반, 운영자 대시보드)
- analytics-db 서비스 추가

### 2026-02-02
- Git 저장소 구조 승격 (루트 → Git 저장소, subtree 통합)
- CI/CD 경로 조정 (루트 `.github/workflows`)
- Xvfb 가상 디스플레이 적용 (Backend 클립 수집)
- 치지직 클립 수집기 안정화 (ts 세그먼트 병합, idle 감지)
- 클립 렌더링 정책 (Git 포함, URL 인코딩)

### 이전 변경
- YouTube Shorts 필터링 기준 65초 → 185초
- 모바일 햄버거 메뉴, Footer 강화, 일정 그리드 반응형
- Analytics 대시보드 리디자인/원복
- ScheduleModal 추가
- 코드베이스 정리 (미사용 파일 11개 삭제, 518줄 dead code 제거)
- 2열 숏폼 레이아웃 (치지직 클립 + YouTube Shorts)
- 숏폼 클립 뷰어 (틱톡/릴스 스타일)
- CI/CD 구축 (GitHub Actions 자동 배포)

---

## 라이선스

이 프로젝트는 개인 팬 프로젝트로 제작되었습니다.
