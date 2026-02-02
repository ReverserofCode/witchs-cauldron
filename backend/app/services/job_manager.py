"""
Background job manager for clip collection tasks
"""

import asyncio
import threading
import uuid
from datetime import datetime
from typing import Callable, Optional

from app.schemas.job import Job, JobStatus
from app.services.clip_collector import ChzzkClipCollector


class JobManager:
    """Manages background clip collection jobs"""

    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._jobs: dict[str, Job] = {}
        self._running_job: Optional[str] = None

    def create_job(self, total_clips: int) -> Job:
        """
        Create a new collection job

        Args:
            total_clips: Number of clips to collect

        Returns:
            New Job object
        """
        job_id = str(uuid.uuid4())[:8]

        job = Job(
            job_id=job_id,
            status=JobStatus.PENDING,
            progress=0,
            message="Job created, waiting to start",
            clips_collected=0,
            total_clips=total_clips,
        )

        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 10) -> list[Job]:
        """List recent jobs"""
        sorted_jobs = sorted(
            self._jobs.values(),
            key=lambda j: j.started_at or datetime.min,
            reverse=True,
        )
        return sorted_jobs[:limit]

    def is_job_running(self) -> bool:
        """Check if any job is currently running"""
        return self._running_job is not None

    def run_collection_job(
        self,
        job_id: str,
        max_clips: int,
        filter_type: str,
        order_type: str,
    ) -> None:
        """
        Start a collection job in background thread

        Args:
            job_id: Job ID to run
            max_clips: Maximum clips to collect
            filter_type: Filter type for clips
            order_type: Order type for clips
        """
        job = self._jobs.get(job_id)
        if not job:
            return

        if self._running_job:
            job.status = JobStatus.FAILED
            job.error = "Another job is already running"
            return

        def run():
            try:
                self._running_job = job_id
                job.status = JobStatus.RUNNING
                job.started_at = datetime.now()
                job.message = "Starting clip collection..."

                collector = ChzzkClipCollector()

                def progress_callback(current: int, total: int, message: str):
                    job.clips_collected = current
                    job.total_clips = total
                    job.progress = int((current / total) * 100) if total > 0 else 0
                    job.message = message

                result = collector.collect_clips(
                    max_clips=max_clips,
                    filter_type=filter_type,
                    order_type=order_type,
                    progress_callback=progress_callback,
                )

                job.clips_collected = result.clips_collected
                job.completed_at = datetime.now()

                if result.success:
                    job.status = JobStatus.COMPLETED
                    job.progress = 100
                    job.message = f"Completed: {result.clips_collected} clips collected"
                else:
                    job.status = JobStatus.FAILED
                    job.error = "; ".join(result.errors) if result.errors else "Unknown error"

            except Exception as e:
                job.status = JobStatus.FAILED
                job.error = str(e)
                job.completed_at = datetime.now()

            finally:
                self._running_job = None

        thread = threading.Thread(target=run, daemon=True)
        thread.start()


# Global instance
job_manager = JobManager()
