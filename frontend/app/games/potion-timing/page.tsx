import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PotionTimingGame } from "@/app/components/games/potion-timing/PotionTimingGame";
import { POTION_GAME_ENABLED } from "@/app/lib/games/potion-timing/config";

export const metadata: Metadata = {
  title: "포션 불조절",
  description:
    "움직이는 온도를 목표 구간에 맞추는 5라운드 팬 창작 미니게임입니다.",
  alternates: { canonical: "/games/potion-timing" },
};

export default function PotionTimingPage() {
  if (!POTION_GAME_ENABLED) notFound();

  return (
    <section className="px-3 py-8 sm:px-5 sm:py-12 lg:px-8">
      <PotionTimingGame />
    </section>
  );
}
