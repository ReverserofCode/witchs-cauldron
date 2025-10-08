// 모잉 키리누키 쇼츠 채널에서 최신순으로 쇼츠만 반환하는 API
// 목표 채널: https://www.youtube.com/@%EB%AA%A8%EC%9E%89%EC%88%98%EC%A0%9C%EB%AC%B8%EC%96%B4%ED%8F%AC%EC%85%98

import { NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? ""; // 환경변수에 API 키 저장 필요
if (!YOUTUBE_API_KEY) {
  throw new Error("YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다.");
}
const CHANNEL_HANDLE = "모잉수제문어포션"; // @ 제외한 YouTube 채널 핸들
const MAX_RESULTS = 12;
let cachedChannelId: string | null = null;

async function resolveChannelId(): Promise<string | null> {
  if (cachedChannelId) return cachedChannelId;

  const params = new URLSearchParams({ part: "id", forHandle: CHANNEL_HANDLE });
  params.set("key", YOUTUBE_API_KEY);

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?${params.toString()}`
  );

  if (!res.ok) {
    console.error("YouTube channels API 실패", await res.text());
    return null;
  }

  const data = await res.json();
  const channelId: string | undefined = data.items?.[0]?.id;
  if (channelId) {
    cachedChannelId = channelId;
    return channelId;
  }

  return null;
}

export async function GET() {
  if (!YOUTUBE_API_KEY) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY 환경변수가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  const channelId = await resolveChannelId();
  if (!channelId) {
    return NextResponse.json(
      { error: "채널 정보를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const params = new URLSearchParams({
    channelId,
    part: "snippet",
    order: "date",
    maxResults: String(MAX_RESULTS),
    type: "video",
  });
  params.set("key", YOUTUBE_API_KEY);

  const apiUrl = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    return NextResponse.json(
      { error: "YouTube API 호출 실패" },
      { status: 500 }
    );
  }
  const data = await res.json();

  // Shorts만 필터링 (videoId가 있고, /shorts/ 링크가 있는 경우)
  const shorts = data.items
    .filter((item: any) => {
      // Shorts는 videoId로 /shorts/ 링크를 만들 수 있음
      return item.id?.videoId && item.snippet?.title;
    })
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      url: `https://www.youtube.com/shorts/${item.id.videoId}`,
    }));

  // Shorts URL 패턴만 남기기 (혹시 일반 영상이 섞여있을 경우)
  const shortsOnly = shorts.filter((s: any) => s.url.includes("/shorts/"));

  return NextResponse.json(shortsOnly);
}
