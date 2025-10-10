import VideoCard from "./VideoCard";
import type { VideoItem } from "../hooks/useYouTubeVideos";

interface YouTubeCategorySectionProps {
  title?: string;
  description?: string;
  videos: VideoItem[];
}

export default function YouTubeCategorySection({ title, description, videos }: YouTubeCategorySectionProps) {
  if (!videos.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <HeaderContent title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {videos.map((video) => (
          <VideoCard key={video.videoId} video={video} aspect="video" />
        ))}
      </div>
    </div>
  );
}

function HeaderContent({ title, description }: { title?: string; description?: string }) {
  if (!title && !description) {
    return (
      <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold text-purple-900/80 rounded-2xl border border-purple-200/60 bg-white/75">
        <span className="typography-small">모잉 채널 최신 영상</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-purple-700/70">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-500" aria-hidden />
          자동 정렬된 목록
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {title && (
        <h3 className="text-lg font-semibold text-purple-900/90 typography-heading">{title}</h3>
      )}
      {description && (
        <p className="text-xs text-purple-800/70 typography-small">{description}</p>
      )}
    </div>
  );
}
