"""
Application configuration using pydantic-settings
"""

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # App settings
    app_name: str = "Witchs Cauldron Backend"
    debug: bool = False

    # Chzzk settings
    chzzk_channel_id: str = "1d333ff175b4db5bd06f87a88579ec1e"

    # Paths
    clips_dir: str = "/app/shared/clips"
    frontend_clips_dir: str = ""  # Optional mirror path (e.g., ../frontend/public/clips)

    # Selenium settings
    chrome_binary: str = "/usr/bin/chromium"
    chromedriver_path: str = "/usr/bin/chromedriver"
    headless: bool = False  # Disabled - using Xvfb virtual display instead
    use_xvfb: bool = True   # Use Xvfb for video playback support
    selenium_page_load_timeout: int = Field(default=45, ge=5)
    selenium_script_timeout: int = Field(default=30, ge=5)

    # Collection settings
    max_clips_per_collection: int = 10
    collection_timeout: int = 300  # 5 minutes

    # Scheduled clip collection
    clip_auto_collect_enabled: bool = False
    clip_auto_collect_interval_minutes: int = Field(default=720, ge=5)
    clip_auto_collect_run_on_startup: bool = False
    clip_auto_collect_startup_delay_seconds: int = Field(default=60, ge=0)
    clip_auto_collect_max_clips: int = Field(default=2, ge=1, le=10)
    clip_auto_collect_filter_type: str = "ALL"
    clip_auto_collect_order_type: str = "RECENT"
    clip_auto_collect_failure_cooldown_minutes: int = Field(default=720, ge=0)

    # API settings
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000", "http://frontend:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
