import { NextResponse } from "next/server";

const CHANNEL_ID = "1d333ff175b4db5bd06f87a88579ec1e";
const CHZZK_CHANNEL_URL = `https://chzzk.naver.com/${CHANNEL_ID}`;
const CHZZK_POLLING_LIVE_URL = `https://api.chzzk.naver.com/polling/v2/channels/${CHANNEL_ID}/live-status`;

interface ChzzkPollingLiveResponse {
  content?: {
    status?: string;
    liveId?: number;
    liveTitle?: string;
    liveImageUrl?: string;
    concurrentUserCount?: number;
    accumulateCount?: number;
    openDate?: string;
  };
}

export interface ChzzkLiveStatus {
  channelId: string;
  channelUrl: string;
  isLive: boolean;
  status: string | null;
  title: string | null;
  startedAt: string | null;
  thumbnail: string | null;
  liveId: string | null;
  viewers: number | null;
  totalViewers: number | null;
  error?: string;
}

async function fetchChzzkLiveFromPolling(): Promise<
  Omit<ChzzkLiveStatus, "channelId" | "channelUrl" | "error">
> {
  const res = await fetch(CHZZK_POLLING_LIVE_URL, {
    next: { revalidate: 15 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`CHZZK polling live request failed with status ${res.status}`);
  }

  const payload = (await res.json()) as ChzzkPollingLiveResponse;
  const content = payload.content ?? {};
  const status = content.status ?? null;

  return {
    isLive: status === "OPEN",
    status,
    title: content.liveTitle ?? null,
    startedAt: content.openDate ?? null,
    thumbnail: content.liveImageUrl ?? null,
    liveId: typeof content.liveId === "number" ? String(content.liveId) : null,
    viewers: content.concurrentUserCount ?? null,
    totalViewers: content.accumulateCount ?? null,
  };
}

export async function getChzzkLiveStatus(): Promise<ChzzkLiveStatus> {
  try {
    const liveDetail = await fetchChzzkLiveFromPolling();

    return {
      channelId: CHANNEL_ID,
      channelUrl: CHZZK_CHANNEL_URL,
      ...liveDetail,
    };
  } catch (error) {
    console.error("Failed to fetch Chzzk live status", error);

    return {
      channelId: CHANNEL_ID,
      channelUrl: CHZZK_CHANNEL_URL,
      isLive: false,
      status: "UNKNOWN",
      title: null,
      startedAt: null,
      thumbnail: null,
      liveId: null,
      viewers: null,
      totalViewers: null,
      error: "LIVE_STATUS_UNAVAILABLE",
    };
  }
}

export async function GET() {
  const liveStatus = await getChzzkLiveStatus();
  const statusCode = liveStatus.error ? 503 : 200;

  return NextResponse.json(liveStatus, {
    status: statusCode,
    headers: {
      "Cache-Control": liveStatus.error
        ? "no-store"
        : "public, max-age=15, stale-while-revalidate=45",
    },
  });
}
