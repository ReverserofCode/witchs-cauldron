import type { Metadata } from "next";
import { connection } from "next/server";
import BroadcastHub from "@/app/components/broadcasts/BroadcastHub";
import { getBroadcastArchive } from "@/app/lib/broadcasts/server";

export const metadata: Metadata = {
  title: "방송 모아보기",
  description:
    "모잉 다시보기 채널의 분할 영상을 방송 날짜별로 묶어 보고, 시청한 방송과 새 방송을 관리하세요.",
  alternates: {
    canonical: "/broadcasts",
  },
  openGraph: {
    type: "website",
    url: "https://moingfans.com/broadcasts",
    title: "모잉 방송 모아보기",
    description: "최근 12주 모잉 다시보기를 방송 날짜별로 이어보는 팬 아카이브",
  },
};

export default async function BroadcastsPage() {
  // Docker 이미지는 API 키 없이 빌드되고 실행 시점에 키를 주입한다.
  // 런타임 이후에 데이터를 읽되, 각 YouTube fetch의 15분 캐시는 유지한다.
  await connection();
  const archive = await getBroadcastArchive();

  return (
    <BroadcastHub
      sessions={archive.sessions}
      status={archive.status}
      partial={archive.partial}
      fetchedAt={archive.fetchedAt}
    />
  );
}
