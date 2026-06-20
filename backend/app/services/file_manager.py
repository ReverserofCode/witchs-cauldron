"""
File manager service for clip file operations
"""

import os
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.schemas.clip import Clip


class FileManager:
    """Manages clip files in the shared clips directory"""

    def __init__(self, clips_dir: Optional[str] = None):
        settings = get_settings()
        self.clips_dir = clips_dir or settings.clips_dir
        os.makedirs(self.clips_dir, exist_ok=True)

    def list_clips(self, limit: int = 50, offset: int = 0) -> tuple[list[Clip], int]:
        """
        List all clip files in the directory

        Args:
            limit: Maximum number of clips to return
            offset: Number of clips to skip

        Returns:
            Tuple of (list of Clip objects, total count)
        """
        clips = []
        video_extensions = (".mp4", ".webm", ".m4v")

        try:
            all_files = sorted(
                [
                    f
                    for f in os.listdir(self.clips_dir)
                    if f.lower().endswith(video_extensions)
                ],
                key=lambda x: os.path.getmtime(os.path.join(self.clips_dir, x)),
                reverse=True,  # Newest first
            )

            total = len(all_files)
            selected_files = all_files[offset : offset + limit]

            for filename in selected_files:
                filepath = os.path.join(self.clips_dir, filename)
                clip = self._file_to_clip(filename, filepath)
                if clip:
                    clips.append(clip)

            return clips, total

        except FileNotFoundError:
            return [], 0

    def get_clip(self, clip_id: str) -> Optional[Clip]:
        """
        Get a specific clip by ID

        Args:
            clip_id: Clip ID to find

        Returns:
            Clip object if found, None otherwise
        """
        try:
            for filename in os.listdir(self.clips_dir):
                if clip_id in filename:
                    filepath = os.path.join(self.clips_dir, filename)
                    return self._file_to_clip(filename, filepath)
        except FileNotFoundError:
            pass
        return None

    def delete_clip(self, clip_id: str) -> bool:
        """
        Delete a clip file by ID

        Args:
            clip_id: Clip ID to delete

        Returns:
            True if deleted, False otherwise
        """
        try:
            for filename in os.listdir(self.clips_dir):
                if clip_id in filename:
                    filepath = os.path.join(self.clips_dir, filename)
                    os.remove(filepath)
                    return True
        except (FileNotFoundError, PermissionError):
            pass
        return False

    def _file_to_clip(self, filename: str, filepath: str) -> Optional[Clip]:
        """
        Convert a file to a Clip schema object

        Args:
            filename: Name of the file
            filepath: Full path to the file

        Returns:
            Clip object
        """
        try:
            stat = os.stat(filepath)

            # Extract clip_id from filename (e.g., clip_ABC123_title.mp4 -> ABC123)
            clip_id = self._extract_clip_id(filename)

            # Extract title from filename
            title = self._extract_title(filename)

            return Clip(
                id=clip_id,
                clip_id=clip_id,
                title=title,
                src=f"/clips/{filename}",  # Frontend-compatible path
                filename=filename,
                file_size=stat.st_size,
                created_at=datetime.fromtimestamp(stat.st_mtime),
            )
        except Exception:
            return None

    def _extract_clip_id(self, filename: str) -> str:
        """Extract clip ID from filename"""
        # Pattern: clip_CLIPID_title.mp4 or clip_CLIPID.mp4
        name = filename.rsplit(".", 1)[0]  # Remove extension

        if name.startswith("clip_"):
            parts = name[5:].split("_", 1)  # Remove 'clip_' prefix
            if parts:
                return parts[0]

        return name

    def _extract_title(self, filename: str) -> str:
        """Extract title from filename"""
        name = filename.rsplit(".", 1)[0]  # Remove extension

        if name.startswith("clip_"):
            parts = name[5:].split("_", 1)  # Remove 'clip_' prefix
            if len(parts) > 1:
                return parts[1].replace("_", " ")
            return "치지직 하이라이트"

        return name
