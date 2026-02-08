# CLI Docker Testing Guide

CLI 모델이 코드 변경 후 빠르게 검증할 수 있도록, 이 저장소 기준 Docker 테스트 절차를 정리합니다.

## 1) 스택 실행

프로젝트 루트에서 실행합니다.

```bash
docker compose up -d --build
docker compose ps
```

정상 상태 확인:
- `frontend`, `backend`, `analytics-db`가 `Up` 상태
- 프론트 접속: `http://localhost:3000`

## 2) 정적 검증 (프론트 컨테이너 내부)

```bash
docker exec -it witchs-cauldron-frontend npx tsc --noEmit
docker exec -it witchs-cauldron-frontend npm run lint
docker exec -it witchs-cauldron-frontend npm run build
```

## 3) Analytics API 스모크 테스트

먼저 이벤트를 1건 적재합니다.

```bash
curl.exe -i -X POST http://localhost:3000/api/analytics/track -H "Content-Type: application/json" -d "{\"type\":\"pageview\",\"path\":\"/admin/analytics\",\"referrer\":\"cli-test\"}"
```

통계 조회:

```bash
curl.exe -i http://localhost:3000/api/analytics/stats
```

확인 포인트:
- 응답 `totals.visitors`가 0 이상이고 숫자 타입
- 응답 `totals.menuClicks`, `daily[]`, `topMenuClicks[]`가 정상 JSON 구조

## 4) 로그 확인

```bash
docker compose logs --tail=200 frontend
docker compose logs --tail=200 backend
docker compose logs --tail=200 analytics-db
```

## 5) 정리

```bash
docker compose down
```

데이터까지 정리하려면:

```bash
docker compose down -v
```
