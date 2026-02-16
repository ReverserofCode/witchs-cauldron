// 모잉 공식 채널(@moing)에서 최신순으로 Shorts만 반환하는 API

import { NextResponse } from "next/server";
import {
  YOUTUBE_API_KEY,
  resolveChannelMetadata,
} from "../../youTubePlayer/shared";

const CHANNEL_HANDLE = "moing"; // 모잉 공식 채널
const MAX_RESULTS = 12;
const MAX_LOOKAHEAD = 100;

interface PlaylistItemSnippet {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
}

function parseIsoDurationToSeconds(duration: string): number {
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

async function fetchRecentPlaylistItems(
  playlistId: string
): Promise<PlaylistItemSnippet[]> {
  const collected: PlaylistItemSnippet[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      playlistId,
      part: "snippet,contentDetails",
      maxResults: "50",
    });
    if (pageToken) {
      params.set("pageToken", pageToken);
    }
    params.set("key", YOUTUBE_API_KEY);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error(
        "유튜브 업로드 플레이리스트 조회 실패",
        playlistId,
        await res.text()
      );
      break;
    }

    const data = await res.json();
    const items = (data.items ?? []) as Array<Record<string, any>>;

    for (const item of items) {
      const snippet = item.snippet;
      const videoId =
        snippet?.resourceId?.videoId ?? item.contentDetails?.videoId;
      if (!snippet || !videoId) {
        continue;
      }

      collected.push({
        videoId,
        title: snippet.title as string,
        publishedAt: snippet.publishedAt as string,
        thumbnail: snippet.thumbnails?.medium?.url ?? "",
        channelTitle: snippet.channelTitle as string,
      });
    }

    pageToken = data.nextPageToken;

    if (!pageToken || collected.length >= MAX_LOOKAHEAD) {
      break;
    }
  } while (true);

  return collected;
}

async function fetchVideoDurations(
  videoIds: string[]
): Promise<Record<string, number>> {
  if (videoIds.length === 0) {
    return {};
  }

  const uniqueIds = Array.from(new Set(videoIds));
  const durations: Record<string, number> = {};
  const chunkSize = 50;

  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    const params = new URLSearchParams({
      id: chunk.join(","),
      part: "contentDetails",
    });
    params.set("key", YOUTUBE_API_KEY);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      console.error("유튜브 영상 상세 조회 실패", await res.text());
      continue;
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const id = item.id;
      const durationIso = item.contentDetails?.duration as string | undefined;
      if (typeof id === "string" && typeof durationIso === "string") {
        durations[id] = parseIsoDurationToSeconds(durationIso);
      }
    }
  }

  return durations;
}

export async function GET() {
  const metadata = await resolveChannelMetadata(CHANNEL_HANDLE);
  if (!metadata) {
    return NextResponse.json(
      { error: "채널 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const playlistItems = await fetchRecentPlaylistItems(
    metadata.uploadsPlaylistId
  );

  if (playlistItems.length === 0) {
    return NextResponse.json([]);
  }

  const durations = await fetchVideoDurations(
    playlistItems.map((item) => item.videoId)
  );

  const shortsOnly = playlistItems
    .filter((item) => {
      const duration = durations[item.videoId];
      // YouTube Shorts: 2024년 10월부터 최대 3분(180초)까지 허용
      return Number.isFinite(duration) && duration <= 185;
    })
    .slice(0, MAX_RESULTS)
    .map((item) => ({
      videoId: item.videoId,
      title: item.title,
      publishedAt: item.publishedAt,
      thumbnail: item.thumbnail,
      channelTitle: item.channelTitle,
      url: `https://www.youtube.com/shorts/${item.videoId}`,
    }));

  return NextResponse.json(shortsOnly);
}

export const dynamic = "force-dynamic";
