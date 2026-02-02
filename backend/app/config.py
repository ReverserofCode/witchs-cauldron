"""
Application configuration using pydantic-settings
"""

from functools import lru_cache
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

    # Selenium settings
    chrome_binary: str = "/usr/bin/chromium"
    chromedriver_path: str = "/usr/bin/chromedriver"
    headless: bool = False  # Disabled - using Xvfb virtual display instead
    use_xvfb: bool = True   # Use Xvfb for video playback support

    # Collection settings
    max_clips_per_collection: int = 10
    collection_timeout: int = 300  # 5 minutes

    # API settings
    api_prefix: str = "/api"
    cors_origins: list[str] = ["http://localhost:3000", "http://frontend:3000"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
