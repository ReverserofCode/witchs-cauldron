"use client";

import { useEffect, useState } from "react";
import SectionCard from "./sectionCard";
import VideoCard from "./VideoCard";

type VideoItem = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
};

type ApiResponse = {
  moing: VideoItem[];
  fullmoing: VideoItem[];
};

type LoadState = "idle" | "loading" | "ready" | "error";

interface LatestYouTubeVideoCardProps {
  className?: string;
}

export default function LatestYouTubeVideoCard({ className }: LatestYouTubeVideoCardProps = {}) {
  const [state, setState] = useState<LoadState>("idle");
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      setState("loading");
      setError(null);

      try {
        const res = await fetch("/api/youTubePlayer", { headers: { accept: "application/json" } });
        if (!res.ok) {
          throw new Error(`영상 정보를 불러오지 못했습니다. (${res.status})`);
        }

        const data = (await res.json()) as ApiResponse;
        if (cancelled) {
          return;
        }

        const latest = selectLatestVideo(data);
        setVideo(latest);
        setState("ready");
      } catch (err) {
        if (!cancelled) {
          setState("error");
          setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
        }
      }
    }

    loadLatest();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SectionCard
      className={className}
      tone="neutral"
      eyebrow="Latest Upload"
      title="최신 유튜브 영상"
      description="마지막으로 올라온 영상을 빠르게 확인해 보세요."
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
          아직 수집된 영상이 없습니다. 잠시 후 다시 확인해주세요.
        </p>
      )}
    </SectionCard>
  );
}

function selectLatestVideo(response: ApiResponse): VideoItem | null {
  const allVideos = [
    ...(response.moing ?? []),
    ...(response.fullmoing ?? []),
  ];

  if (!allVideos.length) {
    return null;
  }

  return allVideos.reduce<VideoItem | null>((latest, candidate) => {
    if (!latest) {
      return candidate;
    }

    const latestTime = Date.parse(latest.publishedAt);
    const candidateTime = Date.parse(candidate.publishedAt);

    if (Number.isNaN(candidateTime)) {
      return latest;
    }

    if (Number.isNaN(latestTime) || candidateTime > latestTime) {
      return candidate;
    }

    return latest;
  }, null);
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
