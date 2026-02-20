# Witchs Cauldron

버튜버 **모잉(Moing)** 팬 커뮤니티 웹사이트입니다.

방송 스케줄, YouTube 콘텐츠, 치지직 라이브 상태, 팬아트 갤러리, 숏폼 하이라이트, 클립 자동 수집, 방문자 분석 기능을 제공합니다.

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 | 14.2.5 |
| Backend | FastAPI, Selenium, Chromium + Xvfb | 0.115.6 |
| Database | PostgreSQL (분석용) | 16 |
| Infra | Docker (multi-stage), GitHub Actions CI/CD | - |

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend      │     │    Backend       │     │  Analytics DB   │
│   (Next.js)      │     │   (FastAPI)      │     │  (PostgreSQL)   │
│   Port: 3000     │     │   Port: 8000     │     │   Port: 5432    │
└────────┬─────────┘     └────────┬─────────┘     └────────▲────────┘
         │  shared_clips 볼륨     │                        │
         └───────────┬────────────┘       Analytics API    │
                     │                                     │
              ┌──────▼──────┐        Frontend ─────────────┘
              │  Clips (MP4) │
              └──────────────┘
```

## 주요 기능

- **방송 스케줄** - Google Sheets 연동 캘린더
- **치지직 라이브** - 실시간 방송 상태 표시
- **YouTube 콘텐츠** - 공식/다시보기/팬 채널 최신/인기 영상
- **YouTube Shorts** - 공식 채널 Shorts 자동 필터링
- **숏폼 하이라이트** - 치지직 클립 + YouTube Shorts 2열 뷰어
- **팬아트 갤러리** - 이미지 자동 스캔, 모달 상세 보기
- **클립 자동 수집** - Selenium 기반 치지직 클립 다운로드
- **방문자 분석** - PostgreSQL 기반 자체 분석 대시보드

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

# Frontend만 로컬
cd frontend && npm run dev

# Backend만 로컬
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

## 환경 변수

```bash
# .env (루트)

# 필수
YOUTUBE_API_KEY=your_youtube_api_key

# 분석 기능 (선택)
ANALYTICS_DATABASE_URL=postgres://analytics:analytics@analytics-db:5432/analytics
```

## 프로젝트 구조

```
witchs-cauldron/
├── frontend/          # Next.js 프론트엔드
│   ├── app/
│   │   ├── api/       # API Routes (방송일정, YouTube, 치지직, Analytics)
│   │   ├── admin/     # 운영자 대시보드
│   │   ├── components/
│   │   │   ├── cards/      # 카드 컴포넌트
│   │   │   ├── gallery/    # 팬아트 갤러리
│   │   │   ├── modals/     # FanArtModal, ScheduleModal
│   │   │   ├── layout/     # Header, Footer, Sidebars
│   │   │   └── sections/   # 메인 콘텐츠 섹션
│   │   └── hooks/     # useYouTubeVideos, useSectionView
│   └── public/        # 정적 자산 (프로필, 팬아트, 클립)
│
├── backend/           # FastAPI 백엔드 (클립 수집)
│   └── app/
│       ├── api/       # REST API (clips, jobs, health)
│       └── services/  # Selenium 클립 수집기
│
├── chizzkData/        # 로컬 클립 수집 유틸리티
│
├── .github/workflows/ # CI/CD (ci.yml, cd.yml)
└── docker-compose*.yml
```

## API 엔드포인트

### Frontend (Next.js)

| 엔드포인트 | 목적 |
|------------|------|
| `/api/health` | Docker 헬스체크 |
| `/api/broadCastSchedule` | 방송 일정 (Google Sheets) |
| `/api/chzzkPlayer` | 치지직 라이브 상태 |
| `/api/youTubePlayer` | 최신 YouTube 영상 |
| `/api/youTubePlayer/topOfficial` | 월간 인기 영상 |
| `/api/youtubeShorts` | YouTube Shorts |
| `/api/analytics/track` | 이벤트 수집 |
| `/api/analytics/stats` | 통계 조회 |
| `/admin/analytics` | 분석 대시보드 |

### Backend (FastAPI)

| Method | 엔드포인트 | 목적 |
|--------|------------|------|
| GET | `/api/clips` | 클립 목록 |
| POST | `/api/clips/collect` | 클립 수집 트리거 |
| GET | `/api/jobs/{job_id}` | 수집 작업 상태 |

## CI/CD

- **CI**: PR 생성 시 TypeScript 타입 체크 + ESLint + Docker 빌드 검증
- **CD**: `main` 브랜치 push 시 자동 배포 (무중단 배포)

## 라이선스

이 프로젝트는 개인 팬 프로젝트로 제작되었습니다.
