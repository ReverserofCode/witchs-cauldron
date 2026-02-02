"""
Clips API endpoints
"""

from fastapi import APIRouter, HTTPException, Query

from app.schemas.clip import Clip, ClipList, CollectRequest, CollectResponse
from app.services.file_manager import FileManager
from app.services.job_manager import job_manager

router = APIRouter()
file_manager = FileManager()


@router.get("", response_model=ClipList)
async def list_clips(
    limit: int = Query(default=50, ge=1, le=100, description="Maximum clips to return"),
    offset: int = Query(default=0, ge=0, description="Number of clips to skip"),
):
    """
    List all available clips

    Returns clips sorted by modification time (newest first).
    Compatible with frontend ClipsViewer component.
    """
    clips, total = file_manager.list_clips(limit=limit, offset=offset)

    return ClipList(
        clips=clips,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{clip_id}", response_model=Clip)
async def get_clip(clip_id: str):
    """
    Get a specific clip by ID

    Args:
        clip_id: Clip identifier
    """
    clip = file_manager.get_clip(clip_id)

    if not clip:
        raise HTTPException(status_code=404, detail=f"Clip not found: {clip_id}")

    return clip


@router.delete("/{clip_id}")
async def delete_clip(clip_id: str):
    """
    Delete a clip by ID

    Args:
        clip_id: Clip identifier to delete
    """
    success = file_manager.delete_clip(clip_id)

    if not success:
        raise HTTPException(
            status_code=404, detail=f"Clip not found or could not be deleted: {clip_id}"
        )

    return {"status": "deleted", "clip_id": clip_id}


@router.post("/collect", response_model=CollectResponse)
async def collect_clips(request: CollectRequest):
    """
    Trigger clip collection from Chzzk

    Starts a background job to collect clips. Returns immediately with job ID.
    Use /api/jobs/{job_id} to check progress.
    """
    # Check if a job is already running
    if job_manager.is_job_running():
        raise HTTPException(
            status_code=409,
            detail="A collection job is already running. Please wait for it to complete.",
        )

    # Create and start job
    job = job_manager.create_job(total_clips=request.max_clips)

    # Start collection in background
    job_manager.run_collection_job(
        job_id=job.job_id,
        max_clips=request.max_clips,
        filter_type=request.filter_type,
        order_type=request.order_type,
    )

    # Estimate time: ~30-40 seconds per clip
    estimated_time = request.max_clips * 35

    return CollectResponse(
        job_id=job.job_id,
        message=f"Collection started for {request.max_clips} clips",
        estimated_time=estimated_time,
    )
