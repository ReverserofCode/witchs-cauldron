"""
Job status API endpoints
"""

from fastapi import APIRouter, HTTPException

from app.schemas.job import Job
from app.services.job_manager import job_manager

router = APIRouter()


@router.get("/{job_id}", response_model=Job)
async def get_job_status(job_id: str):
    """
    Get status of a collection job

    Args:
        job_id: Job identifier from /api/clips/collect response
    """
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")

    return job


@router.get("", response_model=list[Job])
async def list_jobs(limit: int = 10):
    """
    List recent collection jobs

    Args:
        limit: Maximum number of jobs to return
    """
    return job_manager.list_jobs(limit=limit)
