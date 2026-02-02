"use client";

import { useEffect, useState } from "react";

export interface VideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
}

export interface YouTubeVideosResponse {
  moing: VideoItem[];
  fullmoing: VideoItem[];
  moingFan: VideoItem[];
}

type LoadState = "idle" | "loading" | "ready" | "error";

let cachedData: YouTubeVideosResponse | null = null;
let cachedError: string | null = null;
let cachedAt: number | null = null;
let inflightRequest: Promise<YouTubeVideosResponse> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheFresh(): boolean {
  return (
    cachedData !== null &&
    cachedAt !== null &&
    Date.now() - cachedAt < CACHE_TTL_MS
  );
}

async function fetchYouTubeVideos(): Promise<YouTubeVideosResponse> {
  const res = await fetch("/api/youTubePlayer", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`failed-to-fetch:${res.status}`);
  }

  return (await res.json()) as YouTubeVideosResponse;
}

interface UseYouTubeVideosResult {
  data: YouTubeVideosResponse | null;
  error: string | null;
  status: LoadState;
}

export function useYouTubeVideos(): UseYouTubeVideosResult {
  const [data, setData] = useState<YouTubeVideosResponse | null>(
    isCacheFresh() ? cachedData : null
  );
  const [error, setError] = useState<string | null>(cachedError);
  const [status, setStatus] = useState<LoadState>(() => {
    if (isCacheFresh()) {
      return "ready";
    }
    if (cachedError) {
      return "error";
    }
    return "idle";
  });

  useEffect(() => {
    if (isCacheFresh()) {
      setData(cachedData);
      setStatus("ready");
      return;
    }

    if (cachedData) {
      cachedData = null;
      cachedAt = null;
      setData(null);
    }

    if (cachedError) {
      cachedError = null;
      setError(null);
    }

    let cancelled = false;

    async function load() {
      setStatus("loading");

      try {
        if (!inflightRequest) {
          inflightRequest = fetchYouTubeVideos();
        }

        const result = await inflightRequest;

        if (cancelled) {
          return;
        }

        cachedData = result;
        cachedAt = Date.now();
        inflightRequest = null;
        setData(result);
        setStatus("ready");
      } catch (err) {
        if (cancelled) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "알 수 없는 오류가 발생했습니다.";
        cachedError = message;
        cachedAt = null;
        inflightRequest = null;
        setError(message);
        setStatus("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, error, status };
}

export function resetYouTubeVideosCache(): void {
  cachedData = null;
  cachedError = null;
  cachedAt = null;
  inflightRequest = null;
}
