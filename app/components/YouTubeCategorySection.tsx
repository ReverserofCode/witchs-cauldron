import VideoCard from "./VideoCard";
import type { VideoItem } from "../hooks/useYouTubeVideos";

interface YouTubeCategorySectionProps {
  title: string;
  description: string;
  videos: VideoItem[];
}

export default function YouTubeCategorySection({ title, description, videos }: YouTubeCategorySectionProps) {
  if (!videos.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-purple-900/90 typography-heading">{title}</h3>
        <p className="text-xs text-purple-800/70 typography-small">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.videoId} video={video} aspect="video" />
        ))}
      </div>
    </div>
  );
}
