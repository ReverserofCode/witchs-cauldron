"use client";

import { useEffect, useState } from "react";
import {
  SUMMER_ATELIER_CAMPAIGN,
  formatPromotionCountdown,
  getNextPromotionWakeDelay,
  getPromotionPhase,
  type PromotionCampaign,
  type PromotionPhase,
} from "@/app/lib/promotions/summerAtelier";

export interface PromotionRuntimeState {
  phase: PromotionPhase | null;
  countdownLabel: string | null;
}

export function usePromotionCampaign(
  campaign: PromotionCampaign = SUMMER_ATELIER_CAMPAIGN
): PromotionRuntimeState | null {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (nowMs === null) return;
    const delay = getNextPromotionWakeDelay(campaign, nowMs);
    if (delay === null) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), delay);
    return () => window.clearTimeout(timer);
  }, [campaign, nowMs]);

  if (nowMs === null) return null;
  return {
    phase: getPromotionPhase(campaign, nowMs),
    countdownLabel: formatPromotionCountdown(campaign, nowMs),
  };
}
