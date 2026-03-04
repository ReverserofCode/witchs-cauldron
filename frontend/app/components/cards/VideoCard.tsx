"use client";

import Image from "next/image";

interface VideoCardProps {
  video: {
    videoId: string;
    title: string;
    thumbnail?: string;
    url: string;
    channelTitle?: string;
    publishedAt?: string;
    viewCount?: number | null;
  };
  aspect?: "video" | "short";
}

export default function VideoCard({ video, aspect = "video" }: VideoCardProps) {
  const { thumbnail, title, url, channelTitle, publishedAt, viewCount } = video;
  const aspectClass = aspect === "short" ? "aspect-[9/16]" : "aspect-video";
  const fallbackSrc = "/mainPage/SDCharacter.png";
  const displayChannel = channelTitle ?? "모잉 팬 채널";
  const displayDate = publishedAt ? new Date(publishedAt).toLocaleDateString("ko-KR") : null;
  const displayViews =
    typeof viewCount === "number" && Number.isFinite(viewCount)
      ? new Intl.NumberFormat("ko-KR").format(viewCount)
      : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-purple-200/40 bg-gradient-to-b from-purple-50/50 to-white shadow-md transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-purple-200/40 hover:border-purple-300/60"
      title={title}
    >
      {/* Thumbnail Container */}
      <div className="relative w-full overflow-hidden">
        {/* Thumbnail Image with Zoom Effect */}
        <div className={`relative w-full ${aspectClass}`}>
          <Image
            src={thumbnail || fallbackSrc}
            alt={title}
            fill
            unoptimized
            sizes={aspect === "short" ? "(max-width: 768px) 60vw, 320px" : "(max-width: 768px) 100vw, 480px"}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
          />
        </div>

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-300 group-hover:bg-black/20">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg opacity-0 scale-75 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100">
            <svg
              className="h-6 w-6 text-purple-600 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>

        {/* Duration/Views Badge */}
        {displayViews && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-medium text-white backdrop-blur-sm">
            {displayViews}회
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="flex flex-col flex-1 gap-1.5 p-3 bg-gradient-to-b from-white to-purple-50/30">
        <p className="text-sm font-semibold text-purple-950 line-clamp-2 leading-snug group-hover:text-purple-700 transition-colors">
          {title}
        </p>
        <div className="mt-auto flex items-center gap-2 text-[11px] text-purple-700/60">
          <span className="font-medium">{displayChannel}</span>
          {displayDate && (
            <>
              <span className="h-1 w-1 rounded-full bg-purple-400/50" />
              <span>{displayDate}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}
