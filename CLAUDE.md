# CLAUDE.md - 프로젝트 컨텍스트 (루트)

이 문서는 Claude Code가 프로젝트를 빠르게 이해하고 효율적으로 작업할 수 있도록 모든 핵심 정보를 통합한 문서입니다.

---

## 프로젝트 개요

**프로젝트명**: 마녀의 포션 공방 (Witchs Cauldron)
**설명**: 버튜버 "모잉(Moing)"을 위한 팬 커뮤니티 웹사이트
**주요 기능**: 방송 스케줄, YouTube 콘텐츠, 치지직 라이브 상태, 팬아트 갤러리, 하이라이트 숏폼, **클립 자동 수집**, **방문자/클릭 분석**
**GitHub**: https://github.com/ReverserofCode/witchs-cauldron

---

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **Frontend** | | |
| 프레임워크 | Next.js (App Router) | 14.2.5 |
| 언어 | TypeScript | 5.9.2 |
| UI | React | 18.3.1 |
| 스타일링 | Tailwind CSS | v4 |
| 런타임 | Node.js (Alpine) | 22 |
| **Backend** | | |
| 프레임워크 | FastAPI | 0.115.6 |
| 언어 | Python | 3.11 |
| 브라우저 자동화 | Selenium | 4.27.1 |
| 브라우저 | Chromium + Xvfb | - |
| **데이터베이스** | | |
| 분석용 DB | PostgreSQL (Alpine) | 16 |
| **인프라** | | |
| 배포 | Docker | multi-stage build |
| CI/CD | GitHub Actions | - |

---

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Frontend     │────▶│    Backend      │     │  Analytics DB   │
│   (Next.js)     │     │   (FastAPI)     │     │  (PostgreSQL)   │
│   Port: 3000    │     │   Port: 8000    │     │   Port: 5432    │
│                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────▲────────┘
         │                       │                       │
         │  shared_clips 볼륨    │       Analytics API   │
         │  (/app/public/clips)  │       (/api/analytics)│
         └───────────┬───────────┘                       │
                     │                                   │
              ┌──────▼──────┐                            │
              │   Clips     │      Frontend ────────────┘
              │  (MP4 등)   │
              └─────────────┘
```

---

## 프로젝트 구조

```
witchs-cauldron/                      # 프로젝트 루트
│
├── CLAUDE.md                         # 이 문서 (통합 컨텍스트)
├── docker-compose.yml                # 개발 환경 (Frontend + Backend)
├── docker-compose.prod.yml           # 프로덕션 환경
│
├── .claude/                          # Claude Code 에이전트 설정
│   └── agents/
│       ├── code-generator.md         # 코드 생성/수정
│       ├── code-tester.md            # 테스트/빌드 검증
│       ├── code-validator.md         # 코드 리뷰/검증
│       ├── codebase-structure-analyzer.md
│       ├── dependency-analyzer.md    # 패키지 의존성 분석
│       ├── documentation-generator.md # 문서 생성/업데이트
│       ├── external-tool-integrator.md
│       ├── lint-checker.md           # ESLint/TypeScript 검사
│       ├── orchestrator-planner.md
│       ├── requirements-analyzer.md
│       └── token-optimizer.md
│
├── backend/                          # FastAPI 백엔드 (클립 수집)
│   ├── Dockerfile                    # Python + Selenium + Chromium
│   ├── requirements.txt
│   └── app/
│       ├── main.py                   # FastAPI 앱 엔트리
│       ├── config.py                 # 환경 설정
│       ├── api/
│       │   ├── router.py
│       │   └── endpoints/
│       │       ├── clips.py          # 클립 API
│       │       ├── health.py         # 헬스체크
│       │       └── jobs.py           # 수집 작업 상태
│       ├── schemas/
│       │   ├── clip.py               # Pydantic 모델
│       │   └── job.py
│       ├── services/
│       │   ├── clip_collector.py     # 클립 수집기 (Selenium)
│       │   ├── file_manager.py       # 파일 관리
│       │   └── job_manager.py        # 백그라운드 작업 관리
│       └── core/
│           └── selenium_driver.py    # WebDriver 팩토리
│
├── frontend/                         # Next.js 프론트엔드 (Git 저장소 루트)
│   ├── .github/workflows/            # GitHub Actions
│   │   ├── ci.yml                    # PR 검증 워크플로우
│   │   └── cd.yml                    # CD 배포 워크플로우
│   │
│   ├── app/
│   │   ├── api/                      # API Routes
│   │   │   ├── health/               # 헬스체크
│   │   │   ├── broadCastSchedule/    # 방송 일정
│   │   │   ├── chzzkPlayer/          # 치지직 라이브/클립
│   │   │   ├── youTubePlayer/        # YouTube 영상
│   │   │   ├── youtubeShorts/        # YouTube Shorts
│   │   │   └── analytics/            # 방문자/클릭 분석 API
│   │   │       ├── db.ts             # PostgreSQL 연결/스키마
│   │   │       ├── track/route.ts    # 이벤트 수집
│   │   │       └── stats/route.ts    # 통계 조회
│   │   ├── admin/                    # 운영자 전용 페이지
│   │   │   └── analytics/page.tsx    # 분석 대시보드
│   │   ├── components/
│   │   │   ├── cards/                # 카드 컴포넌트
│   │   │   ├── gallery/              # 갤러리 (FanArtGallery)
│   │   │   ├── modals/               # 모달 (FanArtModal)
│   │   │   ├── layout/               # Header, Footer, Sidebars
│   │   │   ├── sections/             # 메인 섹션 컴포넌트
│   │   │   ├── status/               # 상태 표시
│   │   │   └── analytics/            # 분석 추적 유틸
│   │   │       └── track.ts          # 클라이언트 이벤트 전송
│   │   ├── hooks/                    # 커스텀 훅
│   │   ├── page.tsx                  # 홈페이지
│   │   ├── layout.tsx                # 루트 레이아웃
│   │   └── globals.css               # 전역 스타일
│   │
│   ├── public/
│   │   ├── mainPage/                 # 프로필, 아이콘
│   │   ├── rightAside/               # 팬아트 이미지 (자동 스캔)
│   │   ├── clips/                    # 클립 비디오 (공유 볼륨)
│   │   └── gnbIcon/                  # 네비게이션 아이콘
│   │
│   ├── Docker 설정
│   │   ├── Dockerfile                # 멀티스테이지 빌드 (3단계)
│   │   ├── deploy.sh                 # 무중단 배포 스크립트
│   │   └── healthcheck.js            # 컨테이너 헬스체크
│   │
│   └── 설정 파일
│       ├── next.config.js            # standalone 출력
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── tsconfig.json
│
└── chizzkData/                       # 기존 코드 (참조용 보관)
    └── ShortForm.py                  # 원본 클립 수집기
```

---

## 주요 파일 위치 (빠른 참조)

### Frontend

| 기능 | 경로 |
|------|------|
| 홈페이지 | `frontend/app/page.tsx` |
| 루트 레이아웃 | `frontend/app/layout.tsx` |
| 전역 스타일 | `frontend/app/globals.css` |
| 방송 일정 섹션 | `frontend/app/components/sections/ScheduleSection.tsx` |
| 숏폼 섹션 (2열) | `frontend/app/components/sections/ClipsSection.tsx` |
| 치지직 클립 뷰어 | `frontend/app/components/sections/ClipsViewer.tsx` |
| YouTube Shorts 뷰어 | `frontend/app/components/sections/YouTubeShortsViewer.tsx` |
| 팬아트 갤러리 | `frontend/app/components/gallery/FanArtGallery.tsx` |
| 분석 대시보드 | `frontend/app/admin/analytics/page.tsx` |
| 분석 DB 연결 | `frontend/app/api/analytics/db.ts` |
| 이벤트 수집 API | `frontend/app/api/analytics/track/route.ts` |
| 통계 조회 API | `frontend/app/api/analytics/stats/route.ts` |

### Backend

| 기능 | 경로 |
|------|------|
| FastAPI 앱 | `backend/app/main.py` |
| 환경 설정 | `backend/app/config.py` |
| 클립 수집기 | `backend/app/services/clip_collector.py` |
| 클립 API | `backend/app/api/endpoints/clips.py` |
| WebDriver 팩토리 | `backend/app/core/selenium_driver.py` |

---

## API 엔드포인트 요약

### Frontend API (Next.js)

| 엔드포인트 | 목적 | 캐싱 |
|------------|------|------|
| `/api/health` | Docker 헬스체크 | - |
| `/api/broadCastSchedule` | Google Sheets → 방송 일정 | ISR 3분 |
| `/api/chzzkPlayer` | 치지직 라이브 상태 | no-store |
| `/api/youTubePlayer` | 최신 YouTube 영상 | ISR 1분 |
| `/api/youTubePlayer/topOfficial` | 월간 인기 영상 | ISR 1분 |
| `/api/youtubeShorts` | YouTube Shorts (팬채널) | ISR 1분 |
| `/api/youtubeShorts/official` | YouTube Shorts (공식채널) | ISR 1분 |
| `/api/analytics/track` | 페이지뷰/클릭 이벤트 수집 | no-store |
| `/api/analytics/stats` | 통계 조회 | no-store |
| `/admin/analytics` | 분석 대시보드 | - |

### Backend API (FastAPI)

| Method | 엔드포인트 | 목적 |
|--------|------------|------|
| GET | `/api/health` | 헬스체크 (Selenium 상태 포함) |
| GET | `/api/clips` | 클립 목록 조회 (`?limit=10&offset=0`) |
| GET | `/api/clips/{clip_id}` | 개별 클립 상세 |
| POST | `/api/clips/collect` | 클립 수집 트리거 |
| DELETE | `/api/clips/{clip_id}` | 클립 삭제 |
| GET | `/api/jobs/{job_id}` | 수집 작업 상태 확인 |
| GET | `/api/jobs` | 최근 작업 목록 |

---

## 환경 변수

### Frontend

```bash
# 필수
YOUTUBE_API_KEY=your_youtube_api_key

# 분석 기능 (선택)
ANALYTICS_DATABASE_URL=postgres://analytics:analytics@analytics-db:5432/analytics

# 기타 선택
BROADCAST_SCHEDULE_CSV_URL=custom_google_sheets_url
NEXT_TELEMETRY_DISABLED=1
BACKEND_URL=http://backend:8000  # Docker 환경
```

### Backend

```bash
# 앱 설정
DEBUG=false
APP_NAME=Witchs Cauldron Backend

# 치지직 설정
CHZZK_CHANNEL_ID=1d333ff175b4db5bd06f87a88579ec1e

# 경로 (Docker)
CLIPS_DIR=/app/shared/clips

# Selenium 설정 (Xvfb 사용)
CHROME_BINARY=/usr/bin/chromium
CHROMEDRIVER_PATH=/usr/bin/chromedriver
HEADLESS=false           # Xvfb 가상 디스플레이 사용 시 false
USE_XVFB=true            # Xvfb 가상 디스플레이 활성화

# 수집 설정
MAX_CLIPS_PER_COLLECTION=10
COLLECTION_TIMEOUT=300
```

---

## 빌드 및 실행

### 개발 환경 (권장)

```bash
# 루트 디렉토리에서 실행 (Frontend + Backend 함께)
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 개별 서비스 재시작
docker-compose restart backend
docker-compose restart frontend
```

### 프로덕션 환경

```bash
# 프로덕션 빌드 및 실행
docker-compose -f docker-compose.prod.yml up -d --build

# 헬스 체크
curl http://localhost:8000/api/health  # Backend
curl http://localhost:3000/api/health  # Frontend
```

### Frontend만 로컬 개발 (npm)

```bash
cd frontend && npm run dev
```

### Backend만 로컬 개발 (Python)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## Docker 구성

### 통합 docker-compose.yml

```yaml
services:
  analytics-db:
    container_name: witchs-cauldron-analytics-db
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      - POSTGRES_USER=analytics
      - POSTGRES_PASSWORD=analytics
      - POSTGRES_DB=analytics
    volumes:
      - analytics_data:/var/lib/postgresql/data

  backend:
    container_name: witchs-cauldron-backend
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - shared_clips:/app/shared/clips
    deploy:
      resources:
        limits:
          memory: 1G  # Selenium 때문에 충분히 확보

  frontend:
    container_name: witchs-cauldron-frontend
    image: node:22-alpine
    ports: ["3000:3000"]
    volumes:
      - shared_clips:/app/public/clips:ro  # 읽기 전용
    depends_on:
      backend:
        condition: service_healthy
      analytics-db:
        condition: service_healthy

volumes:
  shared_clips: null    # 클립 공유 볼륨
  analytics_data: null  # 분석 DB 데이터
```

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim
RUN apt-get install -y chromium chromium-driver
# Selenium + Chromium 헤드리스 환경
```

---

## 클립 수집 사용법

### 1. API를 통한 수집 트리거

```bash
# 클립 수집 시작 (5개, 인기순)
curl -X POST http://localhost:8000/api/clips/collect \
  -H "Content-Type: application/json" \
  -d '{"max_clips": 5, "filter_type": "ALL", "order_type": "POPULAR"}'

# 응답: {"job_id": "abc12345", "message": "...", "estimated_time": 175}
```

### 2. 작업 상태 확인

```bash
curl http://localhost:8000/api/jobs/abc12345

# 응답: {"job_id": "abc12345", "status": "running", "progress": 40, ...}
```

### 3. 클립 목록 조회

```bash
curl http://localhost:8000/api/clips

# 응답: {"clips": [...], "total": 10, "limit": 50, "offset": 0}
```

### 클립 파일 형식

- **파일명**: `clip_{clip_id}_{title}.mp4`
- **저장 위치**: Backend → `/app/shared/clips`
- **Frontend 접근**: `/clips/clip_xxx.mp4` (public/clips)

---

## 컴포넌트 계층

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

## 디자인 토큰

```css
--color-moing-primary: #A020F0    /* 메인 보라색 */
--color-moing-accent: #ADD8E6     /* 액센트 하늘색 */
--color-moing-deep: #191970       /* 딥 네이비 */
```

**SectionCard tone**: `neutral` | `lavender` | `dimmed`

---

## 외부 서비스

| 서비스 | 용도 | API |
|--------|------|-----|
| 치지직 | 라이브 상태, 클립 수집 | Chzzk API + Selenium |
| YouTube | 영상 메타데이터 | YouTube Data API v3 |
| Google Sheets | 방송 스케줄 | CSV export |
| PostgreSQL | 방문자/클릭 분석 | pg (Node.js 드라이버) |

---

## 장애 대응 체크리스트

1. **Frontend 응답 없음**: `docker-compose logs frontend` → 재시작
2. **Backend 응답 없음**: `docker-compose logs backend` → 재시작
3. **클립 수집 실패**:
   - `/api/health`로 Selenium 상태 확인
   - 메모리 부족 여부 확인 (최소 1GB 권장)
4. **YouTube API 오류**: `YOUTUBE_API_KEY` 확인
5. **디스크 부족**: `docker system prune -a`
6. **Analytics DB 연결 실패**:
   - `docker-compose logs analytics-db` 확인
   - `ANALYTICS_DATABASE_URL` 환경 변수 확인
   - 프로덕션: Fallback URL이 적용되는지 확인

---

## Claude Code 에이전트

### 사용 가능한 에이전트 (11개)

| 에이전트 | 용도 | 모델 | 병렬 실행 |
|----------|------|------|----------|
| `code-generator` | 코드 생성/수정/리팩토링 | sonnet | - |
| `code-tester` | 테스트, 빌드, 타입체크 | sonnet | O |
| `code-validator` | 코드 리뷰, 품질 검증 | sonnet | O |
| `lint-checker` | ESLint/TypeScript 빠른 검사 | haiku | O |
| `dependency-analyzer` | npm 패키지 분석, 보안 취약점 | haiku | O |
| `documentation-generator` | 문서 생성/업데이트 | sonnet | O |
| `codebase-structure-analyzer` | 코드베이스 구조 분석 | sonnet | - |
| `external-tool-integrator` | 외부 도구 연동 | sonnet | - |
| `orchestrator-planner` | 멀티 에이전트 조율 | sonnet | - |
| `requirements-analyzer` | 요구사항 분석 | sonnet | - |
| `token-optimizer` | 토큰 최적화 | sonnet | - |

### CLI 실행 시 MD 자동 주입

- PowerShell 프로필 래퍼를 통해 `codex`/`claude` 실행 시 아래 문서를 자동 주입합니다.
- `AGENT_TEAMS.md`
- `CLAUDE.md`
- `CLI_DOCKER_TESTING.md`
- 프로필 경로: `C:\Users\patte\OneDrive\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`
- 현재 셸 즉시 반영: `. $PROFILE`

---

## 최근 변경

- **Analytics 대시보드 전면 리디자인** - 커스텀 SVG 차트를 ResizeObserver 기반 인터랙티브 차트로 교체, 호버 툴팁/데이터 포인트 추가, 메트릭별 고유 색상 체계(Blue/Violet/Rose/Emerald/Amber), 기간 요약 사이드 패널(`PeriodSummary`) 추가
- **PowerShell 프로필 자동 주입 설정** - `codex`/`claude` 실행 시 MD 컨텍스트 자동 첨부
- **Analytics 대시보드 원복** - Recharts 기반 차트 제거, 오리지널 막대형 UI 복귀
- **방문자 기준 변경** - 순 방문자에서 중복 허용 방문자(`totals.visitors`)로 변경
- **CLI Docker 테스트 문서 추가** - `CLI_DOCKER_TESTING.md`
- **방문자/클릭 분석 기능 추가** - Postgres 기반 자체 분석, 운영자 대시보드 `/admin/analytics`
- **Xvfb 가상 디스플레이 적용** - 헤드리스 모드 대신 Xvfb 사용하여 비디오 재생 문제 해결
- **Backend 통합** - FastAPI + Selenium 클립 수집 서비스 추가
- **docker-compose 통합** - 루트 레벨에서 Frontend + Backend 함께 실행
- **공유 볼륨 설정** - shared_clips 볼륨으로 클립 파일 공유
- **ScheduleModal 추가** - 전체 일정 보기 버튼 클릭 시 캘린더 형식 Modal 표시
- **코드베이스 정리** - 미사용 파일 11개 삭제, 518줄 dead code 제거
- **2열 숏폼 레이아웃** - 치지직 클립 + YouTube Shorts를 나란히 표시
- **숏폼 클립 뷰어** - ClipsViewer를 틱톡/릴스 스타일로 재작성 (9:16, 스와이프, 키보드)
- **CI/CD 구축** - GitHub Actions 자동 배포 (무중단 배포)

## 2026-02-02 작업 요약 (중요 변경)

### 1) Git 저장소 구조 승격
- **루트 디렉터리가 Git 저장소**가 되도록 승격했습니다.
- 기존 **frontend 저장소 히스토리 유지**를 위해 subtree 방식으로 통합했습니다.
- 기본 브랜치는 `main`으로 통일했습니다.

### 2) CI/CD 경로 조정
- GitHub Actions 워크플로우를 루트 `.github/workflows`로 이동했습니다.
- CI/CD에서 **frontend 디렉터리를 작업 디렉터리로 사용**합니다.
- CD 배포 스크립트 경로: `./frontend/deploy.sh --clean`

### 3) 클립 렌더링 정책
- 운영 서버에 클립 수집 기능이 없으므로 **클립 파일을 Git에 포함**합니다.
- 클립 파일 위치: `frontend/public/clips/`
- 한글/공백 파일명이 있어도 안전하도록 **클립 URL 인코딩**을 적용했습니다.

### 4) 치지직 클립 수집기 개선
- **ts 세그먼트 혼합 방지**(그룹화 후 최대 그룹만 사용)
- **세그먼트 유입 중지 감지**(idle 기반 대기)
- **ts concat 병합 다운로드** 및 최소 세그먼트/길이 검증 옵션 추가

### 5) Claude 모델 확인 방법
- `.claude/agents/*.md`에 각 에이전트의 **모델**이 명시되어 있습니다.
- 본 문서의 **"Claude Code 에이전트"** 섹션에서 **모델 표**를 확인할 수 있습니다.

## 2026-02-03 작업 요약 (Analytics 기능)

### 1) 방문자/클릭 분석 시스템
- **Postgres 기반 자체 분석** - 외부 서비스 없이 직접 이벤트 수집
- **이벤트 종류**: 페이지뷰(`pageview`), 메뉴 클릭(`header_menu`)
- **세션 관리**: UUID 기반 세션, IP/User-Agent 저장
- **재방문자 집계**: 30일 기준

### 2) 운영자 대시보드
- **경로**: `/admin/analytics`
- **접근**: 별도 인증 없이 접근 가능

### 3) 공개 모드
- (제거됨) 통계 API 인증/공개 모드 관련 설정은 더 이상 사용하지 않음

### 4) 인프라 변경
- **analytics-db 서비스 추가** - PostgreSQL 16 Alpine 컨테이너
- **스키마 자동 생성** - `analytics_sessions`, `analytics_events` 테이블
- **Fallback DB URL** - `ANALYTICS_DATABASE_URL` 미설정 시 기본 Docker 컨테이너 연결

## 2026-02-05 작업 요약 (Analytics 대시보드 개선)

### 1) Recharts 기반 꺾은선 그래프
- **recharts 패키지 추가** - `npm install recharts`
- **일별 트래픽 추이 그래프** - 막대 그래프 → 꺾은선 그래프로 변경
- **3개 라인 표시**: 순 방문자(보라), 페이지뷰(파랑), 메뉴 클릭(핑크)
- **반응형 컨테이너** - `ResponsiveContainer` 적용

### 2) 섹션 뷰 추적 기능
- **`section_view` 이벤트 타입 추가** - `track.ts`에 새 이벤트 타입
- **`useSectionView` 훅 생성** - Intersection Observer 기반, 50% 가시성 threshold
- **`SectionTracker` 래퍼 컴포넌트** - 클라이언트 컴포넌트로 섹션 뷰 추적
- **세션당 1회 추적** - 중복 이벤트 방지 (모듈 레벨 Set 사용)

### 3) API 수정
- **`/api/analytics/stats`에 새 필드 추가**:
  - `daily[].uniqueVisitors` - 일별 고유 방문자 수 (COUNT DISTINCT ip)
  - `sectionViews` - 섹션별 조회 수 배열

### 4) 대시보드 UI 변경
- **"일별 트래픽 추이"** - Recharts LineChart 컴포넌트
- **"섹션별 조회 수"** - Recharts BarChart (가로 막대)
- **섹션 한글 라벨 매핑** - `SECTION_LABELS` 상수

### 5) 추적 대상 섹션 (7개)
| 섹션 ID | 한글 라벨 |
|---------|----------|
| `featured-latest` | 최신 영상 |
| `featured-top` | 인기 영상 |
| `clips-section` | 숏폼 하이라이트 |
| `schedule-section` | 방송 일정 |
| `youtube-official` | 공식 유튜브 |
| `youtube-full` | 다시보기 |
| `youtube-fan` | 팬 영상 |

### 6) 수정/생성된 파일

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/package.json` | recharts 의존성 추가 |
| `frontend/app/components/analytics/track.ts` | `section_view` 이벤트 타입 추가 |
| `frontend/app/hooks/useSectionView.ts` | **신규** - Intersection Observer 훅 |
| `frontend/app/components/analytics/SectionTracker.tsx` | **신규** - 섹션 추적 래퍼 |
| `frontend/app/api/analytics/stats/route.ts` | uniqueVisitors, sectionViews 추가 |
| `frontend/app/admin/analytics/page.tsx` | Recharts 그래프 적용 |
| `frontend/app/page.tsx` | SectionTracker 래퍼 적용 |

---

## 테스팅 가이드

코드 변경 후 반드시 아래 절차를 수행하여 정상 동작을 확인해야 합니다.

### 1) 코드 검증 (로컬)

```bash
cd frontend

# TypeScript 타입 체크
npx tsc --noEmit

# ESLint 검사
npm run lint
```

### 2) Docker 컨테이너 빌드 및 재시작

```bash
cd witchs-cauldron  # 프로젝트 루트

# 프론트엔드 재빌드
docker compose -f docker-compose.prod.yml build frontend

# 컨테이너 재시작 (환경변수 적용)
docker compose -f docker-compose.prod.yml up -d --force-recreate frontend

# 헬스체크 대기 (약 10초)
```

### 3) API 엔드포인트 검증

```bash
# 헬스체크
curl http://localhost:3000/api/health

# YouTube API (YOUTUBE_API_KEY 필요)
curl http://localhost:3000/api/youTubePlayer
curl http://localhost:3000/api/youTubePlayer/topOfficial
curl http://localhost:3000/api/youtubeShorts

# Analytics API
curl http://localhost:3000/api/analytics/stats
```

### 4) 사이트 직접 방문 테스트

브라우저에서 아래 URL에 직접 접속하여 확인:

| URL | 확인 사항 |
|-----|----------|
| http://localhost:3000 | 메인 페이지 정상 렌더링, YouTube 영상 표시 |
| http://localhost:3000/admin/analytics | 대시보드 로드, Recharts 그래프 표시 |

**메인 페이지 확인 항목**:
- [ ] Hero 섹션 (프로필, 치지직 라이브 상태)
- [ ] 최신 영상 / 인기 영상 카드
- [ ] 숏폼 하이라이트 섹션
- [ ] 방송 일정 섹션
- [ ] YouTube 공식/다시보기/팬 영상 섹션

**Analytics 대시보드 확인 항목**:
- [ ] 총계 카드 4개 (순 방문자, 재방문, 페이지뷰, 메뉴 클릭)
- [ ] 일별 트래픽 추이 꺾은선 그래프
- [ ] 섹션별 조회 수 가로 막대 그래프
- [ ] 메뉴 클릭 TOP 10

### 5) 컨테이너 로그 확인

```bash
# 최근 로그에서 오류 확인
docker compose -f docker-compose.prod.yml logs frontend --tail 50 | grep -i "error"

# 실시간 로그 모니터링
docker compose -f docker-compose.prod.yml logs -f frontend
```

### 6) 환경 변수 체크리스트

`.env` 파일에 아래 환경 변수가 설정되어 있는지 확인:

```bash
# 필수
YOUTUBE_API_KEY=your_youtube_api_key

# Analytics 기능
ANALYTICS_DATABASE_URL=postgres://analytics:analytics@analytics-db:5432/analytics
```

### 7) 문제 발생 시 체크리스트

| 증상 | 원인 | 해결 방법 |
|------|------|----------|
| YouTube 콘텐츠 미표시 | `YOUTUBE_API_KEY` 미설정 | `.env`에 API 키 추가 후 컨테이너 재시작 |
| 빌드 실패 (SWC) | Node.js 버전 불일치 | Docker 환경에서 빌드 (Node.js 22) |
| 컴포넌트 렌더링 안됨 | 환경변수 미적용 | `--force-recreate` 옵션으로 컨테이너 재생성 |
