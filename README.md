# Witchs Cauldron (마녀의 포션 공방)

모잉(Moing) 팬 커뮤니티 웹사이트입니다. 방송 일정, 유튜브 콘텐츠, 치지직 라이브 상태, 팬아트 갤러리, 하이라이트 클립을 제공합니다.

## 저장소 구조

- `frontend/` Next.js 14 프론트엔드
- `backend/` FastAPI + Selenium 클립 수집 서비스
- `chizzkData/` 로컬 클립 수집 유틸리티

## 방문자/클릭 분석

- Postgres 기반 자체 수집이며, 운영자 전용 대시보드는 `/admin/analytics`에서 확인합니다.
- 자세한 설정은 `frontend/README.md`의 **방문자/클릭 분석** 섹션을 참고하세요.
- 로컬 개발용으로 `docker-compose.yml`에 `analytics-db`(Postgres) 컨테이너가 포함됩니다.

## 클립 운영 정책

- 운영 서버에는 클립 수집 기능이 없으므로 **클립 파일을 Git에 포함**합니다.
- 프론트가 읽는 경로: `frontend/public/clips/`

## CI/CD (루트 기준)

- 워크플로우: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
- 작업 디렉터리: `frontend/`
- 배포 스크립트: `frontend/deploy.sh`

## 문서

- `frontend/README.md` 프론트엔드 운영/개발 가이드
- `backend/README.md` 백엔드 사용법
- `chizzkData/README.md` 로컬 클립 수집기 사용법
