"use client";

import { useEffect, useState } from "react";

export interface TopVideoItem {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  viewCount: number | null;
}

export interface TopOfficialVideosResponse {
  moing: TopVideoItem | null;
  fullmoing: TopVideoItem | null;
}

type LoadState = "idle" | "loading" | "ready" | "error";

let cachedData: TopOfficialVideosResponse | null = null;
let cachedError: string | null = null;
let cachedAt: number | null = null;
let inflightRequest: Promise<TopOfficialVideosResponse> | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

function isCacheFresh(): boolean {
  return (
    cachedData !== null &&
    cachedAt !== null &&
    Date.now() - cachedAt < CACHE_TTL_MS
  );
}

async function fetchTopOfficialVideos(): Promise<TopOfficialVideosResponse> {
  const res = await fetch("/api/youTubePlayer/topOfficial", {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`failed-to-fetch:${res.status}`);
  }

  return (await res.json()) as TopOfficialVideosResponse;
}

interface UseTopOfficialVideosResult {
  data: TopOfficialVideosResponse | null;
  error: string | null;
  status: LoadState;
}

export function useTopOfficialVideos(): UseTopOfficialVideosResult {
  const [data, setData] = useState<TopOfficialVideosResponse | null>(
    isCacheFresh() ? cachedData : null
  );
  const [error, setError] = useState<string | null>(cachedError);
  const [status, setStatus] = useState<LoadState>(() => {
    if (isCacheFresh()) return "ready";
    if (cachedError) return "error";
    return "idle";
  });

  useEffect(() => {
    if (isCacheFresh()) {
      setData(cachedData);
      setStatus("ready");
      return;
    }

    let cancelled = false;

    async function load() {
      setStatus("loading");

      try {
        if (!inflightRequest) {
          inflightRequest = fetchTopOfficialVideos();
        }

        const result = await inflightRequest;
        if (cancelled) return;

        cachedData = result;
        cachedError = null;
        cachedAt = Date.now();
        inflightRequest = null;
        setData(result);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
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
