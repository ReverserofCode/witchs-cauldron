import { NextResponse } from "next/server";
import { getYouTubeApiKey, resolveChannelMetadata } from "../youTubePlayer/shared";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1시간

const CHZZK_CHANNEL_ID = "1d333ff175b4db5bd06f87a88579ec1e";
const CHZZK_OPENAPI_BASE = "https://openapi.chzzk.naver.com";
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID;
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET;

interface YouTubeChannelStats {
  subscriberCount: string;
  channelTitle: string;
}

interface ChannelStatsResponse {
  youtube: {
    moing: YouTubeChannelStats | null;
    fullmoing: YouTubeChannelStats | null;
  };
  chzzk: {
    followerCount: number | null;
  };
}

async function fetchYouTubeStats(
  handle: string,
  apiKey: string
): Promise<YouTubeChannelStats | null> {
  try {
    const meta = await resolveChannelMetadata(handle);
    if (!meta) return null;

    const params = new URLSearchParams({
      part: "statistics,snippet",
      id: meta.channelId,
      key: apiKey,
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      subscriberCount: item.statistics?.subscriberCount ?? "0",
      channelTitle: item.snippet?.title ?? handle,
    };
  } catch (e) {
    console.error(`YouTube stats fetch failed for ${handle}:`, e);
    return null;
  }
}

async function fetchChzzkFollowerCountFromOpenApi(): Promise<number | null> {
  if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) return null;

  try {
    const params = new URLSearchParams({ channelIds: CHZZK_CHANNEL_ID });
    const res = await fetch(`${CHZZK_OPENAPI_BASE}/open/v1/channels?${params.toString()}`, {
      next: { revalidate: 300 },
      headers: {
        "Client-Id": CHZZK_CLIENT_ID,
        "Client-Secret": CHZZK_CLIENT_SECRET,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.warn("CHZZK open API channel fetch failed", res.status);
      return null;
    }

    const data = await res.json();
    const first = data?.content?.data?.[0];
    return typeof first?.followerCount === "number" ? first.followerCount : null;
  } catch (e) {
    console.error("CHZZK open API follower fetch failed:", e);
    return null;
  }
}

async function fetchChzzkFollowerCountLegacy(): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.chzzk.naver.com/service/v1/channels/${CHZZK_CHANNEL_ID}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data.content?.followerCount ?? null;
  } catch (e) {
    console.error("Chzzk legacy follower count fetch failed:", e);
    return null;
  }
}

async function fetchChzzkFollowerCount(): Promise<number | null> {
  const official = await fetchChzzkFollowerCountFromOpenApi();
  if (official !== null) return official;
  return fetchChzzkFollowerCountLegacy();
}

export async function GET() {
  const apiKey = getYouTubeApiKey();

  const [moing, fullmoing, chzzkFollowers] = await Promise.all([
    apiKey ? fetchYouTubeStats("moing", apiKey) : Promise.resolve(null),
    apiKey ? fetchYouTubeStats("fullmoing", apiKey) : Promise.resolve(null),
    fetchChzzkFollowerCount(),
  ]);

  const response: ChannelStatsResponse = {
    youtube: { moing, fullmoing },
    chzzk: { followerCount: chzzkFollowers },
  };

  return NextResponse.json(response, { status: apiKey ? 200 : 503 });
}
