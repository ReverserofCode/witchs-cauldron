"""
Clip data schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ClipBase(BaseModel):
    """Base clip schema"""

    title: str = Field(..., description="Clip title")
    clip_id: str = Field(..., description="Unique clip identifier from Chzzk")


class ClipCreate(ClipBase):
    """Schema for creating a new clip"""

    source_url: str = Field(..., description="Original Chzzk clip URL")


class Clip(ClipBase):
    """Full clip schema with all fields"""

    id: str = Field(..., description="Internal clip ID")
    src: str = Field(..., description="Local file path for frontend (/clips/clip_xxx.mp4)")
    filename: str = Field(..., description="Actual filename")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    created_at: datetime = Field(default_factory=datetime.now, description="Download timestamp")

    class Config:
        from_attributes = True


class ClipList(BaseModel):
    """Response schema for clip list"""

    clips: list[Clip]
    total: int
    limit: int
    offset: int


class CollectRequest(BaseModel):
    """Request schema for clip collection"""

    max_clips: int = Field(default=1, ge=1, le=2, description="Maximum clips to collect")
    filter_type: str = Field(default="ALL", description="Filter type: ALL, WEEKLY, MONTHLY")
    order_type: str = Field(
        default="POPULAR",
        description="Order type: POPULAR(RECENT 포함), RECENT, MIXED",
    )


class CollectResponse(BaseModel):
    """Response schema for clip collection request"""

    job_id: str = Field(..., description="Background job ID")
    message: str = Field(..., description="Status message")
    estimated_time: Optional[int] = Field(None, description="Estimated time in seconds")
