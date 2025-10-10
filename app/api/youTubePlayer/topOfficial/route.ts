import { NextResponse } from "next/server";
import { YOUTUBE_API_KEY, resolveChannelMetadata } from "../shared";

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
    const metadata = await resolveChannelMetadata(handle);
    if (!metadata) {
      continue;
    }

    const channelVideos = await fetchChannelVideos(
      metadata.uploadsPlaylistId,
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
  playlistId: string,
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
  const collected: Array<{
    videoId: string;
    title: string;
    thumbnail: string;
    channelTitle: string;
    publishedAt: string;
    url: string;
  }> = [];

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
      { next: { revalidate: 300 } }
    );

    if (!res.ok) {
      console.error(
        "업로드 플레이리스트 조회 실패",
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
      const publishedAt = snippet?.publishedAt;

      if (!videoId || !snippet || !publishedAt) {
        continue;
      }

      const publishedTime = Date.parse(publishedAt);
      if (
        Number.isNaN(publishedTime) ||
        publishedTime < monthStart.getTime() ||
        publishedTime >= nextMonthStart.getTime()
      ) {
        continue;
      }

      collected.push({
        videoId,
        title: snippet.title as string,
        thumbnail: snippet.thumbnails?.medium?.url ?? "",
        channelTitle: snippet.channelTitle as string,
        publishedAt,
        url: `https://www.youtube.com/watch?v=${videoId}`,
      });
    }

    pageToken = data.nextPageToken;

    if (!pageToken || collected.length >= 50) {
      break;
    }
  } while (true);

  return collected;
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
