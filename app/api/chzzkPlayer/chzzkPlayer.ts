import { NextResponse } from "next/server";

const CHANNEL_ID = "1d333ff175b4db5bd06f87a88579ec1e";
const CHZZK_CHANNEL_URL = `https://chzzk.naver.com/${CHANNEL_ID}`;
const CHZZK_LIVE_DETAIL_URL = `https://api.chzzk.naver.com/service/v1/channels/${CHANNEL_ID}/live-detail`;

interface ChzzkLiveDetailResponse {
  content?: {
    status?: string;
    liveId?: string;
    liveTitle?: string;
    defaultThumbnailImageUrl?: string;
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

async function fetchChzzkLiveDetail(): Promise<
  Omit<ChzzkLiveStatus, "channelId" | "channelUrl" | "error">
> {
  const res = await fetch(CHZZK_LIVE_DETAIL_URL, {
    cache: "no-store",
    headers: {
      // User-Agent avoids some upstream 403 protections that dislike bare fetches.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Chzzk API request failed with status ${res.status}`);
  }

  const payload = (await res.json()) as ChzzkLiveDetailResponse;
  const content = payload.content ?? {};
  const status = content.status ?? null;
  const isLive = status === "OPEN";

  return {
    isLive,
    status,
    title: content.liveTitle ?? null,
    startedAt: content.openDate ?? null,
    thumbnail: content.defaultThumbnailImageUrl ?? null,
    liveId: content.liveId ?? null,
    viewers: content.concurrentUserCount ?? null,
    totalViewers: content.accumulateCount ?? null,
  };
}

export async function getChzzkLiveStatus(): Promise<ChzzkLiveStatus> {
  try {
    const liveDetail = await fetchChzzkLiveDetail();

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

  return NextResponse.json(liveStatus, { status: statusCode });
}
// openLive 값에 따라 실시간 방송 여부 확인 가능
