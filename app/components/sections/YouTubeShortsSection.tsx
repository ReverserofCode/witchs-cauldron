"use client";

import { useEffect, useState } from "react";
import VideoCard from "../cards/VideoCard";
import SectionCard from "../cards/SectionCard";

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
        setShorts(Array.isArray(data) ? data.slice(0, 4) : []);
        setLoading(false);
      })
      .catch(() => {
        setError("팬 채널 영상을 불러오지 못했습니다.");
        setLoading(false);
      });
  }, []);

  return (
    <SectionCard
      tone="neutral"
      eyebrow="Community Clips"
      title="최신 팬 채널 유튜브"
      description="팬 채널에서 제작한 모잉 키리누키 채널 영상을 빠르게 확인해 보세요."
      bodyClassName="space-y-4"
    >
      {loading && <div className="text-sm text-purple-900/70 typography-body">불러오는 중...</div>}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-sm text-red-600 typography-body">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shorts.length === 0 && (
            <div className="rounded-xl border border-dashed border-purple-200/60 bg-white/70 p-4 text-sm text-purple-800/70 typography-body">
              표시할 쇼츠가 없습니다.
            </div>
          )}

          {shorts.map((short) => (
            <VideoCard key={short.videoId} video={short} aspect="short" />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
