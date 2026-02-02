# Backend 클립 수집 실패 기록

## 핵심 발견사항

### 원본 코드 (ShortForm.py) 분석

**성공하는 원본 코드의 URL 필터 조건 (라인 354-368):**
```python
# 조건 1: 파일 확장자 또는 mimeType 확인
if (
    any(ext in url.lower() for ext in [".mp4", ".webm", ".m4v"])
    or "video" in mime_type.lower()
):
    # 조건 2: 치지직/네이버 도메인 확인
    if (
        "naver-vod.pstatic.net" in url
        or "chzzk" in url
        or "glive-clip" in url
    ):
        # 조건 3: URL 길이 및 쿼리스트링 확인
        if len(url) < 1000 and "?" in url:
            media_urls.add(url)
```

**원본 코드의 중요한 특징:**
1. `Network.responseReceived` 이벤트만 확인 (requestWillBeSent 아님)
2. **헤드리스 모드 비활성화** - `--headless` 옵션이 주석 처리됨 (라인 183)
3. 5초 대기 후 네트워크 로그 수집
4. 매우 엄격한 도메인 필터: `naver-vod.pstatic.net`, `chzzk`, `glive-clip`

---

## 실패 기록

### 시도 1: 기본 포팅
- **날짜**: 2026-02-01
- **문제**: 미디어 URL을 전혀 찾지 못함
- **원인**: 헤드리스 모드에서 비디오가 제대로 로드되지 않음
- **결과**: 0개 클립 수집

### 시도 2: URL 필터 확장
- **날짜**: 2026-02-01
- **변경사항**:
  - `Network.requestWillBeSent` 이벤트 추가
  - 도메인 패턴 확장 (pstatic.net, naver.com 등)
  - 비디오 관련 경로 패턴 추가 (/clip/, /vod/, hls, dash 등)
- **문제**: 너무 많은 비-비디오 URL 캡처 (CSS, JS, API 엔드포인트)
- **결과**: 다운로드된 파일이 실제 비디오가 아님 (640KB, 203KB - HLS 세그먼트)

### 시도 3: ffmpeg HLS 다운로드 추가
- **날짜**: 2026-02-01
- **변경사항**:
  - Dockerfile에 ffmpeg 추가
  - m3u8 URL 우선 처리
  - ffmpeg로 HLS 스트림 다운로드
- **문제**: m3u8 URL을 찾지 못함, 여전히 비-비디오 URL만 캡처
- **결과**: 18KB 파일 다운로드 (비디오 아님)

---

## 근본 원인 분석

### 1. 헤드리스 모드 문제
- 원본 코드는 **GUI 브라우저**로 실행됨
- 헤드리스 모드에서는 비디오 플레이어가 완전히 초기화되지 않을 수 있음
- 비디오가 재생되지 않으면 실제 미디어 URL이 네트워크 로그에 나타나지 않음

### 2. 필터 로직 차이
- 원본: 매우 엄격한 3단계 필터
- 수정본: 너무 느슨한 필터로 비-비디오 URL 캡처

### 3. 실제 비디오 URL 패턴
이전 성공 로그에서 확인된 실제 비디오 URL:
```
https://b02-kr-smp-vod.pstatic.net/glive-clip/c/read/v2/VOD_ALPHA/glive-clip_2025_07_01_2717/hls/748...
```
- 도메인: `b02-kr-smp-vod.pstatic.net`
- 경로: `/glive-clip/`
- 형식: HLS 세그먼트 (.ts)

---

## 해결 방안

### 옵션 1: 원본 로직 정확히 복원 (권장)
- 원본 코드의 필터 조건 그대로 사용
- 헤드리스 모드 비활성화 시도 (Docker에서 Xvfb 사용)

### 옵션 2: Chzzk API 직접 사용
- 클립 상세 API에서 videoId 획득
- Naver Video API에서 실제 스트리밍 URL 획득
- 인증 키 문제 해결 필요

### 옵션 3: yt-dlp 사용
- yt-dlp가 치지직 클립 다운로드 지원하는지 확인
- 지원한다면 가장 간단한 해결책

---

## 해결 적용 (2026-02-02)

### 적용된 해결책: Xvfb 가상 디스플레이

**변경 사항:**

1. **Dockerfile**:
   - `xvfb`, `x11-utils` 패키지 설치
   - `DISPLAY=:99` 환경변수 설정
   - CMD에서 Xvfb 시작 후 uvicorn 실행

2. **config.py**:
   - `headless: bool = False` (비활성화)
   - `use_xvfb: bool = True` (추가)

3. **selenium_driver.py**:
   - Xvfb 환경 설명 주석 추가
   - `--autoplay-policy=no-user-gesture-required` 옵션 추가
   - Xvfb 사용 시 헤드리스 모드 비활성화

4. **clip_collector.py**:
   - 비디오 재생 트리거 강화 (대기 시간 증가, 에러 핸들링 개선)

**예상 결과:**
- Xvfb가 가상 X11 디스플레이를 제공
- Chrome이 GUI 모드로 실행되어 비디오 플레이어가 완전히 초기화됨
- 네트워크 로그에 실제 미디어 URL이 나타남

**테스트 방법:**
```bash
# Docker 빌드 및 실행
docker-compose up -d --build

# 클립 수집 테스트
curl -X POST http://localhost:8000/api/clips/collect \
  -H "Content-Type: application/json" \
  -d '{"max_clips": 1}'

# 로그 확인
docker-compose logs -f backend
```

---

## 시도 4: Xvfb 가상 디스플레이 (2026-02-02)

### 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `Dockerfile` | xvfb, x11-utils 설치, `/tmp/.X11-unix` 디렉토리 생성, `DISPLAY=:99` |
| `config.py` | `headless=False`, `use_xvfb=True` 기본값 |
| `selenium_driver.py` | Xvfb 환경 지원, `--autoplay-policy=no-user-gesture-required` 추가 |
| `clip_collector.py` | 비디오 대기 시간 증가 (5초→8초), WebDriverWait으로 명시적 대기 추가 |
| `docker-compose.yml` | `shm_size: 2gb` 추가, `HEADLESS=false`, `USE_XVFB=true` |
| `docker-compose.prod.yml` | 동일한 설정 적용 |

### 테스트 결과

**빌드**: 성공
- Xvfb, x11-utils 설치 완료
- `/tmp/.X11-unix` 디렉토리 생성으로 X11 소켓 에러 해결

**실행**: 부분 성공
- Xvfb가 정상 시작됨 (X11 에러 없음)
- uvicorn 서버 정상 실행
- Health check 통과

**클립 수집**: 실패
```
=== Chzzk Clip Collection Started ===
Accessing clips page: https://chzzk.naver.com/.../clips?filterType=ALL&orderType=POPULAR
Found 24 clip links                    ✓ 클립 목록 추출 성공

[1/1] Processing: 잘 썼어요
Analyzing clip: https://chzzk.naver.com/clips/Q4ea7NSJKM
Waiting for video element to load...
Video element not found after waiting   ✗ 비디오 요소 없음
Page title: 치지직 - CHZZK              ✓ 페이지 로드됨
Current URL: https://chzzk.naver.com/clips/Q4ea7NSJKM  ✓ URL 정상

No valid media URLs found              ✗ 미디어 URL 캡처 실패
Potentially relevant URLs:
  - text/css: ...desktop-media-viewer.css
  - text/javascript: ...main.fe997e82.js
  - application/json: ...strings-ko_kr.json
  (CSS, JS, JSON만 캡처됨 - 비디오 관련 URL 없음)

Collected: 0/1
```

### 분석

**성공한 부분:**
1. Xvfb 가상 디스플레이 정상 작동
2. Chrome 브라우저 시작 및 페이지 접속
3. 클립 목록 페이지에서 24개 클립 링크 추출
4. 클립 상세 페이지 URL 접속

**실패한 부분:**
1. 클립 상세 페이지에서 `<video>` 요소를 찾지 못함
2. 네트워크 로그에 비디오 관련 URL이 캡처되지 않음
3. 페이지의 JavaScript가 완전히 실행되지 않은 것으로 추정

### 근본 원인 추정

1. **React/SPA 렌더링 지연**: 치지직은 React 기반 SPA로, 비디오 플레이어가 동적으로 로드됨
2. **JavaScript 실행 환경**: Xvfb에서 Chrome이 실행되지만, 특정 미디어 API가 제한될 수 있음
3. **DRM/보안 정책**: 치지직이 자동 재생을 차단하거나 특정 환경에서 비디오 로딩을 거부할 수 있음

---

## 다음 단계: yt-dlp 방식 전환

### 권장 해결책

Selenium 기반 접근 대신 **yt-dlp**를 사용하는 것이 더 안정적임.

### 확인 필요 사항

```bash
# yt-dlp 설치
docker exec witchs-cauldron-backend pip install yt-dlp

# 치지직 지원 여부 확인
docker exec witchs-cauldron-backend yt-dlp --list-extractors | grep -i chzzk

# 클립 다운로드 테스트
docker exec witchs-cauldron-backend yt-dlp "https://chzzk.naver.com/clips/Q4ea7NSJKM" --list-formats
```

### yt-dlp 지원 시 구현 계획

1. `requirements.txt`에 `yt-dlp` 추가
2. `clip_collector.py`에 yt-dlp 기반 다운로드 로직 구현
3. Selenium은 클립 목록 추출에만 사용 (또는 API로 대체)
4. yt-dlp로 실제 클립 다운로드

### yt-dlp 미지원 시 대안

1. **Chzzk API 직접 호출**: 클립 상세 API → videoId → Naver VOD API
2. **Puppeteer/Playwright**: Selenium 대신 더 현대적인 브라우저 자동화 도구
3. **원본 코드 로컬 실행**: Docker 외부에서 GUI 브라우저로 수집 후 결과만 공유

---

## 수정된 파일 목록 (전체)

| 파일 | 상태 | 설명 |
|------|------|------|
| `backend/Dockerfile` | 수정됨 | Xvfb 설치, X11 소켓 디렉토리 생성 |
| `backend/app/config.py` | 수정됨 | headless=False, use_xvfb=True |
| `backend/app/core/selenium_driver.py` | 수정됨 | Xvfb 환경 지원, autoplay 정책 |
| `backend/app/services/clip_collector.py` | 수정됨 | 비디오 대기 로직 강화 |
| `backend/.env.example` | 수정됨 | 새 환경변수 문서화 |
| `docker-compose.yml` | 수정됨 | shm_size, 환경변수 |
| `docker-compose.prod.yml` | 수정됨 | 동일 |
| `CLAUDE.md` | 수정됨 | 기술스택, 환경변수, 최근변경 |
| `backend/FAILURE_LOG.md` | 수정됨 | 이 문서 |
