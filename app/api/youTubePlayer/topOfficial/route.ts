import { NextResponse } from "next/server";
import { YOUTUBE_API_KEY, resolveChannelId } from "../shared";

const CHANNEL_HANDLES = ["moing", "fullmoing"] as const;
type ChannelHandle = (typeof CHANNEL_HANDLES)[number];

interface TopVideoPayload {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  url: string;
  viewCount: number | null;
}

function startOfPreviousMonthUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0)
  );
}

function startOfCurrentMonthUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

export async function GET() {
  const monthStart = startOfPreviousMonthUtc();
  const nextMonthStart = startOfCurrentMonthUtc();

  const candidates: Array<{
    videoId: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    url: string;
    channelHandle: ChannelHandle;
  }> = [];

  for (const handle of CHANNEL_HANDLES) {
    const channelId = await resolveChannelId(handle);
    if (!channelId) {
      continue;
    }

    const channelVideos = await fetchChannelVideos(
      channelId,
      monthStart,
      nextMonthStart
    );
    candidates.push(
      ...channelVideos.map((item) => ({
        ...item,
        channelHandle: handle,
      }))
    );
  }

  if (candidates.length === 0) {
    return NextResponse.json({ video: null }, { status: 200 });
  }

  const viewCounts = await fetchVideoViewCounts(
    candidates.map((item) => item.videoId)
  );

  const enriched = candidates.map<TopVideoPayload>((item) => ({
    videoId: item.videoId,
    title: item.title,
    thumbnail: item.thumbnail,
    channelTitle: item.channelTitle,
    publishedAt: item.publishedAt,
    url: item.url,
    viewCount: viewCounts[item.videoId] ?? null,
  }));

  const topVideo = enriched.reduce<TopVideoPayload | null>((best, current) => {
    if (!best) {
      return current;
    }

    const bestCount = typeof best.viewCount === "number" ? best.viewCount : -1;
    const currentCount =
      typeof current.viewCount === "number" ? current.viewCount : -1;

    if (currentCount > bestCount) {
      return current;
    }

    if (currentCount === bestCount) {
      const bestTime = Date.parse(best.publishedAt);
      const currentTime = Date.parse(current.publishedAt);
      if (
        !Number.isNaN(currentTime) &&
        (Number.isNaN(bestTime) || currentTime > bestTime)
      ) {
        return current;
      }
    }

    return best;
  }, null);

  return NextResponse.json({ video: topVideo }, { status: 200 });
}

async function fetchChannelVideos(
  channelId: string,
  monthStart: Date,
  nextMonthStart: Date
): Promise<
  Array<{
    videoId: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    url: string;
  }>
> {
  const searchParams = new URLSearchParams({
    channelId,
    part: "snippet",
    order: "viewCount",
    maxResults: "10",
    type: "video",
    publishedAfter: monthStart.toISOString(),
    publishedBefore: nextMonthStart.toISOString(),
  });
  searchParams.set("key", YOUTUBE_API_KEY);

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
    { next: { revalidate: 300 } }
  );

  if (!searchRes.ok) {
    console.error(
      "조회수 상위 영상 조회 실패",
      channelId,
      await searchRes.text()
    );
    return [];
  }

  const searchData = await searchRes.json();
  const filteredItems = (searchData.items ?? []).filter((item: any) => {
    if (!item.id?.videoId) {
      return false;
    }

    const publishedAt = item.snippet?.publishedAt;
    if (!publishedAt) {
      return false;
    }

    const publishedTime = Date.parse(publishedAt);
    if (Number.isNaN(publishedTime)) {
      return false;
    }

    return (
      publishedTime >= monthStart.getTime() &&
      publishedTime < nextMonthStart.getTime()
    );
  });

  return filteredItems.map((item: any) => ({
    videoId: item.id.videoId as string,
    title: item.snippet.title as string,
    thumbnail: item.snippet.thumbnails?.medium?.url ?? "",
    channelTitle: item.snippet.channelTitle as string,
    publishedAt: item.snippet.publishedAt as string,
    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
  }));
}

async function fetchVideoViewCounts(
  videoIds: string[]
): Promise<Record<string, number>> {
  const uniqueIds = Array.from(new Set(videoIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    return {};
  }

  const counts: Record<string, number> = {};
  const chunkSize = 50;

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    const params = new URLSearchParams({
      id: chunk.join(","),
      part: "statistics",
    });
    params.set("key", YOUTUBE_API_KEY);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) {
      console.error("영상 통계 조회 실패", await res.text());
      continue;
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const id = item.id;
      const count = Number(item.statistics?.viewCount);
      if (typeof id === "string" && Number.isFinite(count)) {
        counts[id] = count;
      }
    }
  }

  return counts;
}
