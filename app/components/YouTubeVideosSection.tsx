"use client";

import { useEffect, useMemo, useState } from "react";
import VideoCard from "./VideoCard";
import SectionCard from "./sectionCard";

interface VideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
}

interface ApiResponse {
  moing: VideoItem[];
  fullmoing: VideoItem[];
}

export default function YouTubeVideosSection() {
  const [videos, setVideos] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/youTubePlayer")
      .then((res) => {
        if (!res.ok) {
          throw new Error("failed-to-fetch");
        }
        return res.json();
      })
      .then((data: ApiResponse) => {
        setVideos(data);
        setLoading(false);
      })
      .catch(() => {
        setError("유튜브 영상을 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  const sections = useMemo(
    () => [
      {
        key: "moing" as const,
        title: "모잉 공식 채널 최신 영상",
        description: "공식 채널(@moing)의 최신 업로드",
      },
      {
        key: "fullmoing" as const,
        title: "모잉 다시보기 (Full) 최신 영상",
        description: "1시간 이상 길이의 다시보기(@fullmoing)",
      },
    ],
    []
  );

  return (
    <SectionCard
      tone="neutral"
      eyebrow="YouTube Hub"
      title="최신 유튜브 영상"
      description="모잉 공식 채널과 다시보기 채널의 최신 영상들을 확인해 보세요."
      bodyClassName="space-y-6"
    >
      {loading && <div className="text-sm text-purple-900/70">불러오는 중...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && videos && (
        <div className="space-y-8">
          {sections.map(({ key, title, description }) => {
            const items = videos?.[key] ?? [];
            if (!items.length) {
              return null;
            }
            return (
              <div key={key} className="space-y-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold text-purple-900/90">{title}</h3>
                  <p className="text-xs text-purple-800/70">{description}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {items.map((video) => (
                    <VideoCard key={video.videoId} video={video} aspect="video" />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
