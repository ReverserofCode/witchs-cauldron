import { NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";

if (!YOUTUBE_API_KEY) {
  throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
}

const MAX_RESULTS = 5;
const CHANNEL_HANDLES = {
  moing: "moing",
  fullmoing: "fullmoing",
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

const channelIdCache = new Map<string, string>();

async function resolveChannelId(handle: string): Promise<string | null> {
  if (channelIdCache.has(handle)) {
    return channelIdCache.get(handle)!;
  }

  const params = new URLSearchParams({ part: "id", forHandle: handle });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    console.error("채널 ID 조회 실패", handle, await res.text());
    return null;
  }

  const data = await res.json();
  const channelId: string | undefined = data.items?.[0]?.id;

  if (channelId) {
    channelIdCache.set(handle, channelId);
    return channelId;
  }

  return null;
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
    { moing: [], fullmoing: [] }
  );

  return NextResponse.json(response);
}
