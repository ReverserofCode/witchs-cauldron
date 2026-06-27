# 클립 수집 운영 런북

이 문서는 `witchs-cauldron` 운영 환경에서 치지직 클립 수집, 렌더링, 재생 가능 여부를 검증하는 절차를 정리한다.

## 구조 요약

- Backend(FastAPI)가 Selenium + Chromium + Xvfb로 치지직 클립 페이지를 탐색한다.
- 수집된 파일은 Docker named volume `shared_clips`의 `/app/shared/clips`에 저장된다.
- Frontend(Next.js)는 같은 볼륨을 `/app/public/clips`로 읽는다.
- `ClipsSection`은 최신 파일 기준 최대 10개만 렌더링한다.
- `/clips/[...filename]` 라우트가 파일을 직접 스트리밍하며 `Range` 요청을 지원한다.
- 운영 compose는 서버 안정성을 위해 백엔드 내부 APScheduler를 기본 비활성화한다.

## 정상 동작 기준

- `POST /api/clips/collect`가 job id를 반환한다.
- `GET /api/clips/jobs/{job_id}`가 `completed`와 `clips_collected <= 2`를 반환한다.
- 운영 페이지 HTML에 `/clips/*.mp4?v=<mtime>`가 10개 이하로 포함된다.
- 각 클립 URL이 `206 Partial Content`, `Content-Type: video/mp4`, `Accept-Ranges: bytes`를 반환한다.
- 파일 첫 32바이트에 `ftyp` 문자열이 포함된다.
- 브라우저에서 `<video>`의 `readyState >= 2`, `error = null`, `currentTime` 증가가 확인된다.

## 자동 갱신

자동 갱신은 서버 안정성을 위해 기본 비활성화한다.

- Backend 내부 APScheduler: 기본 비활성화. 명시적으로 켤 때만 주기 수집한다.
- GitHub Actions `Clip Refresh`: 정기 실행하지 않고, 수동 복구/검증 시에만 운영 API를 호출한다.

운영 compose(`docker-compose.prod.yml`, `docker-compose.server.yml`) 기본값:

```bash
MAX_CLIPS_PER_COLLECTION=2
COLLECTION_TIMEOUT=180
CLIP_AUTO_COLLECT_ENABLED=false
CLIP_AUTO_COLLECT_INTERVAL_MINUTES=720
CLIP_AUTO_COLLECT_RUN_ON_STARTUP=false
CLIP_AUTO_COLLECT_STARTUP_DELAY_SECONDS=60
CLIP_AUTO_COLLECT_MAX_CLIPS=1
CLIP_AUTO_COLLECT_FILTER_TYPE=ALL
CLIP_AUTO_COLLECT_ORDER_TYPE=RECENT
CLIP_AUTO_COLLECT_FAILURE_COOLDOWN_MINUTES=720
```

GitHub Actions 수동 실행:

- 파일: `.github/workflows/clip-refresh.yml`
- 주기: 없음 (`workflow_dispatch` only)
- 기본 대상: `https://moingfans.com`
- 수동 실행: GitHub Actions에서 `workflow_dispatch`

운영 인증:

```bash
COLLECT_API_KEY=<random-long-token>
CLIP_COLLECTION_REQUIRES_API_KEY=true
```

운영에서는 `COLLECT_API_KEY`가 없으면 수집 API가 거부된다. `/api/clips/collect`, `/api/clips/jobs/*`,
`/api/clips/automation` 호출에 같은 값을 `Authorization: Bearer <token>` 또는
`x-api-key: <token>`으로 보내야 한다. GitHub Actions에는 동일한 값을
`COLLECT_API_KEY` 또는 `CLIP_REFRESH_API_KEY` secret으로 등록한다.

대상 URL을 바꾸려면 repository variable `CLIP_REFRESH_BASE_URL`을 설정한다.

상태 확인:

```bash
curl https://moingfans.com/api/clips/automation
```

확인 항목:

- `enabled=false`, `running=false`
- `next_run_at`는 `null`
- 자동 수집을 명시적으로 켠 경우에도 `max_clips<=1`, `order_type=RECENT`
- 최근 실패 후에는 `failure_cooldown_until` 동안 자동 수집을 건너뛴다.
- `last_job_id`가 있으면 `GET /api/clips/jobs/{last_job_id}`로 완료 여부 확인
- 수동 수집이 실행 중이면 예약 실행은 `last_skip_reason=collection job already running`으로 스킵된다.

## 수집 실행

```bash
curl -X POST https://moingfans.com/api/clips/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <COLLECT_API_KEY>" \
  -d '{"max_clips":1,"filter_type":"ALL","order_type":"RECENT"}'
```

응답 예시:

```json
{
  "job_id": "2738ea2d",
  "message": "Collection started for 1 clips",
  "estimated_time": 35
}
```

## 작업 상태 확인

```bash
curl https://moingfans.com/api/clips/jobs/<job_id>
```

정상 예시:

```json
{
  "status": "completed",
  "progress": 100,
  "message": "Completed: 1 clips collected, 0 skipped(existing)",
  "clips_collected": 1,
  "clips_skipped": 0,
  "total_clips": 1,
  "error": null
}
```

실패 시 확인할 항목:

- `No clip links found`: 치지직 페이지 구조 변경 또는 Selenium 로딩 실패
- `No media URL found`: 비디오 플레이어 초기화 실패 또는 네트워크 로그 패턴 변경
- `Download failed`: 미디어 URL 만료, ffmpeg remux 실패, 볼륨 권한 문제

## HTTP 재생 검증

운영 페이지에서 클립 URL을 추출한 뒤 Range 요청을 보낸다.

```bash
curl -i -H "Range: bytes=0-31" "https://moingfans.com/clips/<filename>.mp4?v=<mtime>"
```

정상 조건:

- HTTP status: `206 Partial Content`
- `Content-Type: video/mp4`
- `Accept-Ranges: bytes`
- 본문 헤더에 `ftyp` 포함

비정상 예시:

- `404`: Frontend 동적 스트리밍 라우트 또는 `shared_clips` 볼륨 마운트 확인
- 첫 바이트가 `0x47`: TS 세그먼트가 `.mp4`로 저장된 상태. 재수집 필요
- `416`: Range 파싱 또는 파일 크기 문제

## 브라우저 재생 검증

Chrome/Playwright 기준 확인 항목:

- 치지직 클립 카운터가 `1 / 10`처럼 표시된다.
- 첫 `<video src*="/clips/">`의 `readyState`가 `2` 이상이다.
- `video.error`가 `null`이다.
- `play()` 이후 `currentTime`이 증가한다.

검증 스크립트 예시:

```js
const video = document.querySelector('video[src*="/clips/"]');
video.muted = true;
await video.play();
console.log({
  readyState: video.readyState,
  networkState: video.networkState,
  duration: video.duration,
  paused: video.paused,
  currentTime: video.currentTime,
  error: video.error,
});
```

## 배포 후 점검 순서

1. GitHub Actions CD 최신 run이 `success`인지 확인한다.
2. `https://moingfans.com/api/health`가 200인지 확인한다.
3. 클립 수집을 실행하고 job 완료를 기다린다.
4. 운영 페이지에 클립이 10개 이하로 렌더링되는지 확인한다.
5. 10개 클립의 Range/MP4 헤더를 확인한다.
6. 브라우저에서 실제 재생 상태를 확인한다.

## 관련 파일

- `backend/app/services/clip_collector.py`
- `backend/app/services/clip_scheduler.py`
- `backend/app/services/job_manager.py`
- `backend/docker-entrypoint.sh`
- `frontend/app/components/sections/ClipsSection.tsx`
- `frontend/app/components/sections/ClipsViewer.tsx`
- `frontend/app/clips/[...filename]/route.ts`
- `docker-compose.server.yml`
