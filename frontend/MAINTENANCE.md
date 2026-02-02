# Witchs Cauldron - 운영/유지보수 매뉴얼

이 문서는 Ubuntu + Docker 환경에서 프론트엔드(Next.js 14, 컨테이너 이름 `witchs-cauldron-frontend-prod`)를 안정적으로 운영·유지보수하기 위한 체크리스트입니다. 포트 기본값은 3000이며 헬스체크는 루트 경로(`/`)와 `/api/health`를 기준으로 합니다.

## 1. 필수 준비물

- 환경 파일: `.env`
  - `YOUTUBE_API_KEY` (필수)
  - `BROADCAST_SCHEDULE_CSV_URL` (선택, 미설정 시 기본 내장 시트를 사용)
  - `ANALYTICS_DATABASE_URL` (운영자 통계용 Postgres, 필수)
  - `ADMIN_ALLOWED_EMAILS` (운영자 이메일 allowlist, 콤마 구분)
  - `ADMIN_ALLOW_NO_HEADER` (로컬 개발 임시 우회용, 운영에서 사용 금지)
  - `ANALYTICS_PUBLIC` (통계 공개 모드, 운영에서 사용 가능)
- 로그 및 관리 도구: `manage.sh` (start/stop/restart/status/logs/update/health/shell 제공)
- Docker Compose 파일: `docker-compose.prod.yml` (로그 로테이션, 리소스 한도 포함)
- 정적 자산: `public/rightAside`, `public/mainPage`, `public/broadcast-schedule.csv` (기본 일정 CSV)

## 2. 정기 점검 체크리스트

### 일일

- 서비스 헬스: `./manage.sh health` (또는 `curl -f http://localhost:3000/api/health`)
- 오류 로그 스캔: `./manage.sh logs-tail`

### 주간

- 상태/헬스: `./manage.sh status` (Health: healthy 확인)
- 리소스: `docker stats`, `df -h`, `free -h`
- API 키 만료/쿼터 확인: `docker exec witchs-cauldron-frontend-prod printenv | grep YOUTUBE`
 - 통계 DB 연결 확인: `docker exec witchs-cauldron-frontend-prod printenv | grep ANALYTICS_DATABASE_URL`

### 월간 (또는 배포 전/후)

- 전체 로그 점검: `./manage.sh logs --tail=300`
- 빌드 캐시 정리(필요 시): `docker builder prune -f`
- 디스크 확보(주의): `docker system prune -a` — 사용 중인 이미지가 삭제될 수 있으므로 중단 시간 확보 후 실행

## 3. 업데이트/배포 절차 (무중단 아님)

1. 코드 동기화: `git pull` 또는 새 릴리스 파일 반영
2. 환경 변수 확인: `.env`에서 `YOUTUBE_API_KEY`, `BROADCAST_SCHEDULE_CSV_URL`, `ANALYTICS_DATABASE_URL` 등을 최신 값으로 업데이트하고 백업(`cp .env .env.bak`)
3. 재배포: `./manage.sh update` (빌드 + 재생성). 캐시를 완전히 비우고 싶다면 `./deploy.sh --clean` 사용
4. 검증:
   - `./manage.sh status` (헬스체크 필드가 healthy 인지)
   - `./manage.sh health` 또는 브라우저로 `http://<호스트>:3000` 접속
   - 주요 API 확인: `/api/health`, `/api/broadCastSchedule?diagnostics=1`

## 4. 장애 대응 플로우

- **응답 없음/헬스 실패**
  - `./manage.sh status` → 컨테이너 실행 여부 확인
  - `./manage.sh logs-tail` → 에러 메시지 확인
  - 필요 시 `./manage.sh restart`
- **YouTube API 오류/쿼터 초과**
  - `YOUTUBE_API_KEY` 값 확인 및 교체 후 `./manage.sh restart`
- **운영자 통계 접근 불가**
  - `ADMIN_ALLOWED_EMAILS` 설정 및 인증 헤더 전달 여부 확인
  - `ANALYTICS_DATABASE_URL` 연결 확인 후 `./manage.sh restart`
- **방송 일정 비정상**
  - `BROADCAST_SCHEDULE_CSV_URL` 확인, 미설정 시 내장 `public/broadcast-schedule.csv`가 사용됨
  - `GET /api/broadCastSchedule?diagnostics=1`로 단계별 상태 확인
- **디스크 부족**
  - `df -h`로 확인 후 `docker system prune -a`, `docker builder prune -f` 수행 (서비스 중단 감수)

## 5. 로그/모니터링 요령

- 실시간 로그: `./manage.sh logs`
- 최근 로그: `./manage.sh logs-tail`
- Docker 로그는 기본적으로 json-file 드라이버로 10MB × 3 파일까지 로테이션됩니다 (`docker-compose.prod.yml` 참고)
- 리소스 모니터링: `docker stats`, `htop`, `iostat`

## 6. 백업/복구 포인트

- `.env` 파일 (API 키 포함) — 변경/회수 전 반드시 백업
- 정적 자산 디렉터리: `public/rightAside`, `public/mainPage`, `public/broadcast-schedule.csv`
- 코드베이스는 Git을 기준으로 관리하며, 문제가 발생하면 직전 릴리스 커밋으로 되돌린 뒤 `./manage.sh update`

## 7. 주의 사항

- 로컬에서 직접 `npm install`을 실행하지 말고 항상 컨테이너/스크립트 경로로 관리합니다.
- `./manage.sh clean`은 이미지/볼륨을 삭제하므로 다운타임이 발생합니다. 장애 복구 시에만 사용하세요.
- OneDrive 등 네트워크 드라이브 환경에서는 파일 변경 감지가 지연될 수 있습니다. 배포 서버에서는 로컬 디스크 사용을 권장합니다.
