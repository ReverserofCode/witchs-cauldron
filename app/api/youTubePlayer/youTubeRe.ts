import { NextResponse } from "next/server";
import { YOUTUBE_API_KEY, resolveChannelId } from "./shared";

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

async function fetchLatestVideos(channelId: string): Promise<VideoItem[]> {
  const params = new URLSearchParams({
    channelId,
    part: "snippet",
    order: "date",
    maxResults: String(MAX_RESULTS),
    type: "video",
  });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    console.error("영상 조회 실패", channelId, await res.text());
    return [];
  }

  const data = await res.json();

  return (data.items ?? [])
    .filter((item: any) => item.id?.videoId && item.id.kind === "youtube#video")
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? "",
      channelTitle: item.snippet.channelTitle,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));
}

export async function GET() {
  const entries = Object.entries(CHANNEL_HANDLES) as [ChannelKey, string][];

  const results = await Promise.all(
    entries.map(async ([key, handle]) => {
      const channelId = await resolveChannelId(handle);
      if (!channelId) {
        return [key, [] as VideoItem[]] as const;
      }

      const videos = await fetchLatestVideos(channelId);
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
