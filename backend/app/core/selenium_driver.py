"""
Selenium WebDriver factory for Chrome with Xvfb virtual display

Uses Xvfb (X Virtual Framebuffer) instead of headless mode to ensure
video playback works correctly for media URL extraction.
See backend/FAILURE_LOG.md for why headless mode doesn't work.
"""

import os
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

from app.config import get_settings


def create_driver() -> webdriver.Chrome:
    """
    Create a Chrome WebDriver instance configured for Xvfb environment.

    IMPORTANT: This runs in non-headless mode with Xvfb virtual display.
    Headless mode doesn't properly initialize video players, preventing
    media URL extraction from network logs.

    Returns:
        webdriver.Chrome: Configured Chrome WebDriver instance
    """
    settings = get_settings()
    options = Options()

    # IMPORTANT: Do NOT use headless mode
    # Xvfb provides a virtual display that allows full video playback
    # The DISPLAY environment variable is set to :99 in Dockerfile
    if settings.headless and not settings.use_xvfb:
        options.add_argument("--headless=new")

    # Required for Docker/container environment
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")

    # Memory optimization
    options.add_argument("--disable-extensions")
    options.add_argument("--disable-infobars")
    options.add_argument("--disable-notifications")
    options.add_argument("--disable-popup-blocking")

    # Performance (but keep features needed for video)
    options.add_argument("--disable-background-networking")
    options.add_argument("--disable-default-apps")
    options.add_argument("--disable-sync")
    options.add_argument("--disable-translate")

    # Enable autoplay for video (needed for media URL extraction)
    options.add_argument("--autoplay-policy=no-user-gesture-required")

    # Window size for consistent rendering
    options.add_argument("--window-size=1920,1080")

    # Network logging for media URL extraction
    options.add_argument("--enable-logging")
    options.add_argument("--log-level=0")
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

    # Prefer configured chrome/chromedriver paths when they actually exist.
    # If not, fallback to Selenium Manager auto-resolution (downloads browser/driver if needed).
    chrome_binary = settings.chrome_binary
    chromedriver_path = settings.chromedriver_path

    chrome_exists = bool(chrome_binary) and os.path.exists(chrome_binary)
    chromedriver_exists = bool(chromedriver_path) and os.path.exists(chromedriver_path)

    if chrome_exists:
        options.binary_location = chrome_binary

    if chromedriver_exists:
        service = Service(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service, options=options)
    else:
        driver = webdriver.Chrome(options=options)

    driver.implicitly_wait(10)
    return driver


class WebDriverManager:
    """Context manager for WebDriver to ensure proper cleanup"""

    def __init__(self):
        self.driver = None

    def __enter__(self) -> webdriver.Chrome:
        self.driver = create_driver()
        return self.driver

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
        return False
