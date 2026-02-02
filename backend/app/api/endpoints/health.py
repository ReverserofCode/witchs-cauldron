"""
Health check endpoint
"""

import os
import shutil
from typing import Optional

from fastapi import APIRouter

from app.config import get_settings

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Health check endpoint for Docker/Kubernetes

    Returns system status including:
    - API status
    - Clips directory status
    - Disk space
    - Selenium availability
    """
    settings = get_settings()

    # Check clips directory
    clips_dir_exists = os.path.exists(settings.clips_dir)
    clips_count = 0
    if clips_dir_exists:
        try:
            clips_count = len(
                [
                    f
                    for f in os.listdir(settings.clips_dir)
                    if f.endswith((".mp4", ".webm", ".m4v"))
                ]
            )
        except Exception:
            pass

    # Check disk space
    disk_free: Optional[int] = None
    disk_total: Optional[int] = None
    try:
        disk_usage = shutil.disk_usage(settings.clips_dir)
        disk_free = disk_usage.free
        disk_total = disk_usage.total
    except Exception:
        pass

    # Check Selenium/Chrome availability
    chrome_available = os.path.exists(settings.chrome_binary)
    chromedriver_available = os.path.exists(settings.chromedriver_path)

    selenium_status = "available" if (chrome_available and chromedriver_available) else "unavailable"

    return {
        "status": "ok",
        "service": "witchs-cauldron-backend",
        "clips": {
            "directory": settings.clips_dir,
            "exists": clips_dir_exists,
            "count": clips_count,
        },
        "disk": {
            "free_bytes": disk_free,
            "total_bytes": disk_total,
            "free_gb": round(disk_free / (1024**3), 2) if disk_free else None,
        },
        "selenium": {
            "status": selenium_status,
            "chrome_path": settings.chrome_binary,
            "chromedriver_path": settings.chromedriver_path,
        },
    }
