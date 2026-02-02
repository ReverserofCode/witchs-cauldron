"""
Main API router that combines all endpoint routers
"""

from fastapi import APIRouter

from app.api.endpoints import clips, health, jobs

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, tags=["health"])
api_router.include_router(clips.router, prefix="/clips", tags=["clips"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
