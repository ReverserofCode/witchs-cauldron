"use client";
import { useEffect, useState } from "react";
import VideoCard from "./VideoCard";

interface ShortItem {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt?: string;
  channelTitle?: string;
  url: string;
}

export default function YouTubeShortsSection() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/youtubeShorts")
      .then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch shorts");
        }
        return res.json();
      })
      .then((data: ShortItem[]) => {
        setShorts(Array.isArray(data) ? data.slice(0, 5) : []);
        setLoading(false);
      })
      .catch(() => {
        setError("팬 채널 영상을 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  return (
    <section className="mb-12 space-y-8 youTubeShorts">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-ink">최신 팬 채널 유튜브</h2>
        <p className="text-sm text-ink/70">
          팬 채널에서 제작한 모잉 키리누키 채널 영상을 빠르게 확인해 보세요.
        </p>
      </div>

      {loading && <div className="text-sm text-ink/70">불러오는 중...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {shorts.length === 0 && (
            <div className="text-sm text-ink/60">표시할 쇼츠가 없습니다.</div>
          )}

          {shorts.map((short) => (
            <VideoCard key={short.videoId} video={short} aspect="short" />
          ))}
        </div>
      )}
    </section>
  );
}
