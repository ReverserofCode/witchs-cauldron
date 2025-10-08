"use client";

import { useEffect, useMemo, useState } from "react";
import VideoCard from "./VideoCard";

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
    <section className="mb-12 space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-ink">최신 유튜브 영상</h2>
        <p className="text-sm text-ink/70">
          모잉 공식 채널과 다시보기 채널의 최신 영상들을 확인해 보세요.
        </p>
      </div>

      {loading && <div className="text-sm text-ink/70">불러오는 중...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      {!loading && !error && videos && (
        <div className="space-y-10">
          {sections.map(({ key, title, description }) => {
            const items = videos?.[key] ?? [];
            if (!items.length) {
              return null;
            }
            return (
              <div key={key} className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-ink">{title}</h3>
                  <p className="text-xs text-ink/60">{description}</p>
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
    </section>
  );
}
