export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";

// 런타임에 API 키를 체크하는 함수
function checkYouTubeApiKey(): string {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return apiKey;
}

interface ChannelMetadata {
  channelId: string;
  uploadsPlaylistId: string;
}

const channelCache = new Map<string, ChannelMetadata>();

export async function resolveChannelMetadata(
  handle: string
): Promise<ChannelMetadata | null> {
  const YOUTUBE_API_KEY = checkYouTubeApiKey();

  if (channelCache.has(handle)) {
    return channelCache.get(handle)!;
  }

  const params = new URLSearchParams({
    part: "id,contentDetails",
    forHandle: handle,
  });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    {
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) {
    console.error("채널 메타데이터 조회 실패", handle, await res.text());
    return null;
  }

  const data = await res.json();
  const item = data.items?.[0];
  const channelId: string | undefined = item?.id;
  const uploadsPlaylistId: string | undefined =
    item?.contentDetails?.relatedPlaylists?.uploads;

  if (!channelId || !uploadsPlaylistId) {
    return null;
  }

  const metadata: ChannelMetadata = { channelId, uploadsPlaylistId };
  channelCache.set(handle, metadata);
  return metadata;
}

export async function resolveChannelId(handle: string): Promise<string | null> {
  const metadata = await resolveChannelMetadata(handle);
  return metadata?.channelId ?? null;
}

export { checkYouTubeApiKey };
