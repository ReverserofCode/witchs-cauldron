"""
Job status schemas
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Job status enum"""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class Job(BaseModel):
    """Job status schema"""

    job_id: str = Field(..., description="Unique job identifier")
    status: JobStatus = Field(..., description="Current job status")
    progress: int = Field(default=0, ge=0, le=100, description="Progress percentage")
    message: str = Field(default="", description="Status message")
    clips_collected: int = Field(default=0, description="Number of clips collected so far")
    total_clips: int = Field(default=0, description="Total clips to collect")
    started_at: Optional[datetime] = Field(None, description="Job start time")
    completed_at: Optional[datetime] = Field(None, description="Job completion time")
    error: Optional[str] = Field(None, description="Error message if failed")

    class Config:
        from_attributes = True
