// 모잉 키리누키 쇼츠 채널에서 최신순으로 쇼츠만 반환하는 API
// 목표 채널: https://www.youtube.com/@%EB%AA%A8%EC%9E%89%EC%88%98%EC%A0%9C%EB%AC%B8%EC%96%B4%ED%8F%AC%EC%85%98

import { NextResponse } from "next/server";
import {
  YOUTUBE_API_KEY,
  resolveChannelMetadata,
} from "../youTubePlayer/shared";

const CHANNEL_HANDLE = "모잉수제문어포션"; // @ 제외한 YouTube 채널 핸들
const MAX_RESULTS = 12;
const MAX_LOOKAHEAD = 40; // 쇼츠만 필터링하므로 넉넉히 가져와서 추리는 방식

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
      { next: { revalidate: 60 } }
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
      { next: { revalidate: 60 } }
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
      return Number.isFinite(duration) && duration <= 65; // 60초 + 여유
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

// 런타임 의존성(API Key, 외부 API)에 따라 반드시 동적 처리
export const dynamic = "force-dynamic";
