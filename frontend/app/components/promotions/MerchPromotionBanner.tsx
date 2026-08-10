"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePromotionCampaign } from "@/app/hooks/usePromotionCampaign";
import {
  PROMOTION_DISMISSAL_KEY,
  SUMMER_ATELIER_CAMPAIGN,
} from "@/app/lib/promotions/summerAtelier";

export function MerchPromotionBanner() {
  const pathname = usePathname();
  const runtime = usePromotionCampaign();
  const [dismissalReady, setDismissalReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setDismissed(sessionStorage.getItem(PROMOTION_DISMISSAL_KEY) === "1");
      } catch {
        setDismissed(false);
      } finally {
        setDismissalReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(PROMOTION_DISMISSAL_KEY, "1");
    } catch {
      // Current-page dismissal still works when storage is unavailable.
    }
  }

  if (
    pathname.startsWith("/admin") ||
    !dismissalReady ||
    dismissed ||
    runtime?.phase !== "active"
  ) {
    return null;
  }

  return (
    <aside
      aria-label="기간 한정 굿즈 안내"
      data-promotion-id={SUMMER_ATELIER_CAMPAIGN.id}
      data-promotion-surface="banner"
      className="border-y border-sky-200/70 bg-gradient-to-r from-sky-100 via-white to-purple-100 text-purple-950 shadow-sm"
    >
      <div className="mx-auto flex min-h-12 w-full max-w-6xl items-center gap-2 px-3 py-2 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-xs font-semibold leading-5 sm:text-sm">
          <span className="mr-1.5 rounded-full bg-purple-700 px-2 py-0.5 text-[10px] font-bold text-white">
            기간 한정
          </span>
          모잉 여름의 공방 굿즈 예약 판매 중 · 8월 31일 23:59 마감
        </p>
        <span aria-live="polite" className="shrink-0 text-[10px] font-medium sm:text-xs">
          {runtime.countdownLabel}
        </span>
        <a
          href={SUMMER_ATELIER_CAMPAIGN.storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-purple-700 px-3 text-xs font-bold text-white transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2 sm:px-4 sm:text-sm"
          data-analytics-menu="true"
          data-analytics-id={SUMMER_ATELIER_CAMPAIGN.id + ":banner"}
          data-analytics-label="팬텀픽에서 보기"
          data-analytics-location="merch_promotion_banner"
          data-analytics-type="promotion_cta"
        >
          팬텀픽에서 보기
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="여름의 공방 굿즈 홍보 배너 닫기"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-purple-900 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/70 focus-visible:ring-offset-2"
        >
          <span aria-hidden>×</span>
        </button>
      </div>
    </aside>
  );
}
