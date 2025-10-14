import { NextResponse } from "next/server";
import { checkYouTubeApiKey, resolveChannelMetadata } from "./shared";

const MAX_RESULTS = 4;
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

async function fetchLatestVideos(playlistId: string): Promise<VideoItem[]> {
  const YOUTUBE_API_KEY = checkYouTubeApiKey();

  const params = new URLSearchParams({
    playlistId,
    part: "snippet,contentDetails",
    maxResults: String(MAX_RESULTS),
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
    .map<VideoItem | null>((item) => {
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
        url: `https://www.youtube.com/watch?v=${videoId}`,
      } satisfies VideoItem;
    })
    .filter((value): value is VideoItem => value !== null)
    .sort(
      (a: VideoItem, b: VideoItem) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
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

      const videos = await fetchLatestVideos(metadata.uploadsPlaylistId);
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
