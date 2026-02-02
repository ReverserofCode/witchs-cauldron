# 치지직 클립 수집기 (ChizzkData)

치지직(CHZZK) 플랫폼에서 특정 채널의 클립을 자동으로 수집하고 다운로드하는 Python 스크립트입니다.

## 🎯 주요 기능

- **자동 클립 수집**: 특정 치지직 채널의 클립을 자동으로 탐지하고 수집
- **미디어 파일 다운로드**: 브라우저 네트워크 로그를 분석하여 실제 비디오 파일 URL 추출 및 다운로드
- **필터링 옵션**: 인기순/최신순 정렬, 전체/주간/월간 필터 지원
- **자동 파일 관리**: 타임스탬프 기반 파일명 생성 및 중복 다운로드 방지
- **ts 세그먼트 병합**: m3u8이 보이지 않을 때 ts 세그먼트를 정렬·병합하여 전체 클립 저장

## 📋 요구사항

### 시스템 요구사항

- Python 3.9+
- Chrome 브라우저 설치
- Windows 10/11 (현재 Windows 환경에서 테스트됨)

### Python 라이브러리

```
selenium==4.36.0
beautifulsoup4==4.14.2
requests==2.32.5
webdriver-manager==4.0.2
```

## 🚀 설치 및 설정

### 1. Anaconda 가상환경 생성

```bash
# 가상환경 생성
conda create -n chizzk_clips python=3.9 -y

# 가상환경 활성화
conda activate chizzk_clips
```

### 2. 필요한 라이브러리 설치

```bash
pip install selenium beautifulsoup4 requests webdriver-manager
```

### 3. Chrome 브라우저 확인

- Chrome 브라우저가 설치되어 있어야 합니다
- ChromeDriver는 webdriver-manager가 자동으로 설치합니다

## 💻 사용법

### 기본 사용법

```python
python ShortForm.py
```

### 사용자 정의 설정

```python
from ShortForm import ChizzkClipCollector

# 클립 수집기 생성
collector = ChizzkClipCollector(
    channel_id="YOUR_CHANNEL_ID",  # 치지직 채널 ID
    download_dir="my_clips"        # 다운로드 폴더
)

# 클립 수집 실행
collector.collect_clips(
    max_clips=10,           # 최대 수집할 클립 수
    filter_type="ALL",      # 필터: ALL, WEEKLY, MONTHLY
    order_type="POPULAR"    # 정렬: POPULAR, RECENT
)
```

### 명령줄 옵션 (추천)

```bash
python ShortForm.py --max-clips 10 --order POPULAR --filter ALL \
  --idle-seconds 6 --max-wait-seconds 0 --min-segments 8 --min-duration 5
```

- `--idle-seconds`: 세그먼트 유입이 멈춘 것으로 간주하는 시간(초)
- `--max-wait-seconds`: 최대 대기 시간(초). `0`이면 제한 없음
- `--min-segments`: ts 세그먼트 최소 개수
- `--min-duration`: 최소 영상 길이(초)

## 📁 파일 구조

```
chizzkData/
├── ShortForm.py          # 메인 스크립트
├── test_setup.py         # 설정 테스트 스크립트
├── README.md            # 이 파일
└── clips/               # 다운로드된 클립 저장 폴더
    ├── clip_1_1_20251013_015214.mp4
    ├── clip_2_1_20251013_015252.mp4
    └── ...
```

## 📝 파일명 규칙

다운로드된 클립 파일은 다음 형식으로 저장됩니다(중복 방지 대응):

```
clip_{클립ID}.mp4
```

예시: `clip_X2zXyp7Wdf.mp4`

- `X2zXyp7Wdf`: 치지직 클립 상세 URL의 ID 값

이 규칙은 같은 클립을 여러 번 수집하려고 시도하더라도 파일명이 동일하므로 기존 파일이 있으면 자동으로 건너뜁니다.

- `1`: 해당 클립의 첫 번째 미디어 파일
- `20251013_015214`: 2025년 10월 13일 01시 52분 14초

## ⚙️ 클래스 및 메서드 설명

### ChizzkClipCollector 클래스

#### 주요 메서드

- `__init__(channel_id, download_dir)`: 클립 수집기 초기화
- `setup_driver()`: Chrome WebDriver 설정 및 초기화
- `get_clip_links(filter_type, order_type)`: 클립 페이지에서 클립 링크 추출
- `extract_media_urls_from_clip(clip_url)`: 개별 클립에서 미디어 URL 추출
- `download_media(media_url, filename)`: 미디어 파일 다운로드
- `collect_clips(max_clips, filter_type, order_type)`: 전체 수집 프로세스 실행

## ✅ 안정화 개선 사항 (2026-02-02)

- 세그먼트 혼합 방지: ts URL을 그룹화해 가장 큰 그룹만 사용
- 세그먼트 유입 중지 감지: idle 기준으로 대기 종료
- 다운로드 검증: 최소 세그먼트 수/길이 미달 시 실패 처리

## ✅ 최근 수정 사항 (2026-02-02)

- **짧게 저장되던 문제 해결**: ts 세그먼트만 발견되는 경우 m3u8 후보 탐색 후, 실패 시 ts 목록(concat)을 생성해 ffmpeg로 병합 다운로드하도록 수정했습니다.
- **대기 시간 확장**: 세그먼트 수집을 위해 클립 페이지 대기 시간을 20초로 확장했습니다.
- **Windows 콘솔 인코딩 안정화**: ffmpeg 출력 디코딩 오류 방지를 위해 UTF-8 + ignore 옵션을 적용했습니다.

## 🗂️ 저장 위치

- `test_bug_fix.py` 실행 시: `프로젝트 루트/clips/`
- `ShortForm.py` 기본 실행 시: `frontend/public/clips/`

## 🔧 고급 설정

### 헤드리스 모드 활성화

브라우저 창을 표시하지 않고 실행하려면:

```python
# setup_driver() 메서드에서 다음 줄의 주석을 해제
chrome_options.add_argument("--headless")
```

### 채널 ID 찾기

1. 치지직에서 원하는 채널로 이동
2. URL에서 채널 ID 확인: `https://chzzk.naver.com/{CHANNEL_ID}`
3. 스크립트에서 `channel_id` 변수 수정

## 📊 수집 통계

현재 설정으로 테스트한 결과:

- ✅ 성공적으로 수집된 클립: 10개로 설정 (기본값)
- ⏱️ 평균 처리 시간: 클립당 약 30-40초
- 📁 저장 위치: `./clips/` 폴더

## ⚠️ 주의사항

1. **속도 제한**: 서버 부하 방지를 위해 요청 간 2초 대기 시간 설정
2. **중복 방지**: 이미 다운로드된 파일은 자동으로 스킵
3. **네트워크 상태**: 안정적인 인터넷 연결 필요
4. **Chrome 업데이트**: Chrome 브라우저가 최신 버전인지 확인
5. **저작권**: 다운로드한 콘텐츠의 저작권을 준수하세요

중복 방지 동작 상세:

- 스크립트는 각 클립의 URL에서 `클립ID`를 추출하여 파일명을 `clip_{클립ID}.mp4`로 저장합니다.
- 수집 시작 전에 다운로드 디렉터리를 스캔해 `클립ID`가 포함된 파일이 있으면 해당 클립은 건너뜁니다.
- 과거 버전처럼 타임스탬프 기반 파일명이 섞여 있어도, 파일명 내에 `클립ID`가 포함되어 있으면 중복으로 판단합니다.

## 🛠️ 문제 해결

### 일반적인 오류 및 해결책

#### ChromeDriver 오류

```
Chrome 드라이버 초기화 실패
```

**해결책**: Chrome 브라우저가 설치되어 있는지 확인하고, 스크립트를 다시 실행

#### 클립 링크를 찾을 수 없음

```
클립 링크를 찾을 수 없습니다
```

**해결책**:

- 채널 ID가 올바른지 확인
- 해당 채널에 클립이 존재하는지 확인
- 네트워크 연결 상태 확인

#### 미디어 URL 추출 실패

```
미디어 URL을 찾을 수 없습니다
```

**해결책**:

- 페이지 로딩 시간을 늘려보세요 (`time.sleep` 값 증가)
- 치지직 사이트 구조 변경 가능성 확인

## 📈 향후 개선 계획

- [ ] GUI 인터페이스 추가
- [ ] 다중 채널 동시 수집 지원
- [ ] 스케줄링 기능 (자동 정기 실행)
- [ ] 품질별 다운로드 옵션
- [ ] 데이터베이스 연동
- [ ] 진행률 표시 개선

## 📞 지원

문제가 발생하거나 개선 사항이 있으시면 이슈를 등록해 주세요.

## 📄 라이선스

이 프로젝트는 개인적인 용도로 사용하도록 제작되었습니다. 상업적 이용 시 관련 법규를 준수하시기 바랍니다.

---

**⚡ 빠른 시작**: `python ShortForm.py` 실행으로 바로 클립 수집을 시작할 수 있습니다!
