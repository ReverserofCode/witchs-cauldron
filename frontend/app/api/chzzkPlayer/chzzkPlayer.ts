import { NextResponse } from "next/server";

const CHANNEL_ID = "1d333ff175b4db5bd06f87a88579ec1e";
const CHZZK_CHANNEL_URL = `https://chzzk.naver.com/${CHANNEL_ID}`;
const CHZZK_LIVE_DETAIL_URL = `https://api.chzzk.naver.com/service/v1/channels/${CHANNEL_ID}/live-detail`;
const CHZZK_POLLING_LIVE_URL = `https://api.chzzk.naver.com/polling/v2/channels/${CHANNEL_ID}/live-status`;
const CHZZK_OPENAPI_BASE = "https://openapi.chzzk.naver.com";
const CHZZK_CLIENT_ID = process.env.CHZZK_CLIENT_ID;
const CHZZK_CLIENT_SECRET = process.env.CHZZK_CLIENT_SECRET;

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

interface ChzzkOpenLiveItem {
  liveId?: number;
  liveTitle?: string;
  liveThumbnailImageUrl?: string;
  concurrentUserCount?: number;
  openDate?: string;
  channelId?: string;
}

interface ChzzkOpenLiveResponse {
  content?: {
    data?: ChzzkOpenLiveItem[];
  };
}

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
    cache: "no-store",
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

async function fetchChzzkLiveFromOpenApi(): Promise<
  Omit<ChzzkLiveStatus, "channelId" | "channelUrl" | "error"> | null
> {
  if (!CHZZK_CLIENT_ID || !CHZZK_CLIENT_SECRET) return null;

  const params = new URLSearchParams({ size: "20" });
  const res = await fetch(`${CHZZK_OPENAPI_BASE}/open/v1/lives?${params.toString()}`, {
    next: { revalidate: 30 },
    headers: {
      "Client-Id": CHZZK_CLIENT_ID,
      "Client-Secret": CHZZK_CLIENT_SECRET,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`CHZZK Open API lives request failed with status ${res.status}`);
  }

  const payload = (await res.json()) as ChzzkOpenLiveResponse;
  const live = payload?.content?.data?.find((item) => item.channelId === CHANNEL_ID);

  if (!live) {
    return {
      isLive: false,
      status: "CLOSE",
      title: null,
      startedAt: null,
      thumbnail: null,
      liveId: null,
      viewers: null,
      totalViewers: null,
    };
  }

  return {
    isLive: true,
    status: "OPEN",
    title: live.liveTitle ?? null,
    startedAt: live.openDate ?? null,
    thumbnail: live.liveThumbnailImageUrl ?? null,
    liveId: typeof live.liveId === "number" ? String(live.liveId) : null,
    viewers: live.concurrentUserCount ?? null,
    totalViewers: null,
  };
}

async function fetchChzzkLiveDetailLegacy(): Promise<
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
    const liveDetail = await fetchChzzkLiveFromPolling().catch(async (pollingError) => {
      console.warn("Failed to fetch CHZZK live status from polling API", pollingError);

      const fromOpenApi = await fetchChzzkLiveFromOpenApi().catch((openApiError) => {
        console.warn("Failed to fetch CHZZK live status from open API", openApiError);
        return null;
      });

      if (fromOpenApi) return fromOpenApi;
      return fetchChzzkLiveDetailLegacy();
    });

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
