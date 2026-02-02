"""
치지직(CHZZK) 클립 수집기 (ChizzkData)

이 모듈은 네이버 치지직 플랫폼에서 특정 채널의 클립을 자동으로 수집하고 다운로드하는 기능을 제공합니다.

주요 기능:
1. 특정 채널 ID를 이용해 해당 채널의 클립 목록 수집
2. Selenium을 이용한 브라우저 자동화로 동적 콘텐츠 처리
3. 브라우저 네트워크 로그 분석을 통한 실제 미디어 파일 URL 추출
4. HTTP 요청을 통한 미디어 파일 다운로드 및 로컬 저장
5. 파일명 중복 처리 및 타임스탬프 기반 파일 관리

사용 목적:
- 팬 채널에서 특정 주기로 실행하여 최신 클립 자동 수집
- 콘텐츠 아카이브 및 백업 용도
- 클립 분석 및 데이터 수집 연구

기술적 구현:
- Selenium WebDriver를 사용한 브라우저 자동화
- 개발자 도구의 Network 탭 정보를 활용한 미디어 URL 추출
- CSS 선택자를 이용한 클립 링크 요소 탐지
- 스트리밍 다운로드를 통한 대용량 파일 처리

시작 주소 예시: https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e/clips?filterType=ALL&orderType=POPULAR

작성자: RoC
버전: 1.0.0
최종 수정일: 2025-10-13
"""

import os
import re
import time
import requests
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
from urllib.parse import urlparse, urljoin
import json
from datetime import datetime


class ChizzkClipCollector:
    """
    치지직(CHZZK) 클립 수집 및 다운로드 클래스

    이 클래스는 치지직 플랫폼의 특정 채널에서 클립을 자동으로 수집하고
    실제 미디어 파일을 다운로드하는 모든 기능을 제공합니다.

    작동 원리:
    1. Selenium WebDriver를 사용하여 치지직 클립 페이지에 접근
    2. 페이지의 DOM을 분석하여 클립 링크들을 추출
    3. 각 클립 페이지에 접근하여 네트워크 로그 분석
    4. 네트워크 로그에서 실제 비디오 파일 URL을 추출
    5. HTTP 요청을 통해 비디오 파일을 로컬에 다운로드

    Attributes:
        channel_id (str): 대상 치지직 채널의 고유 ID
        download_dir (str): 다운로드된 파일들이 저장될 디렉토리 경로
        base_url (str): 채널 클립 페이지의 기본 URL
        driver (webdriver.Chrome): Selenium Chrome WebDriver 인스턴스
    """

    def __init__(
        self,
        channel_id="1d333ff175b4db5bd06f87a88579ec1e",
        download_dir="clips",
        max_wait_seconds=0,
        idle_wait_seconds=6,
        min_segments=8,
        min_duration_seconds=5,
    ):
        """
        치지직 클립 수집기 초기화

        클립 수집에 필요한 기본 설정을 초기화하고 다운로드 디렉토리를 생성합니다.
        WebDriver는 나중에 setup_driver() 메서드를 통해 초기화됩니다.

        Args:
            channel_id (str): 치지직 채널 ID (기본값: 예시 채널 ID)
                             URL에서 확인 가능: https://chzzk.naver.com/{channel_id}/clips
            download_dir (str): 클립 다운로드 디렉토리 (기본값: "clips")
                              존재하지 않으면 자동 생성됩니다.

        Example:
            >>> collector = ChizzkClipCollector("YOUR_CHANNEL_ID", "my_clips")
            >>> collector.collect_clips(max_clips=10)
        """
        # 채널 정보 설정
        self.channel_id = channel_id
        self.download_dir = download_dir
        self.base_url = f"https://chzzk.naver.com/{channel_id}/clips"
        self.driver = None  # WebDriver는 나중에 초기화
        self.max_wait_seconds = max(0, int(max_wait_seconds))
        self.idle_wait_seconds = max(1, int(idle_wait_seconds))
        self.min_segments = max(0, int(min_segments))
        self.min_duration_seconds = max(0, int(min_duration_seconds))

        # 다운로드 디렉토리 생성 (존재하지 않는 경우)
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)
            print(f"다운로드 디렉토리 생성: {download_dir}")

    # ------------------------------------------------------------------
    # 내부 유틸리티 메서드
    # ------------------------------------------------------------------
    def _extract_clip_id(self, clip_url: str) -> str:
        """클립 상세 페이지 URL에서 클립 ID를 추출합니다.

        예) https://chzzk.naver.com/clips/X2zXyp7Wdf -> X2zXyp7Wdf
        """
        try:
            url = clip_url.rstrip("/")
            return url.split("/")[-1]
        except Exception:
            return ""

    def _sanitize_filename(self, name: str, max_length: int = 80) -> str:
        """윈도우에서 사용할 수 있는 안전한 파일명으로 정제합니다."""

        if not name:
            return ""

        cleaned = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length].rstrip("._- ")
        return cleaned

    def _clip_already_downloaded(self, clip_id: str):
        """디렉터리 내 파일명을 훑어 이미 내려받은 클립인지 확인합니다.

        - 기존/과거 파일명 규칙(clip_{i}_..., clip_{clip_id}...) 모두 포착하기 위해
          파일명에 clip_id가 포함되어 있으면 다운로드된 것으로 간주합니다.
        - 존재 시 해당 경로를 반환, 없으면 None 반환
        """
        if not clip_id:
            return None

        try:
            for name in os.listdir(self.download_dir):
                lower = name.lower()
                if clip_id.lower() in lower and lower.endswith(
                    (".mp4", ".webm", ".m4v")
                ):
                    return os.path.join(self.download_dir, name)
        except FileNotFoundError:
            return None

        # 정확 일치 규칙도 한 번 더 확인
        for ext in (".mp4", ".webm", ".m4v"):
            path = os.path.join(self.download_dir, f"clip_{clip_id}{ext}")
            if os.path.exists(path):
                return path
        return None

    def _sort_ts_urls(self, ts_urls):
        """ts 세그먼트 URL을 가능한 한 올바른 순서로 정렬합니다."""
        def extract_seq(u):
            name = urlparse(u).path.rsplit("/", 1)[-1]
            m = re.search(r"(\\d+)(?=\\.ts$)", name)
            return int(m.group(1)) if m else None

        with_seq = []
        without_seq = []
        for idx, u in enumerate(ts_urls):
            seq = extract_seq(u)
            if seq is None:
                without_seq.append((idx, u))
            else:
                with_seq.append((seq, u))

        with_seq.sort(key=lambda x: x[0])
        ordered = [u for _, u in with_seq] + [u for _, u in without_seq]
        return ordered

    def _select_ts_group(self, ts_urls):
        """서로 다른 클립의 ts가 섞일 경우 가장 많은 그룹만 사용합니다."""
        if not ts_urls:
            return []

        groups = {}
        order = []
        for u in ts_urls:
            if "/hls/" in u:
                key = u.split("/hls/")[0]
            else:
                key = urlparse(u).netloc
            if key not in groups:
                groups[key] = []
                order.append(key)
            groups[key].append(u)

        # 가장 큰 그룹 선택 (동률이면 먼저 등장한 그룹)
        best_key = None
        best_size = -1
        for key in order:
            size = len(groups[key])
            if size > best_size:
                best_key = key
                best_size = size

        return groups.get(best_key, [])

    def _probe_m3u8_candidates(self, candidates):
        """m3u8 후보 URL을 실제로 요청해 유효한 스트림인지 확인합니다."""
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        }

        for url in candidates:
            try:
                resp = requests.get(url, headers=headers, timeout=8)
                if resp.status_code == 200 and "#EXTM3U" in resp.text:
                    return url
            except Exception:
                continue
        return None

    def setup_driver(self):
        """
        Chrome WebDriver 초기화 및 설정

        웹 스크래핑과 미디어 URL 추출을 위한 Chrome WebDriver를 설정합니다.
        특히 네트워크 로깅을 활성화하여 브라우저의 네트워크 요청을 모니터링할 수 있도록 합니다.

        Chrome 옵션 설명:
        - --no-sandbox: 샌드박스 비활성화 (리눅스 환경에서 필요)
        - --disable-dev-shm-usage: /dev/shm 사용 비활성화 (메모리 부족 방지)
        - --disable-gpu: GPU 가속 비활성화 (헤드리스 모드에서 안정성 향상)
        - --window-size: 브라우저 창 크기 설정 (반응형 레이아웃 대응)
        - --enable-logging: 로깅 활성화
        - --log-level=0: 모든 레벨의 로그 수집
        - goog:loggingPrefs: 네트워크 성능 로그 수집 활성화

        Raises:
            Exception: Chrome 브라우저가 설치되지 않았거나 WebDriver 초기화에 실패한 경우

        Note:
            webdriver-manager가 자동으로 적절한 ChromeDriver 버전을 다운로드하고 설정합니다.
            Chrome 브라우저는 별도로 설치되어 있어야 합니다.
        """
        # Chrome 옵션 설정
        chrome_options = Options()
        chrome_options.add_argument("--no-sandbox")  # 샌드박스 비활성화
        chrome_options.add_argument("--disable-dev-shm-usage")  # /dev/shm 사용 안함
        chrome_options.add_argument("--disable-gpu")  # GPU 가속 비활성화
        chrome_options.add_argument("--window-size=1920,1080")  # 브라우저 창 크기

        # 헤드리스 모드 설정 (브라우저 창을 표시하지 않고 실행)
        # 백그라운드 실행이 필요한 경우 아래 주석을 해제하세요
        # chrome_options.add_argument("--headless")

        # 네트워크 로깅 활성화 (미디어 URL 추출을 위해 필수)
        chrome_options.add_argument("--enable-logging")  # 로깅 활성화
        chrome_options.add_argument("--log-level=0")  # 모든 로그 레벨 수집
        chrome_options.set_capability(
            "goog:loggingPrefs", {"performance": "ALL"}
        )  # 성능 로그 수집

        try:
            # ChromeDriverManager를 사용하여 자동으로 ChromeDriver 다운로드 및 설정
            # 버전 호환성 문제를 자동으로 해결합니다
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)

            # 암시적 대기 시간 설정 (요소를 찾을 때까지 최대 10초 대기)
            self.driver.implicitly_wait(10)
            print("[OK] Chrome driver initialized.")

        except Exception as e:
            print(f"[ERR] Chrome driver init failed: {e}")
            print("해결책:")
            print("1. Chrome 브라우저가 설치되어 있는지 확인하세요")
            print("2. 인터넷 연결을 확인하세요 (ChromeDriver 다운로드 필요)")
            print(
                "3. 바이러스 백신 소프트웨어가 WebDriver를 차단하지 않는지 확인하세요"
            )
            raise

    def get_clip_links(self, filter_type="ALL", order_type="POPULAR"):
        """
        치지직 클립 페이지에서 클립 URL과 제목을 함께 추출합니다.

        Returns:
            list[dict]: [{"url": "...", "title": "..."}, ...]
        """
        url = f"{self.base_url}?filterType={filter_type}&orderType={order_type}"
        print(f"클립 페이지 접속: {url}")

        try:
            self.driver.get(url)

            # 페이지 로딩 대기
            WebDriverWait(self.driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # 클립 리스트가 로드될 때까지 대기
            time.sleep(5)

            # 카드 컨테이너 기준으로 URL+제목 추출
            clip_entries = []

            card_links = self.driver.find_elements(
                By.CSS_SELECTOR,
                "ul.channel_component_list__kCgKT li.channel_clip_item__eVWfU a.clip_card_link__Pxcf6",
            )

            if card_links:
                for link_el in card_links:
                    href = link_el.get_attribute("href") or ""
                    title = ""

                    try:
                        title_el = link_el.find_element(
                            By.CSS_SELECTOR, "strong.clip_card_title__Pc2jc"
                        )
                        title = title_el.text.strip()
                    except NoSuchElementException:
                        pass

                    # 절대 경로로 변환
                    full_url = urljoin(self.base_url, href) if href else ""
                    if full_url and "clip" in full_url:
                        clip_entries.append({"url": full_url, "title": title})

            # 카드 선택자에서 못 찾았으면 기존 방식으로 fallback
            if not clip_entries:
                possible_selectors = [
                    "a[href*='/clip/']",
                    "a[href*='/clips/']",
                    "[data-testid*='clip'] a",
                    ".clip-item a",
                    ".clip-card a",
                ]

                for selector in possible_selectors:
                    try:
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            print(
                                f"'{selector}' 선택자로 {len(elements)}개 요소를 찾았습니다."
                            )
                            for element in elements:
                                href = element.get_attribute("href") or ""
                                full_url = urljoin(self.base_url, href) if href else ""
                                title = ""
                                if full_url and "clip" in full_url:
                                    clip_entries.append(
                                        {"url": full_url, "title": title}
                                    )
                            break
                    except Exception:
                        continue

            # URL 기준으로 중복 제거
            dedup = {}
            for entry in clip_entries:
                u = entry.get("url")
                if u and u not in dedup:
                    dedup[u] = entry.get("title", "")

            clip_entries = [{"url": u, "title": t} for u, t in dedup.items()]

            print(f"총 {len(clip_entries)}개의 클립 링크를 찾았습니다.")

            return clip_entries

        except TimeoutException:
            print("페이지 로딩 시간 초과")
            return []
        except Exception as e:
            print(f"클립 링크 추출 중 오류 발생: {e}")
            return []

    def extract_media_urls_from_clip(self, clip_url):
        """
        개별 클립 페이지에서 미디어 URL 추출

        Args:
            clip_url (str): 클립 페이지 URL

        Returns:
            list: 미디어 URL 리스트
        """
        print(f"\n{'='*60}")
        print(f"[STEP 1] 클립 분석 시작: {clip_url}")
        print(f"{'='*60}")

        try:
            # 이전 로그 클리어
            print("[STEP 2] Clear previous network logs...")
            self.driver.execute_script("window.open('about:blank', '_blank');")
            self.driver.switch_to.window(self.driver.window_handles[1])
            self.driver.close()
            self.driver.switch_to.window(self.driver.window_handles[0])
            print("         [OK] Logs cleared")

            # 클립 페이지로 이동
            print(f"[STEP 3] Navigating to clip page...")
            self.driver.get(clip_url)

            # 페이지 로딩 대기
            WebDriverWait(self.driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            print(f"         [OK] Page loaded")
            print(f"         현재 URL: {self.driver.current_url}")
            print(f"         페이지 제목: {self.driver.title}")

            # 세그먼트가 더 이상 들어오지 않을 때까지 대기하며 로그 수집
            print(
                f"[STEP 4] Waiting for segments until idle (idle {self.idle_wait_seconds}s, max {self.max_wait_seconds}s)..."
            )
            start_time = time.time()
            last_new_time = time.time()
            poll_interval = 2

            print(f"[STEP 5] Collecting network logs...")
            logs = []

            # URL 분류를 위한 변수들
            all_urls = []
            m3u8_urls = set()
            ts_urls = []
            ts_seen = set()
            mp4_urls = set()
            other_media_urls = set()

            # 클립 ID 추출
            clip_id = clip_url.split("/")[-1] if "/" in clip_url else None
            print(f"         클립 ID: {clip_id}")

            print(f"\n[STEP 6] 네트워크 로그 분석 중...")
            while True:
                time.sleep(poll_interval)
                logs = self.driver.get_log("performance")
                if logs:
                    print(f"         [LOG] +{len(logs)}")

                new_media_found = False
                for log in logs:
                    try:
                        message = json.loads(log["message"])
                        method = message["message"]["method"]

                        if method in ["Network.responseReceived", "Network.requestWillBeSent"]:
                            if method == "Network.responseReceived":
                                params = message["message"]["params"]["response"]
                            else:
                                params = message["message"]["params"]["request"]

                            url = params.get("url", "")
                            mime_type = params.get("mimeType", "")
                            url_l = url.lower()
                            mime_l = mime_type.lower() if mime_type else ""

                            # 미디어 관련 URL만 수집 (mimeType 기반 포함)
                            is_media_hint = (
                                ".m3u8" in url_l
                                or ".ts" in url_l
                                or ".mp4" in url_l
                                or any(
                                    x in url_l
                                    for x in [
                                        "pstatic",
                                        "naver",
                                        "chzzk",
                                        "glive",
                                        "vod",
                                        "video",
                                        "media",
                                    ]
                                )
                                or ("video" in mime_l or "mpegurl" in mime_l)
                            )

                            if is_media_hint:
                                all_urls.append(
                                    {"url": url, "mime": mime_type, "method": method}
                                )

                                # URL 유형별 분류
                                if ".m3u8" in url_l or "mpegurl" in mime_l:
                                    if url not in m3u8_urls:
                                        m3u8_urls.add(url)
                                        new_media_found = True
                                elif ".ts" in url_l and (
                                    "pstatic" in url_l
                                    or "naver" in url_l
                                    or "glive" in url_l
                                ):
                                    if url not in ts_seen:
                                        ts_urls.append(url)
                                        ts_seen.add(url)
                                        new_media_found = True
                                elif ".mp4" in url_l:
                                    if url not in mp4_urls:
                                        mp4_urls.add(url)
                                        new_media_found = True
                                elif "video" in mime_l or "mpegurl" in mime_l:
                                    other_media_urls.add(url)

                    except (json.JSONDecodeError, KeyError):
                        continue

                now = time.time()
                if new_media_found:
                    last_new_time = now

                if now - last_new_time >= self.idle_wait_seconds:
                    break
                if self.max_wait_seconds > 0 and now - start_time >= self.max_wait_seconds:
                    break

            print(
                f"         [OK] Log collection done (elapsed {int(time.time() - start_time)}s)"
            )

            # 결과 출력
            print(f"\n[STEP 7] 분석 결과:")
            print(f"         ┌─────────────────────────────────────")
            print(f"         │ 전체 미디어 관련 URL: {len(all_urls)}개")
            print(f"         │ m3u8 (HLS 매니페스트): {len(m3u8_urls)}개")
            print(f"         │ ts (HLS 세그먼트): {len(ts_urls)}개")
            print(f"         │ mp4 (직접 다운로드): {len(mp4_urls)}개")
            print(f"         │ 기타 미디어: {len(other_media_urls)}개")
            print(f"         └─────────────────────────────────────")

            # 상세 URL 출력
            if m3u8_urls:
                print(f"\n[DETAIL] m3u8 URL 목록:")
                for i, url in enumerate(m3u8_urls, 1):
                    print(f"         {i}. {url[:120]}...")

            if ts_urls:
                print(f"\n[DETAIL] ts 세그먼트 URL (처음 5개):")
                for i, url in enumerate(ts_urls[:5], 1):
                    print(f"         {i}. {url[:120]}...")
                if len(ts_urls) > 5:
                    print(f"         ... 외 {len(ts_urls) - 5}개")

            if mp4_urls:
                print(f"\n[DETAIL] mp4 URL 목록:")
                for i, url in enumerate(mp4_urls, 1):
                    print(f"         {i}. {url[:120]}...")

            if not m3u8_urls and not ts_urls and not mp4_urls:
                print(f"\n[DETAIL] 전체 수집된 URL (처음 10개):")
                for i, item in enumerate(all_urls[:10], 1):
                    print(f"         {i}. [{item['mime'][:20] if item['mime'] else 'N/A':20}] {item['url'][:100]}")

            # 반환할 URL 결정
            print(f"\n[STEP 8] 다운로드 URL 결정...")
            if m3u8_urls:
                result = list(m3u8_urls)
                print(f"         [OK] Use m3u8 (ffmpeg full download)")
                return result
            elif mp4_urls:
                result = list(mp4_urls)
                print(f"         [OK] Use mp4 (direct download)")
                return result
            elif ts_urls:
                # ts 세그먼트만 있을 때 m3u8을 추론하여 전체 다운로드 시도
                print(f"         [WARN] Only ts segments found (no m3u8)")
                print(f"         ts URL에서 m3u8 경로 추론 시도...")

                # ts URL에서 m3u8 경로 추론
                filtered_ts = self._select_ts_group(ts_urls)
                if not filtered_ts:
                    print("         [ERR] No ts segments after grouping.")
                    return []

                sample_ts = filtered_ts[0]
                parsed = urlparse(sample_ts)
                ts_path = parsed.path
                ts_query = parsed.query
                possible_m3u8 = []

                # 일반적인 HLS 구조: .../hls/xxx.m3u8 -> .../hls/segment_xxx.ts
                if "/hls/" in sample_ts:
                    base_path = sample_ts.rsplit("/", 1)[0]
                    possible_m3u8.extend(
                        [
                            f"{base_path}/index.m3u8",
                            f"{base_path}/playlist.m3u8",
                            f"{base_path}/master.m3u8",
                            f"{base_path}/chunklist.m3u8",
                        ]
                    )

                # 세그먼트 파일명을 제거하고 다양한 이름으로 시도
                if "/" in sample_ts:
                    parent = sample_ts.rsplit("/", 1)[0]
                    possible_m3u8.extend(
                        [
                            f"{parent}/index.m3u8",
                            f"{parent}/master.m3u8",
                            f"{parent}/playlist.m3u8",
                            f"{parent}/chunklist.m3u8",
                        ]
                    )

                # ts 파일명 기반 m3u8 후보 생성
                if ts_path.endswith(".ts"):
                    ts_dir = ts_path.rsplit("/", 1)[0]
                    ts_name = ts_path.rsplit("/", 1)[-1]
                    ts_stem = ts_name[:-3]
                    base_url = f"{parsed.scheme}://{parsed.netloc}{ts_dir}"
                    possible_m3u8.extend(
                        [
                            f"{base_url}/{ts_stem}.m3u8",
                            f"{base_url}/{ts_stem}-master.m3u8",
                            f"{base_url}/{ts_stem}_master.m3u8",
                            f"{base_url}/{ts_stem}-playlist.m3u8",
                            f"{base_url}/{ts_stem}_playlist.m3u8",
                            f"{base_url}/{ts_stem}-chunklist.m3u8",
                            f"{base_url}/{ts_stem}_chunklist.m3u8",
                        ]
                    )

                # 쿼리 스트링이 있으면 후보에도 적용
                if ts_query:
                    possible_m3u8 = [
                        f"{u}?{ts_query}" if "?" not in u else u
                        for u in possible_m3u8
                    ]

                # 중복 제거
                possible_m3u8 = list(dict.fromkeys(possible_m3u8))

                if possible_m3u8:
                    print(f"         추론된 m3u8 후보:")
                    for pm in possible_m3u8:
                        print(f"           - {pm[:100]}...")

                    valid_m3u8 = self._probe_m3u8_candidates(possible_m3u8)
                    if valid_m3u8:
                        print(f"         [OK] Valid m3u8: {valid_m3u8[:120]}...")
                        return [valid_m3u8]

                print(f"         [WARN] No valid m3u8 found. Build ts concat list.")
                ordered_ts = self._sort_ts_urls(filtered_ts)
                if not ordered_ts:
                    print("         [ERR] No ts segments available.")
                    return []

                list_path = os.path.join(
                    self.download_dir, f"__tslist_{clip_id or 'unknown'}.txt"
                )
                try:
                    with open(list_path, "w", encoding="utf-8") as f:
                        for u in ordered_ts:
                            f.write(f"file '{u}'\n")
                    print(f"         [OK] ts list created: {list_path}")
                    return [f"tslist:{list_path}|count={len(ordered_ts)}"]
                except Exception as e:
                    print(f"         [ERR] Failed to write ts list: {e}")
                    return []
            else:
                print(f"         [ERR] No downloadable URL found")
                return []

        except Exception as e:
            print(f"\n[ERR] Media URL extraction failed: {e}")
            import traceback
            traceback.print_exc()
            return []

    def download_media(self, media_url, filename=None):
        """
        미디어 파일 다운로드 (HLS 스트림 지원)

        Args:
            media_url (str): 미디어 URL (m3u8 또는 직접 다운로드 URL)
            filename (str): 저장할 파일명 (None시 자동 생성)

        Returns:
            bool: 다운로드 성공 여부
        """
        import subprocess
        import shutil

        try:
            if not filename:
                # URL에서 파일명 추출 또는 타임스탬프 사용
                parsed_url = urlparse(media_url)
                filename = os.path.basename(parsed_url.path)
                if not filename or "." not in filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"clip_{timestamp}.mp4"

            # 확장자가 .mp4가 아니면 변경
            if not filename.lower().endswith(".mp4"):
                filename = os.path.splitext(filename)[0] + ".mp4"

            filepath = os.path.join(self.download_dir, filename)

            # 이미 존재하는 파일은 스킵
            if os.path.exists(filepath):
                print(f"파일이 이미 존재합니다: {filename}")
                return True

            # ts 리스트(concat) 다운로드 처리
            if media_url.startswith("tslist:"):
                payload = media_url.split("tslist:", 1)[1]
                list_path = payload
                expected_count = None
                if "|count=" in payload:
                    list_path, count_str = payload.split("|count=", 1)
                    try:
                        expected_count = int(count_str)
                    except ValueError:
                        expected_count = None

                print(f"[HLS] Download from ts list: {filename}")
                if not os.path.exists(list_path):
                    print(f"[ERR] ts list file not found: {list_path}")
                    return False

                if expected_count is not None and expected_count < self.min_segments:
                    print(
                        f"[ERR] Not enough segments ({expected_count} < {self.min_segments}). Skip download."
                    )
                    return False

                ffmpeg_path = shutil.which("ffmpeg")
                if not ffmpeg_path:
                    print("[ERR] ffmpeg not installed. Install ffmpeg.")
                    return False

                cmd = [
                    ffmpeg_path,
                    "-protocol_whitelist", "file,http,https,tcp,tls",
                    "-f", "concat",
                    "-safe", "0",
                    "-i", list_path,
                    "-c", "copy",
                    "-y",
                    filepath
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=300
                )

                if result.returncode == 0 and os.path.exists(filepath):
                    file_size = os.path.getsize(filepath)
                    print(f"[OK] Downloaded: {filename} ({file_size / 1024 / 1024:.1f} MB)")
                    if self.min_duration_seconds > 0:
                        ffprobe_path = shutil.which("ffprobe")
                        if ffprobe_path:
                            probe = subprocess.run(
                                [
                                    ffprobe_path,
                                    "-v",
                                    "error",
                                    "-show_entries",
                                    "format=duration",
                                    "-of",
                                    "default=noprint_wrappers=1:nokey=1",
                                    filepath,
                                ],
                                capture_output=True,
                                text=True,
                                encoding="utf-8",
                                errors="ignore",
                                timeout=30,
                            )
                            try:
                                duration = float(probe.stdout.strip())
                            except ValueError:
                                duration = 0.0
                            if duration < self.min_duration_seconds:
                                print(
                                    f"[ERR] Duration too short ({duration:.2f}s < {self.min_duration_seconds}s). Removing file."
                                )
                                try:
                                    os.remove(filepath)
                                except OSError:
                                    pass
                                return False
                    return True

                print(f"[ERR] ffmpeg concat error: {result.stderr[:500] if result.stderr else 'Unknown error'}")
                return False

            # ts 단일 다운로드는 짧은 영상이므로 차단
            if ".ts" in media_url.lower() and ".m3u8" not in media_url.lower():
                print("[ERR] ts single-segment download is not supported. m3u8 is required.")
                return False

            # HLS 스트림인 경우 ffmpeg 사용
            if ".m3u8" in media_url.lower():
                print(f"[HLS] Download start: {filename}")

                # ffmpeg 존재 확인
                ffmpeg_path = shutil.which("ffmpeg")
                if not ffmpeg_path:
                    print("[ERR] ffmpeg not installed. Install ffmpeg.")
                    return False

                # ffmpeg 명령어 실행
                cmd = [
                    ffmpeg_path,
                    "-i", media_url,
                    "-c", "copy",  # 코덱 복사 (재인코딩 없음)
                    "-bsf:a", "aac_adtstoasc",  # AAC 스트림 수정
                    "-y",  # 덮어쓰기
                    filepath
                ]

                print(f"   실행 명령: ffmpeg -i [URL] -c copy {filename}")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="ignore",
                    timeout=300  # 5분 타임아웃
                )

                if result.returncode == 0 and os.path.exists(filepath):
                    file_size = os.path.getsize(filepath)
                    print(f"[OK] Downloaded: {filename} ({file_size / 1024 / 1024:.1f} MB)")
                    return True
                else:
                    print(
                        f"[ERR] ffmpeg error: {result.stderr[:500] if result.stderr else 'Unknown error'}"
                    )
                    return False

            else:
                # 일반 다운로드
                print(f"[DL] Start: {filename}")

                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }

                response = requests.get(media_url, headers=headers, stream=True)
                response.raise_for_status()

                with open(filepath, "wb") as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)

                print(f"[OK] Downloaded: {filename}")
                return True

        except subprocess.TimeoutExpired:
            print(f"[ERR] Download timeout: {filename}")
            return False
        except Exception as e:
            print(f"[ERR] Download failed ({filename}): {e}")
            return False

    def collect_clips(self, max_clips=10, filter_type="ALL", order_type="POPULAR"):
        """
        클립 수집 메인 함수

        Args:
            max_clips (int): 최대 수집할 클립 수
            filter_type (str): 필터 타입
            order_type (str): 정렬 타입
        """
        print("=== Chizzk clip collection start ===")

        try:
            # 드라이버 설정
            self.setup_driver()

            # 클립 링크+제목 추출
            clip_entries = self.get_clip_links(filter_type, order_type)

            if not clip_entries:
                print("클립 링크를 찾을 수 없습니다.")
                return

            # 최대 수집 수 제한
            clip_entries = clip_entries[:max_clips]

            successful_downloads = 0

            for i, entry in enumerate(clip_entries, 1):
                clip_url = entry.get("url") if isinstance(entry, dict) else entry
                clip_title = entry.get("title", "") if isinstance(entry, dict) else ""

                if not clip_url:
                    print("[WARN] Invalid clip URL, skip.")
                    continue

                print(f"\n[{i}/{len(clip_entries)}] 클립 처리 중... 제목: {clip_title}")

                # 클립 ID 기반 중복 검사 (디렉터리 확인)
                clip_id = self._extract_clip_id(clip_url)
                existing_path = self._clip_already_downloaded(clip_id)
                if existing_path:
                    print(f"[SKIP] Already downloaded: {os.path.basename(existing_path)}")
                    continue

                # 미디어 URL 추출
                media_urls = self.extract_media_urls_from_clip(clip_url)

                if not media_urls:
                    print("[WARN] No media URL found.")
                    continue

                # 첫 번째 미디어만 다운로드 (중복 방지)
                media_url = media_urls[0]

                safe_title = self._sanitize_filename(clip_title)
                filename_parts = [safe_title] if safe_title else []
                if not filename_parts:
                    filename_parts.append(f"clip_{i}")
                filename = "_".join(filename_parts) + ".mp4"

                print(f"[DL] Try: {filename}")
                if self.download_media(media_url, filename):
                    successful_downloads += 1
                    print(f"[OK] Success: {filename}")
                else:
                    print(f"[ERR] Failed: {filename}")

                # 다중 URL이 발견된 경우 경고
                if len(media_urls) > 1:
                    print(
                        f"[INFO] {len(media_urls)-1} more media URLs found, but only first was used."
                    )

                # 요청 간격 조절
                time.sleep(2)

            print(f"\n=== Collection done ===")
            print(f"Downloaded files: {successful_downloads}")

        except Exception as e:
            print(f"[ERR] Collection error: {e}")
        finally:
            if self.driver:
                self.driver.quit()
                print("Browser closed")


def main():
    """
    메인 실행 함수 - 치지직 클립 수집 프로그램의 진입점

    기본 설정으로 클립 수집기를 초기화하고 실행합니다.
    클립은 frontend/public/clips 폴더에 저장되어 웹사이트에서 바로 사용 가능합니다.

    실행 과정:
    1. 기본 채널 ID로 ChizzkClipCollector 인스턴스 생성
    2. frontend/public/clips 폴더를 다운로드 디렉토리로 설정
    3. 인기순으로 정렬된 전체 클립 중 최대 10개 수집

    설정 변경 방법:
    - channel_id: 다른 치지직 채널의 ID로 변경
    - max_clips: 수집할 클립 수 조정 (주의: 너무 많으면 시간이 오래 걸림)
    - filter_type: "WEEKLY", "MONTHLY"로 변경 가능
    - order_type: "RECENT"로 변경하여 최신순 정렬 가능

    Example:
        다른 채널의 클립을 10개 수집하려면:
        >>> channel_id = "YOUR_CHANNEL_ID"
        >>> collector.collect_clips(max_clips=10)
    """
    import argparse

    # 명령줄 인자 파싱
    parser = argparse.ArgumentParser(description="치지직 클립 수집기")
    parser.add_argument("--max-clips", type=int, default=10, help="수집할 최대 클립 수 (기본값: 10)")
    parser.add_argument("--order", choices=["POPULAR", "RECENT"], default="POPULAR", help="정렬 방식 (기본값: POPULAR)")
    parser.add_argument("--filter", choices=["ALL", "WEEKLY", "MONTHLY"], default="ALL", help="필터 타입 (기본값: ALL)")
    parser.add_argument("--output", type=str, default=None, help="저장 디렉토리 (기본값: ../frontend/public/clips)")
    parser.add_argument("--max-wait-seconds", type=int, default=0, help="최대 대기 시간 (초, 0이면 제한 없음)")
    parser.add_argument("--idle-seconds", type=int, default=6, help="세그먼트 유입 중지 판단 시간 (초)")
    parser.add_argument("--min-segments", type=int, default=8, help="ts 세그먼트 최소 개수")
    parser.add_argument("--min-duration", type=int, default=5, help="최소 영상 길이(초)")
    args = parser.parse_args()

    # 기본 채널 ID 설정 (모잉 채널)
    channel_id = "1d333ff175b4db5bd06f87a88579ec1e"

    # 저장 디렉토리 설정 (frontend/public/clips로 직접 저장)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_output = os.path.join(script_dir, "..", "frontend", "public", "clips")
    download_dir = args.output if args.output else default_output

    # 디렉토리 정규화
    download_dir = os.path.normpath(download_dir)

    print("Chizzk clip collector start")
    print(f"Channel ID: {channel_id}")
    print(f"Output: {download_dir}")
    print(f"Options: max_clips={args.max_clips}, order={args.order}, filter={args.filter}")
    print("=" * 50)

    # 클립 수집기 인스턴스 생성
    collector = ChizzkClipCollector(
        channel_id=channel_id,
        download_dir=download_dir,
        max_wait_seconds=args.max_wait_seconds,
        idle_wait_seconds=args.idle_seconds,
        min_segments=args.min_segments,
        min_duration_seconds=args.min_duration,
    )

    # 클립 수집 실행
    collector.collect_clips(
        max_clips=args.max_clips,
        filter_type=args.filter,
        order_type=args.order,
    )


if __name__ == "__main__":
    """
    스크립트 직접 실행 시 main() 함수 호출

    이 조건문은 스크립트가 직접 실행될 때만 main() 함수를 호출합니다.
    다른 모듈에서 이 파일을 import할 때는 실행되지 않습니다.

    실행 방법:
    1. 명령줄에서: python ShortForm.py
    2. IDE에서: F5 키 또는 Run 버튼
    3. 가상환경에서: conda activate chizzk_clips && python ShortForm.py

    실행 전 체크리스트:
    ✅ Chrome 브라우저 설치 확인
    ✅ 가상환경 활성화 (conda activate chizzk_clips)
    ✅ 필요한 라이브러리 설치 확인 (pip install selenium beautifulsoup4 requests webdriver-manager)
    ✅ 인터넷 연결 상태 확인
    ✅ 대상 채널 ID 정확성 확인

    예상 실행 시간: 클립 5개 기준 약 3-5분
    """
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[WARN] Interrupted by user.")
        print("Exiting safely...")
    except Exception as e:
        print(f"\n\n[ERR] Unexpected error: {e}")
        print("If the issue persists, check:")
        print("1. Chrome 브라우저 최신 버전 설치")
        print("2. 네트워크 연결 상태")
        print("3. 채널 ID의 정확성")
        print("4. 가상환경 활성화 상태")

# ============================================================================
# 개발 정보
# ============================================================================
# 프로젝트명: ChizzkData - 치지직 클립 수집기
# 버전: 1.0.0
# 개발일자: 2025-10-13
# 개발환경: Python 3.9, Selenium 4.36.0, Windows 11
#
# 주요 기능:
# - 치지직 채널 클립 자동 수집
# - 실제 미디어 파일 URL 추출 및 다운로드
# - 파일명 자동 생성 및 중복 처리
# - 다양한 필터 및 정렬 옵션 지원
#
# 기술 스택:
# - Selenium WebDriver: 브라우저 자동화
# - BeautifulSoup4: HTML 파싱 (확장 가능)
# - Requests: HTTP 요청 및 파일 다운로드
# - webdriver-manager: ChromeDriver 자동 관리
#
# 라이선스: 개인 사용 목적
# 주의사항: 저작권법 준수, 서버 부하 방지를 위한 적절한 딜레이 설정
# ============================================================================
