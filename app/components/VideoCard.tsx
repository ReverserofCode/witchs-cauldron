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
  };
  aspect?: "video" | "short";
}

export default function VideoCard({ video, aspect = "video" }: VideoCardProps) {
  const { thumbnail, title, url, channelTitle, publishedAt } = video;
  const aspectClass = aspect === "short" ? "aspect-[9/16]" : "aspect-video";
  const fallbackSrc = "/mainPage/SDCharacter.png";
  const displayChannel = channelTitle ?? "모잉 팬 채널";
  const displayDate = publishedAt ? new Date(publishedAt).toLocaleDateString("ko-KR") : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-sm backdrop-blur transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
      title={title}
    >
      <div className="relative w-full overflow-hidden">
        {thumbnail ? (
          <img src={thumbnail} alt={title} loading="lazy" className={`object-cover w-full ${aspectClass}`} />
        ) : (
          <Image
            src={fallbackSrc}
            alt={title}
            width={320}
            height={aspect === "short" ? 568 : 180}
            className={`object-cover w-full ${aspectClass}`}
          />
        )}
      </div>
      <div className="flex flex-col flex-1 gap-2 p-3">
        <p className="text-sm font-semibold text-ink line-clamp-2 typography-body">{title}</p>
        <div className="mt-auto text-[11px] text-ink/60 typography-small">
          <span className="block">{displayChannel}</span>
          {displayDate && <span>{displayDate}</span>}
        </div>
      </div>
    </a>
  );
}
