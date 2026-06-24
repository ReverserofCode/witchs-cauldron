"""
Scheduled Chzzk clip collection.

The scheduler runs inside the backend process and reuses the existing job
manager, so manual and automatic collection share the same duplicate guard.
"""

import threading
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import get_settings
from app.schemas.job import JobStatus
from app.services.job_manager import job_manager


class ClipCollectionScheduler:
    """Starts periodic clip collection jobs when enabled by environment."""

    JOB_ID = "clip-auto-collect"

    def __init__(self):
        self._scheduler: Optional[BackgroundScheduler] = None
        self._lock = threading.Lock()
        self._last_job_id: Optional[str] = None
        self._last_run_at: Optional[datetime] = None
        self._last_skip_reason: Optional[str] = None

    def start(self) -> None:
        settings = get_settings()

        with self._lock:
            if self._scheduler and self._scheduler.running:
                return

            if not settings.clip_auto_collect_enabled:
                self._last_skip_reason = "disabled"
                print("Clip auto collection scheduler disabled")
                return

            scheduler = BackgroundScheduler()
            job_kwargs = {
                "func": self.trigger_collection,
                "trigger": "interval",
                "minutes": settings.clip_auto_collect_interval_minutes,
                "id": self.JOB_ID,
                "name": "Scheduled Chzzk clip collection",
                "kwargs": {"reason": "scheduled"},
                "max_instances": 1,
                "coalesce": True,
                "replace_existing": True,
            }

            if settings.clip_auto_collect_run_on_startup:
                delay = settings.clip_auto_collect_startup_delay_seconds
                job_kwargs["next_run_time"] = datetime.now() + timedelta(seconds=delay)

            scheduler.add_job(**job_kwargs)
            scheduler.start()
            self._scheduler = scheduler

        print(
            "Clip auto collection scheduler started "
            f"(interval={settings.clip_auto_collect_interval_minutes}m, "
            f"startup={settings.clip_auto_collect_run_on_startup})"
        )

    def shutdown(self) -> None:
        with self._lock:
            scheduler = self._scheduler
            self._scheduler = None

        if scheduler and scheduler.running:
            scheduler.shutdown(wait=False)
            print("Clip auto collection scheduler stopped")

    def trigger_collection(self, reason: str = "scheduled") -> Optional[str]:
        settings = get_settings()

        if not settings.clip_auto_collect_enabled:
            self._record_skip("disabled")
            return None

        if job_manager.is_job_running():
            self._record_skip("collection job already running")
            return None

        cooldown_skip_reason = self._recent_failure_skip_reason()
        if cooldown_skip_reason:
            self._record_skip(cooldown_skip_reason)
            return None

        max_clips = min(
            settings.clip_auto_collect_max_clips,
            settings.max_clips_per_collection,
            10,
        )

        job = job_manager.create_job(total_clips=max_clips)
        job.message = f"Queued by clip automation ({reason})"

        started = job_manager.run_collection_job(
            job_id=job.job_id,
            max_clips=max_clips,
            filter_type=settings.clip_auto_collect_filter_type,
            order_type=settings.clip_auto_collect_order_type,
        )

        if not started:
            self._record_skip("collection job already running")
            return None

        with self._lock:
            self._last_job_id = job.job_id
            self._last_run_at = datetime.now()
            self._last_skip_reason = None

        print(f"Scheduled clip collection started: job_id={job.job_id}")
        return job.job_id

    def get_status(self) -> dict:
        settings = get_settings()

        with self._lock:
            scheduler = self._scheduler
            last_job_id = self._last_job_id
            last_run_at = self._last_run_at
            last_skip_reason = self._last_skip_reason

        next_run_at = None
        if scheduler and scheduler.running:
            scheduled_job = scheduler.get_job(self.JOB_ID)
            if scheduled_job and scheduled_job.next_run_time:
                next_run_at = scheduled_job.next_run_time.isoformat()

        failure_cooldown_until = self._failure_cooldown_until()

        return {
            "enabled": settings.clip_auto_collect_enabled,
            "running": bool(scheduler and scheduler.running),
            "interval_minutes": settings.clip_auto_collect_interval_minutes,
            "run_on_startup": settings.clip_auto_collect_run_on_startup,
            "startup_delay_seconds": settings.clip_auto_collect_startup_delay_seconds,
            "max_clips": min(
                settings.clip_auto_collect_max_clips,
                settings.max_clips_per_collection,
                10,
            ),
            "filter_type": settings.clip_auto_collect_filter_type,
            "order_type": settings.clip_auto_collect_order_type,
            "failure_cooldown_minutes": settings.clip_auto_collect_failure_cooldown_minutes,
            "failure_cooldown_until": failure_cooldown_until.isoformat()
            if failure_cooldown_until
            else None,
            "last_job_id": last_job_id,
            "last_run_at": last_run_at.isoformat() if last_run_at else None,
            "last_skip_reason": last_skip_reason,
            "next_run_at": next_run_at,
        }

    def _failure_cooldown_until(self) -> Optional[datetime]:
        settings = get_settings()
        cooldown_minutes = settings.clip_auto_collect_failure_cooldown_minutes
        if cooldown_minutes <= 0:
            return None

        with self._lock:
            last_job_id = self._last_job_id

        if not last_job_id:
            return None

        job = job_manager.get_job(last_job_id)
        if (
            not job
            or job.status != JobStatus.FAILED
            or not job.completed_at
        ):
            return None

        cooldown_until = job.completed_at + timedelta(minutes=cooldown_minutes)
        if cooldown_until <= datetime.now():
            return None

        return cooldown_until

    def _recent_failure_skip_reason(self) -> Optional[str]:
        cooldown_until = self._failure_cooldown_until()
        if not cooldown_until:
            return None

        return f"recent collection failure cooldown active until {cooldown_until.isoformat()}"

    def _record_skip(self, reason: str) -> None:
        with self._lock:
            self._last_skip_reason = reason
        print(f"Scheduled clip collection skipped: {reason}")


clip_scheduler = ClipCollectionScheduler()
