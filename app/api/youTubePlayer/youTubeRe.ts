import { NextResponse } from "next/server";
import { checkYouTubeApiKey, resolveChannelMetadata } from "./shared";

const MAX_RESULTS = 6;
const MAX_LOOKAHEAD = 20; // Shorts 필터링 후에도 충분한 수 확보
const SHORTS_MAX_DURATION = 65; // 65초 이하는 Shorts로 간주

const CHANNEL_HANDLES = {
  moing: "moing",
  fullmoing: "fullmoing",
  moingFan: "모잉수제문어포션",
} as const;

type ChannelKey = keyof typeof CHANNEL_HANDLES;

interface VideoItem {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnail: string;
  channelTitle: string;
  url: string;
}

interface PlaylistItem {
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

async function fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
  const YOUTUBE_API_KEY = checkYouTubeApiKey();

  const params = new URLSearchParams({
    playlistId,
    part: "snippet,contentDetails",
    maxResults: String(MAX_LOOKAHEAD),
  });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    console.error("영상 조회 실패", playlistId, await res.text());
    return [];
  }

  const data = await res.json();

  return ((data.items ?? []) as Array<Record<string, any>>)
    .map<PlaylistItem | null>((item) => {
      const snippet = item.snippet;
      const videoId =
        snippet?.resourceId?.videoId ?? item.contentDetails?.videoId;
      if (!videoId || !snippet) {
        return null;
      }

      return {
        videoId,
        title: snippet.title,
        publishedAt: snippet.publishedAt,
        thumbnail: snippet.thumbnails?.medium?.url ?? "",
        channelTitle: snippet.channelTitle,
      };
    })
    .filter((value): value is PlaylistItem => value !== null);
}

async function fetchVideoDurations(
  videoIds: string[]
): Promise<Record<string, number>> {
  if (videoIds.length === 0) {
    return {};
  }

  const YOUTUBE_API_KEY = checkYouTubeApiKey();
  const durations: Record<string, number> = {};

  const params = new URLSearchParams({
    id: videoIds.join(","),
    part: "contentDetails",
  });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    console.error("영상 상세 조회 실패", await res.text());
    return durations;
  }

  const data = await res.json();
  for (const item of data.items ?? []) {
    const id = item.id;
    const durationIso = item.contentDetails?.duration as string | undefined;
    if (typeof id === "string" && typeof durationIso === "string") {
      durations[id] = parseIsoDurationToSeconds(durationIso);
    }
  }

  return durations;
}

async function fetchLatestVideosExcludingShorts(
  playlistId: string
): Promise<VideoItem[]> {
  // 1. 플레이리스트에서 최신 영상 목록 가져오기
  const playlistItems = await fetchPlaylistItems(playlistId);

  if (playlistItems.length === 0) {
    return [];
  }

  // 2. 영상 길이 조회
  const videoIds = playlistItems.map((item) => item.videoId);
  const durations = await fetchVideoDurations(videoIds);

  // 3. Shorts 제외 (65초 초과 영상만 포함)
  const nonShorts = playlistItems
    .filter((item) => {
      const duration = durations[item.videoId];
      // duration이 없거나 65초 초과인 경우만 포함
      return !Number.isFinite(duration) || duration > SHORTS_MAX_DURATION;
    })
    .slice(0, MAX_RESULTS)
    .map<VideoItem>((item) => ({
      ...item,
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
    }));

  return nonShorts.sort(
    (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
  );
}

export async function GET() {
  const entries = Object.entries(CHANNEL_HANDLES) as [ChannelKey, string][];

  const results = await Promise.all(
    entries.map(async ([key, handle]) => {
      const metadata = await resolveChannelMetadata(handle);
      if (!metadata) {
        return [key, [] as VideoItem[]] as const;
      }

      const videos = await fetchLatestVideosExcludingShorts(
        metadata.uploadsPlaylistId
      );
      return [key, videos] as const;
    })
  );

  const response = results.reduce<Record<ChannelKey, VideoItem[]>>(
    (acc, [key, videos]) => {
      acc[key] = videos;
      return acc;
    },
    { moing: [], fullmoing: [], moingFan: [] }
  );

  return NextResponse.json(response);
}
