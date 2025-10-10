"use client";

import { useEffect, useMemo, useState } from "react";
import SectionCard from "./sectionCard";
import VideoCard from "./VideoCard";

type TopVideo = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  viewCount: number | null;
};

type LoadState = "idle" | "loading" | "ready" | "error";

interface TopOfficialYouTubeVideoCardProps {
  className?: string;
}

export default function TopOfficialYouTubeVideoCard({ className }: TopOfficialYouTubeVideoCardProps = {}) {
  const [state, setState] = useState<LoadState>("idle");
  const [video, setVideo] = useState<TopVideo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const monthLabel = usePreviousMonthLabel();

  useEffect(() => {
    let cancelled = false;

    async function loadTop() {
      setState("loading");
      setError(null);

      try {
        const res = await fetch("/api/youTubePlayer/topOfficial", { headers: { accept: "application/json" } });
        if (!res.ok) {
          throw new Error(`영상 정보를 불러오지 못했습니다. (${res.status})`);
        }

        const data = (await res.json()) as { video: TopVideo | null };
        if (cancelled) {
          return;
        }

        setVideo(data.video ?? null);
        setState("ready");
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        }
      }
    }

    loadTop();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      className={className}
      tone="lavender"
      eyebrow="Most Viewed"
      title="지난달 최다 조회수 영상"
      description={`지난 달(${monthLabel}) 조회수 1위 영상을 확인하세요.`}
      bodyClassName="gap-3"
    >
      {state === "loading" && <LoadingState />}

      {state === "error" && (
        <p className="p-4 text-sm text-red-600 border rounded-2xl border-red-200/60 bg-red-50/90 typography-body">
          {error ?? "유튜브 영상을 불러오지 못했습니다."}
        </p>
      )}

      {state === "ready" && video && <VideoCard video={video} />}

      {state === "ready" && !video && (
        <p className="p-4 text-sm border rounded-2xl border-purple-200/60 bg-white/85 text-purple-900/80 typography-body">
          지난 달에는 모잉 공식/다시보기 채널에서 집계된 영상이 없습니다. 잠시 후 다시 확인해주세요.
        </p>
      )}
    </SectionCard>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="w-full h-40 animate-pulse rounded-2xl bg-purple-200/50" />
      <div className="space-y-2">
        <div className="w-3/4 h-4 rounded-full animate-pulse bg-purple-200/70" />
        <div className="w-1/2 h-3 rounded-full animate-pulse bg-purple-200/60" />
      </div>
    </div>
  );
}

function usePreviousMonthLabel(): string {
  return useMemo(() => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return new Intl.DateTimeFormat("ko-KR", { month: "long" }).format(prev);
  }, []);
}
