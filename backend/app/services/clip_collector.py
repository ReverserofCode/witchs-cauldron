"""
Chzzk Clip Collector Service

Refactored from chizzkData/ShortForm.py for FastAPI/Docker integration.
Collects clips from Chzzk platform using Selenium.

IMPORTANT: This follows the EXACT same logic as the original ShortForm.py
to ensure compatibility. See FAILURE_LOG.md for previous failed attempts.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from app.config import get_settings
from app.core.selenium_driver import WebDriverManager


@dataclass
class ClipInfo:
    """Clip information dataclass"""

    url: str
    title: str
    clip_id: str = ""

    def __post_init__(self):
        if not self.clip_id and self.url:
            self.clip_id = self._extract_clip_id()

    def _extract_clip_id(self) -> str:
        """Extract clip ID from URL"""
        try:
            url = self.url.rstrip("/")
            return url.split("/")[-1]
        except Exception:
            return ""


@dataclass
class CollectionResult:
    """Result of a clip collection operation"""

    success: bool
    clips_collected: int = 0
    total_attempted: int = 0
    collected_clips: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    duration_seconds: float = 0


class ChzzkClipCollector:
    """
    Chzzk Clip Collector for Docker/FastAPI environment

    This class follows the EXACT same logic as the original ShortForm.py
    to ensure media URL extraction works correctly.
    """

    def __init__(
        self,
        channel_id: Optional[str] = None,
        download_dir: Optional[str] = None,
    ):
        settings = get_settings()
        self.channel_id = channel_id or settings.chzzk_channel_id
        self.download_dir = download_dir or settings.clips_dir
        self.base_url = f"https://chzzk.naver.com/{self.channel_id}/clips"

        # Ensure download directory exists
        os.makedirs(self.download_dir, exist_ok=True)

    def _sanitize_filename(self, name: str, max_length: int = 80) -> str:
        """Create safe filename for Windows/Linux (same as original)"""
        if not name:
            return ""
        cleaned = re.sub(r'[\\/:*?"<>|]+', "_", name).strip()
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length].rstrip("._- ")
        return cleaned

    def _clip_already_downloaded(self, clip_id: str) -> Optional[str]:
        """Check if clip already exists in download directory (same as original)"""
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

        # Check exact match pattern
        for ext in (".mp4", ".webm", ".m4v"):
            path = os.path.join(self.download_dir, f"clip_{clip_id}{ext}")
            if os.path.exists(path):
                return path
        return None

    def get_clip_links(
        self, driver, filter_type: str = "ALL", order_type: str = "POPULAR"
    ) -> list[ClipInfo]:
        """
        Extract clip URLs and titles from Chzzk clips page
        (Same logic as original ShortForm.py)
        """
        url = f"{self.base_url}?filterType={filter_type}&orderType={order_type}"
        print(f"Accessing clips page: {url}")

        try:
            driver.get(url)

            # Wait for page load
            WebDriverWait(driver, 20).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # Wait for clip list to load (same as original: 5 seconds)
            time.sleep(5)

            clip_entries = []

            # Primary selector (same as original)
            card_links = driver.find_elements(
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

                    full_url = urljoin(self.base_url, href) if href else ""
                    if full_url and "clip" in full_url:
                        clip_entries.append(ClipInfo(url=full_url, title=title))

            # Fallback selectors (same as original)
            if not clip_entries:
                fallback_selectors = [
                    "a[href*='/clip/']",
                    "a[href*='/clips/']",
                    "[data-testid*='clip'] a",
                    ".clip-item a",
                    ".clip-card a",
                ]

                for selector in fallback_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            print(f"Found {len(elements)} elements with selector: {selector}")
                            for element in elements:
                                href = element.get_attribute("href") or ""
                                full_url = urljoin(self.base_url, href) if href else ""
                                if full_url and "clip" in full_url:
                                    clip_entries.append(ClipInfo(url=full_url, title=""))
                            break
                    except Exception:
                        continue

            # Remove duplicates by URL
            seen_urls = set()
            unique_entries = []
            for entry in clip_entries:
                if entry.url not in seen_urls:
                    seen_urls.add(entry.url)
                    unique_entries.append(entry)

            print(f"Found {len(unique_entries)} clip links")
            return unique_entries

        except TimeoutException:
            print("Page loading timeout")
            return []
        except Exception as e:
            print(f"Error extracting clip links: {e}")
            return []

    def extract_media_urls(self, driver, clip_url: str) -> list[str]:
        """
        Extract media URLs from individual clip page using network logs.

        IMPORTANT: This uses the EXACT same logic as the original ShortForm.py
        Lines 308-387 of the original code.
        """
        print(f"Analyzing clip: {clip_url}")

        try:
            # Clear previous logs by opening/closing new tab (same as original)
            driver.execute_script("window.open('about:blank', '_blank');")
            driver.switch_to.window(driver.window_handles[1])
            driver.close()
            driver.switch_to.window(driver.window_handles[0])

            # Navigate to clip page
            driver.get(clip_url)

            # Wait for page load (same as original: 15 second timeout)
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )

            # Wait for video element to appear (increased timeout for dynamic content)
            print("Waiting for video element to load...")
            time.sleep(8)  # Increased from 5 to 8 seconds

            # Try to trigger video playback
            # With Xvfb, the video player should initialize properly
            try:
                # Wait explicitly for video element
                video_element = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.TAG_NAME, "video"))
                )
                print("Video element found")
                if video_element:
                    # Mute and play the video to trigger media loading
                    driver.execute_script("""
                        var video = arguments[0];
                        video.muted = true;
                        video.currentTime = 0;
                        var playPromise = video.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(function(error) {
                                console.log('Autoplay prevented:', error);
                            });
                        }
                    """, video_element)
                    print("Triggered video playback")
                    # Wait for video to buffer and media URLs to appear in network logs
                    time.sleep(5)
            except TimeoutException:
                print("Video element not found after waiting - page may not have loaded correctly")
                # Debug: Save page source for analysis
                try:
                    page_title = driver.title
                    print(f"Page title: {page_title}")
                    print(f"Current URL: {driver.current_url}")
                except Exception:
                    pass
                time.sleep(3)
            except Exception as e:
                print(f"Could not trigger video playback: {e}")
                time.sleep(3)

            # Extract media URLs from network logs
            # EXACT same logic as original (lines 339-374)
            logs = driver.get_log("performance")
            media_urls = set()

            for log in logs:
                try:
                    message = json.loads(log["message"])

                    # IMPORTANT: Only check Network.responseReceived (same as original)
                    if message["message"]["method"] == "Network.responseReceived":
                        response = message["message"]["params"]["response"]
                        url = response["url"]
                        mime_type = response.get("mimeType", "")

                        # Condition 1: Check for video file extensions or mimeType
                        # (EXACT same as original lines 354-357)
                        if (
                            any(ext in url.lower() for ext in [".mp4", ".webm", ".m4v"])
                            or "video" in mime_type.lower()
                        ):
                            # Condition 2: Verify it's a Chzzk/Naver media URL
                            # (EXACT same as original lines 360-364)
                            if (
                                "naver-vod.pstatic.net" in url
                                or "chzzk" in url
                                or "glive-clip" in url
                            ):
                                # Condition 3: URL length and query string check
                                # (EXACT same as original lines 367-368)
                                if len(url) < 1000 and "?" in url:
                                    media_urls.add(url)
                                    print(f"Found valid media URL: {url[:100]}...")

                except (json.JSONDecodeError, KeyError):
                    continue

            unique_urls = list(media_urls)

            if unique_urls:
                print(f"Found {len(unique_urls)} unique media URLs")
            else:
                print("No valid media URLs found")
                # Debug: show what URLs were captured
                print("Debug: Checking network responses...")
                video_related = []
                for log in logs:
                    try:
                        msg = json.loads(log["message"])
                        if msg["message"]["method"] == "Network.responseReceived":
                            resp = msg["message"]["params"]["response"]
                            url = resp["url"]
                            mime = resp.get("mimeType", "")
                            # Log URLs that might be video-related
                            if any(x in url.lower() for x in ["video", "media", "vod", "clip", "glive", "pstatic"]):
                                video_related.append(f"  {mime}: {url[:120]}")
                    except Exception:
                        pass
                if video_related:
                    print("Potentially relevant URLs:")
                    for v in video_related[:10]:
                        print(v)

            return unique_urls

        except Exception as e:
            print(f"Error extracting media URLs: {e}")
            import traceback
            traceback.print_exc()
            return []

    def download_media(
        self, media_url: str, filename: Optional[str] = None, clip_id: str = ""
    ) -> Optional[dict]:
        """
        Download media file from URL (same logic as original)
        """
        try:
            if not filename:
                parsed_url = urlparse(media_url)
                filename = os.path.basename(parsed_url.path)
                if not filename or "." not in filename:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"clip_{clip_id or timestamp}.mp4"

            # Ensure filename starts with clip_ for frontend compatibility
            if not filename.startswith("clip_"):
                filename = f"clip_{filename}"

            filepath = os.path.join(self.download_dir, filename)

            # Skip if file already exists
            if os.path.exists(filepath):
                file_size = os.path.getsize(filepath)
                print(f"File already exists: {filename}")
                return {
                    "filename": filename,
                    "filepath": filepath,
                    "file_size": file_size,
                    "already_existed": True,
                }

            print(f"Downloading: {filename}")

            # Same headers as original
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }

            response = requests.get(media_url, headers=headers, stream=True, timeout=60)
            response.raise_for_status()

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            file_size = os.path.getsize(filepath)
            print(f"Download complete: {filename} ({file_size} bytes)")

            return {
                "filename": filename,
                "filepath": filepath,
                "file_size": file_size,
                "already_existed": False,
            }

        except Exception as e:
            print(f"Download failed ({filename}): {e}")
            return None

    def collect_clips(
        self,
        max_clips: int = 10,
        filter_type: str = "ALL",
        order_type: str = "POPULAR",
        progress_callback=None,
    ) -> CollectionResult:
        """
        Main clip collection method (same logic as original)
        """
        start_time = time.time()
        result = CollectionResult(success=False)

        print("=== Chzzk Clip Collection Started ===")

        try:
            with WebDriverManager() as driver:
                # Get clip links
                if progress_callback:
                    progress_callback(0, max_clips, "Fetching clip list...")

                normalized_order = (order_type or "POPULAR").upper()

                # 기본 POPULAR 요청에도 RECENT를 합쳐 최신 클립이 함께 수집되도록 보강
                order_plan = [normalized_order]
                if normalized_order == "POPULAR":
                    order_plan.append("RECENT")
                elif normalized_order == "MIXED":
                    order_plan = ["RECENT", "POPULAR"]

                merged_entries: list[ClipInfo] = []
                seen_clip_ids: set[str] = set()

                for order in order_plan:
                    entries = self.get_clip_links(driver, filter_type, order)
                    for entry in entries:
                        clip_key = entry.clip_id or entry.url
                        if not clip_key or clip_key in seen_clip_ids:
                            continue
                        seen_clip_ids.add(clip_key)
                        merged_entries.append(entry)

                clip_entries = merged_entries

                if not clip_entries:
                    result.errors.append("No clip links found")
                    return result

                # Limit to max_clips
                clip_entries = clip_entries[:max_clips]
                result.total_attempted = len(clip_entries)

                for i, clip_info in enumerate(clip_entries, 1):
                    if progress_callback:
                        progress_callback(
                            i - 1,
                            len(clip_entries),
                            f"Processing clip {i}/{len(clip_entries)}: {clip_info.title[:30]}...",
                        )

                    print(f"\n[{i}/{len(clip_entries)}] Processing: {clip_info.title}")

                    # Check for existing download
                    existing = self._clip_already_downloaded(clip_info.clip_id)
                    if existing:
                        print(f"Already downloaded: {os.path.basename(existing)}")
                        result.collected_clips.append(
                            {
                                "clip_id": clip_info.clip_id,
                                "title": clip_info.title,
                                "filename": os.path.basename(existing),
                                "skipped": True,
                            }
                        )
                        continue

                    # Extract media URLs
                    media_urls = self.extract_media_urls(driver, clip_info.url)

                    if not media_urls:
                        result.errors.append(
                            f"No media URL found for clip: {clip_info.clip_id}"
                        )
                        continue

                    # Download first media URL (same as original)
                    media_url = media_urls[0]

                    safe_title = self._sanitize_filename(clip_info.title)
                    filename = f"clip_{clip_info.clip_id}_{safe_title}.mp4" if safe_title else f"clip_{clip_info.clip_id}.mp4"

                    download_result = self.download_media(
                        media_url, filename, clip_info.clip_id
                    )

                    if download_result:
                        result.clips_collected += 1
                        result.collected_clips.append(
                            {
                                "clip_id": clip_info.clip_id,
                                "title": clip_info.title,
                                "filename": download_result["filename"],
                                "file_size": download_result["file_size"],
                                "skipped": download_result.get("already_existed", False),
                            }
                        )
                    else:
                        result.errors.append(
                            f"Download failed for clip: {clip_info.clip_id}"
                        )

                    # Rate limiting (same as original: 2 seconds)
                    time.sleep(2)

                result.success = True

        except Exception as e:
            result.errors.append(f"Collection error: {str(e)}")
            print(f"Collection error: {e}")
            import traceback
            traceback.print_exc()

        result.duration_seconds = time.time() - start_time
        print(f"\n=== Collection Complete ===")
        print(f"Collected: {result.clips_collected}/{result.total_attempted}")
        print(f"Duration: {result.duration_seconds:.1f}s")

        if progress_callback:
            progress_callback(
                result.total_attempted,
                result.total_attempted,
                f"Complete: {result.clips_collected} clips collected",
            )

        return result
