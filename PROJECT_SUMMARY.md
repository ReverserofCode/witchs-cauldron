# Witch's Cauldron (마녀의 포션 공방) - 프로젝트 요약

## 1. 프로젝트 개요

한국 VTuber **"모잉(Moing)"** 팬 커뮤니티 웹사이트입니다. 실시간 방송 정보, 유튜브 콘텐츠, 치지직 라이브 상태, 팬아트 갤러리 등을 종합적으로 제공합니다.

---

## 2. 디렉터리 구조

```
witchs-cauldron/
├── frontend/                    # Next.js 14 메인 애플리케이션
│   ├── app/
│   │   ├── api/                 # API 라우트 (SSR/ISR)
│   │   │   ├── health/          # 헬스체크 엔드포인트
│   │   │   ├── broadCastSchedule/ # 방송 일정 (Google Sheets)
│   │   │   ├── chzzkPlayer/     # 치지직 라이브 상태
│   │   │   ├── youTubePlayer/   # 유튜브 비디오
│   │   │   ├── youtubeShorts/   # 유튜브 쇼츠
│   │   │   └── analytics/       # 방문자/클릭 통계 (Postgres)
│   │   ├── components/          # React 컴포넌트
│   │   │   ├── cards/           # 카드 컴포넌트
│   │   │   ├── gallery/         # 팬아트 갤러리
│   │   │   ├── modals/          # 모달 (React Portal)
│   │   │   ├── layout/          # 레이아웃 (Header, Footer, Sidebar)
│   │   │   ├── analytics/       # 분석 추적 유틸
│   │   │   ├── sections/        # 콘텐츠 섹션
│   │   │   └── status/          # 상태 표시
│   │   ├── hooks/               # 커스텀 React 훅
│   │   ├── admin/               # 운영자 전용 페이지
│   │   ├── layout.tsx           # 루트 레이아웃
│   │   ├── page.tsx             # 홈페이지
│   │   └── globals.css          # 전역 스타일
│   ├── public/                  # 정적 자원
│   │   ├── clips/               # 치지직 클립 영상
│   │   ├── mainPage/            # 프로필 이미지
│   │   └── rightAside/          # 팬아트 이미지
│   ├── .claude/agents/          # Claude Code 에이전트 설정
│   └── [설정 파일들]
├── chizzkData/                  # Python 클립 수집 유틸리티
│   ├── ShortForm.py             # 메인 스크립트 (630줄)
│   ├── requirements.txt
│   └── clips/                   # 다운로드 저장소
└── backend/                     # (미사용 플레이스홀더)
```

---

## 3. 기술 스택

### Frontend
| 분류 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Next.js | 14.2.5 |
| 언어 | TypeScript | 5.9.2 |
| UI | React | 18.3.1 |
| 스타일링 | Tailwind CSS | 4.1.13 |
| 런타임 | Node.js | 22 (Alpine) |
| 배포 | Docker | Multi-stage |

### Python 유틸리티
| 라이브러리 | 용도 |
|------------|------|
| Selenium | 브라우저 자동화 |
| BeautifulSoup4 | HTML 파싱 |
| Requests | HTTP 요청 |

### 외부 API
- **YouTube Data API v3**: 비디오 메타데이터
- **치지직 API**: 실시간 방송 상태
- **Google Sheets**: 방송 일정 (CSV)
- **Postgres**: 방문자/메뉴 클릭 통계 저장

---

## 4. 주요 파일

### 핵심 애플리케이션
| 파일 | 역할 |
|------|------|
| `app/layout.tsx` | 루트 레이아웃, SEO 메타데이터 |
| `app/page.tsx` | 홈페이지 (3컬럼 그리드) |
| `app/globals.css` | 전역 스타일, CSS 변수 |

### API 라우트
| 파일 | 기능 |
|------|------|
| `api/health/route.ts` | Docker 헬스체크 |
| `api/broadCastSchedule/schedule.tsx` | 방송 일정 파싱 (1,167줄) |
| `api/chzzkPlayer/chzzkPlayer.ts` | 치지직 라이브 상태 |
| `api/youTubePlayer/route.ts` | 최신 유튜브 영상 |
| `api/analytics/track/route.ts` | 페이지뷰/메뉴 클릭 수집 |
| `api/analytics/stats/route.ts` | 운영자 통계 집계 |

### 컴포넌트
| 파일 | 기능 |
|------|------|
| `components/cards/SectionCard.tsx` | 재사용 카드 (tone 시스템) |
| `components/gallery/FanArtGallery.tsx` | 팬아트 갤러리 |
| `components/modals/FanArtModal.tsx` | 풀스크린 이미지 모달 |

---

## 5. 주요 기능

### 홈페이지
- **히어로 섹션**: 치지직 실시간 상태, 프로필 아바타
- **피처드 카드**: 최신/인기 유튜브 영상
- **콘텐츠 섹션**: 클립, 방송 일정, 유튜브 카테고리별 영상
- **사이드바**: 일정 스냅샷, 커뮤니티 링크, 팬아트 갤러리

### 운영자 통계
- `/admin/analytics` 운영자 전용 대시보드
- 메뉴 클릭/페이지뷰/재방문(30일 기준) 집계

### 갤러리
- `public/rightAside/` 이미지 자동 감지
- 클릭 시 모달 확대 (키보드 내비게이션 지원)

### API
- ISR 캐싱 (YouTube 60초, 일정 180초)
- 디버그 쿼리 파라미터 지원 (`?debug=1`)

---

## 6. 엔트리 포인트

### 웹 애플리케이션
| 경로 | 설명 |
|------|------|
| `/` | 메인 홈페이지 |
| `/api/health` | 헬스체크 |
| `/api/broadCastSchedule` | 방송 일정 |
| `/api/chzzkPlayer` | 치지직 상태 |
| `/api/youTubePlayer` | 유튜브 영상 |
| `/api/analytics/track` | 방문자/클릭 이벤트 수집 |
| `/api/analytics/stats` | 운영자 통계 조회 |

### Docker
```bash
# 개발
docker-compose up -d

# 프로덕션
docker-compose -f docker-compose.prod.yml up -d
```

### Python
```bash
cd chizzkData
python ShortForm.py
```

---

## 7. 설정 파일

| 파일 | 용도 |
|------|------|
| `next.config.js` | Next.js 설정 (Standalone 출력) |
| `tsconfig.json` | TypeScript 설정 (strict 모드) |
| `tailwind.config.js` | Tailwind 커스텀 색상 |
| `Dockerfile` | 3단계 프로덕션 빌드 |
| `.env` | 환경 변수 (YOUTUBE_API_KEY 등) |

### 환경 변수
```env
YOUTUBE_API_KEY=<필수>
BROADCAST_SCHEDULE_CSV_URL=<선택>
ANALYTICS_DATABASE_URL=<필수>
ADMIN_ALLOWED_EMAILS=<필수>
NEXT_TELEMETRY_DISABLED=1
```

---

## 8. 아키텍처 패턴

### 컴포넌트 구조
- 관심사별 모듈 분리 (cards, layout, sections, modals)
- `"use client"` 지시문으로 클라이언트 컴포넌트 명시

### 캐싱 전략
- **서버**: ISR (Incremental Static Regeneration)
- **클라이언트**: 5분 TTL + 중복 제거 훅

### 반응형 디자인
- Mobile-first Tailwind 접근
- lg 브레이크포인트에서 3컬럼 그리드

### 색상 토큰 (Moing 테마)
```css
--moing-primary: #A020F0  /* 바이브런트 퍼플 */
--moing-accent: #ADD8E6   /* 라이트 스카이 */
--moing-deep: #191970     /* 미드나잇 딥 */
```

---

## 9. Claude Code 에이전트

`.claude/agents/`에 8개 전문 에이전트 설정:
- `code-generator.md` - 코드 생성/수정
- `code-tester.md` - 테스트 및 빌드 검증
- `code-validator.md` - 코드 리뷰
- `codebase-structure-analyzer.md` - 아키텍처 분석
- `orchestrator-planner.md` - 멀티 에이전트 조율
- `requirements-analyzer.md` - 요구사항 분석
- `token-optimizer.md` - 토큰 최적화

---

## 10. 문서

| 파일 | 내용 |
|------|------|
| `README.md` | 프로젝트 메인 문서 |
| `CLAUDE.md` | Claude Code 컨텍스트 가이드 |
| `MAINTENANCE.md` | 운영 및 유지보수 |
| `DEPLOYMENT.md` | 배포 가이드 |
| `CICD_SETUP.md` | CI/CD 설정 |

---

---

## 11. 최근 변경 (2026-02-03)

### 방문자/클릭 분석 기능
- **Postgres 기반 자체 분석** - 외부 서비스 없이 직접 이벤트 수집
- **운영자 대시보드**: `/admin/analytics`
- **이벤트 종류**: 페이지뷰(`pageview`), 메뉴 클릭(`header_menu`)
- **재방문자 집계**: 30일 기준
- **공개 모드**: `ANALYTICS_PUBLIC=true` 설정 시 인증 없이 통계 공개

### 인프라 변경
- **analytics-db 서비스 추가** - PostgreSQL 16 Alpine 컨테이너
- **스키마 자동 생성** - `analytics_sessions`, `analytics_events` 테이블

---

*최종 수정일: 2026-02-03*
