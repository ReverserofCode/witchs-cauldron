const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";

if (!YOUTUBE_API_KEY) {
  throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
}

const channelIdCache = new Map<string, string>();

export async function resolveChannelId(handle: string): Promise<string | null> {
  if (channelIdCache.has(handle)) {
    return channelIdCache.get(handle)!;
  }

  const params = new URLSearchParams({ part: "id", forHandle: handle });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`,
    {
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) {
    console.error("채널 ID 조회 실패", handle, await res.text());
    return null;
  }

  const data = await res.json();
  const channelId: string | undefined = data.items?.[0]?.id;

  if (!channelId) {
    return null;
  }

  channelIdCache.set(handle, channelId);
  return channelId;
}

export { YOUTUBE_API_KEY };
