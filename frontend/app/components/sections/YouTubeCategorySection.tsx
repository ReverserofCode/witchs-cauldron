import { VideoCard } from '@/app/components/cards';
import type { VideoItem } from '@/app/hooks/useYouTubeVideos';

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
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.videoId} video={video} aspect="video" />
        ))}
      </div>
    </div>
  );
}

function HeaderContent({ title, description }: { title?: string; description?: string }) {
  if (!title && !description) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {title && <h3 className="text-lg font-semibold text-purple-900/90 typography-heading">{title}</h3>}
      {description && <p className="text-xs text-purple-800/70 typography-small">{description}</p>}
    </div>
  );
}
