"""
Background job manager for clip collection tasks
"""

import multiprocessing as mp
import queue
import threading
import time
import uuid
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.schemas.job import Job, JobStatus
from app.services.clip_collector import ChzzkClipCollector


def _run_collection_worker(
    max_clips: int,
    filter_type: str,
    order_type: str,
    progress_queue,
    result_queue,
) -> None:
    """Run Selenium collection in a child process so hung browser calls can be killed."""
    try:
        collector = ChzzkClipCollector()

        def progress_callback(current: int, total: int, message: str):
            progress_queue.put(
                {
                    "current": current,
                    "total": total,
                    "message": message,
                }
            )

        result = collector.collect_clips(
            max_clips=max_clips,
            filter_type=filter_type,
            order_type=order_type,
            progress_callback=progress_callback,
        )
        result_queue.put(
            {
                "success": result.success,
                "clips_collected": result.clips_collected,
                "clips_skipped": result.clips_skipped,
                "errors": result.errors,
            }
        )
    except Exception as e:
        result_queue.put(
            {
                "success": False,
                "clips_collected": 0,
                "clips_skipped": 0,
                "errors": [str(e)],
            }
        )


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
        self._state_lock = threading.Lock()

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
            clips_skipped=0,
            total_clips=total_clips,
        )

        with self._state_lock:
            self._jobs[job_id] = job

        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        """Get job by ID"""
        with self._state_lock:
            return self._jobs.get(job_id)

    def list_jobs(self, limit: int = 10) -> list[Job]:
        """List recent jobs"""
        with self._state_lock:
            jobs = list(self._jobs.values())

        sorted_jobs = sorted(
            jobs,
            key=lambda j: j.started_at or datetime.min,
            reverse=True,
        )
        return sorted_jobs[:limit]

    def is_job_running(self) -> bool:
        """Check if any job is currently running"""
        with self._state_lock:
            return self._running_job is not None

    def run_collection_job(
        self,
        job_id: str,
        max_clips: int,
        filter_type: str,
        order_type: str,
    ) -> bool:
        """
        Start a collection job in background thread

        Args:
            job_id: Job ID to run
            max_clips: Maximum clips to collect
            filter_type: Filter type for clips
            order_type: Order type for clips
        """
        with self._state_lock:
            job = self._jobs.get(job_id)
            if not job:
                return False

            if self._running_job:
                job.status = JobStatus.FAILED
                job.error = "Another job is already running"
                job.completed_at = datetime.now()
                return False

            self._running_job = job_id

        def run():
            try:
                job.status = JobStatus.RUNNING
                job.started_at = datetime.now()
                job.message = "Starting clip collection..."

                settings = get_settings()
                progress_queue = mp.Queue()
                result_queue = mp.Queue()
                process = mp.Process(
                    target=_run_collection_worker,
                    args=(
                        max_clips,
                        filter_type,
                        order_type,
                        progress_queue,
                        result_queue,
                    ),
                )

                process.start()
                deadline = time.monotonic() + settings.collection_timeout

                while process.is_alive() and time.monotonic() < deadline:
                    try:
                        update = progress_queue.get(timeout=1)
                    except queue.Empty:
                        continue

                    total = update.get("total", job.total_clips)
                    current = update.get("current", 0)
                    job.total_clips = total
                    job.progress = int((current / total) * 100) if total > 0 else 0
                    job.message = update.get("message", job.message)

                while True:
                    try:
                        update = progress_queue.get_nowait()
                    except queue.Empty:
                        break

                    total = update.get("total", job.total_clips)
                    current = update.get("current", 0)
                    job.total_clips = total
                    job.progress = int((current / total) * 100) if total > 0 else 0
                    job.message = update.get("message", job.message)

                if process.is_alive():
                    process.terminate()
                    process.join(timeout=10)
                    if process.is_alive():
                        process.kill()
                        process.join(timeout=5)

                    job.status = JobStatus.FAILED
                    job.error = (
                        f"Collection timed out after {settings.collection_timeout}s"
                        f" while: {job.message}"
                    )
                    job.completed_at = datetime.now()
                    return

                process.join()
                try:
                    result = result_queue.get_nowait()
                except queue.Empty:
                    result = {
                        "success": False,
                        "clips_collected": 0,
                        "clips_skipped": 0,
                        "errors": ["Collection worker exited without a result"],
                    }

                job.clips_collected = result["clips_collected"]
                job.clips_skipped = result["clips_skipped"]
                job.completed_at = datetime.now()

                if result["success"]:
                    job.status = JobStatus.COMPLETED
                    job.progress = 100
                    failed_count = len(result["errors"])
                    warning_suffix = f", {failed_count} failed" if failed_count else ""
                    job.message = (
                        f"Completed: {result['clips_collected']} clips collected"
                        f", {result['clips_skipped']} skipped(existing)"
                        f"{warning_suffix}"
                    )
                else:
                    job.status = JobStatus.FAILED
                    errors = result["errors"]
                    job.error = "; ".join(errors) if errors else "Unknown error"

            except Exception as e:
                job.status = JobStatus.FAILED
                job.error = str(e)
                job.completed_at = datetime.now()

            finally:
                with self._state_lock:
                    if self._running_job == job_id:
                        self._running_job = None

        thread = threading.Thread(target=run, daemon=True)
        thread.start()
        return True


# Global instance
job_manager = JobManager()
