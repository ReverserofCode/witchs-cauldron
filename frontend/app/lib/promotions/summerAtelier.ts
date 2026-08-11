export interface PromotionProduct {
  readonly id: string;
  readonly name: string;
  readonly price: string;
  readonly note?: string;
  readonly detailUrl: string;
}

export interface PromotionCampaign {
  readonly id: string;
  readonly title: string;
  readonly storeUrl: string;
  readonly startAt: string;
  readonly endAtExclusive: string;
  readonly shippingFrom: string;
  readonly deadlineShort: string;
  readonly deadlineLong: string;
  readonly shippingDisplay: string;
  readonly products: readonly PromotionProduct[];
}

export type PromotionPhase = "upcoming" | "active" | "ended";

export interface PromotionWindow {
  startMs: number;
  endMs: number;
}

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const MAX_TIMEOUT_MS = 2_147_483_647;

export const SUMMER_ATELIER_CAMPAIGN = {
  id: "moing-summer-atelier-2026",
  title: "모잉 여름의 공방 굿즈 예약 판매",
  storeUrl: "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/",
  startAt: "2026-08-05T19:00:00+09:00",
  endAtExclusive: "2026-09-01T00:00:00+09:00",
  shippingFrom: "2026-10-07",
  deadlineShort: "8월 31일 23:59 마감",
  deadlineLong: "2026년 8월 31일 23:59 마감",
  shippingDisplay: "10월 7일부터 순차 출고 예정",
  products: [
    {
      id: "full-set",
      name: "여름의 공방 풀세트",
      price: "77,000원",
      note: "친필 사인 투명 포토카드 1장 증정",
      detailUrl:
        "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%92%80%EC%84%B8%ED%8A%B8/375/",
    },
    {
      id: "desk-mat",
      name: "여름의 공방 장패드",
      price: "30,000원",
      detailUrl:
        "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%EC%9E%A5%ED%8C%A8%EB%93%9C/376/",
    },
    {
      id: "acrylic-stand",
      name: "비키니 모잉 아크릴 스탠드",
      price: "35,000원",
      detailUrl:
        "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%95%84%ED%81%AC%EB%A6%B4-%EC%8A%A4%ED%83%A0%EB%93%9C/377/",
    },
    {
      id: "can-badge",
      name: "비키니 모잉 캔뱃지",
      price: "7,500원",
      detailUrl:
        "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EB%B9%84%ED%82%A4%EB%8B%88-%EB%AA%A8%EC%9E%89-%EC%BA%94%EB%B1%83%EC%A7%80/378/",
    },
    {
      id: "photocard-set",
      name: "여름의 공방 포토카드 세트",
      price: "7,000원",
      detailUrl:
        "https://fantompick.com/product/%EB%AA%A8%EC%9E%89-%EC%97%AC%EB%A6%84%EC%9D%98-%EA%B3%B5%EB%B0%A9-%ED%8F%AC%ED%86%A0%EC%B9%B4%EB%93%9C-%EC%84%B8%ED%8A%B8/379/",
    },
  ],
} as const satisfies PromotionCampaign;

export const PROMOTION_DISMISSAL_KEY =
  "wc:promotion:moing-summer-atelier-2026:dismissed";

function toNowMs(now: Date | number): number {
  return now instanceof Date ? now.getTime() : now;
}

export function getPromotionWindow(
  campaign: PromotionCampaign
): PromotionWindow | null {
  const startMs = Date.parse(campaign.startAt);
  const endMs = Date.parse(campaign.endAtExclusive);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null;
  }
  return { startMs, endMs };
}

export function getPromotionPhase(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): PromotionPhase | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || !Number.isFinite(nowMs)) return null;
  if (nowMs < window.startMs) return "upcoming";
  if (nowMs >= window.endMs) return "ended";
  return "active";
}

export function formatPromotionCountdown(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): string | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || getPromotionPhase(campaign, nowMs) !== "active") return null;
  const totalMinutes = Math.floor((window.endMs - nowMs) / MINUTE_MS);
  if (totalMinutes < 1) return "곧 마감";

  const days = Math.floor(totalMinutes / DAY_MINUTES);
  const hours = Math.floor((totalMinutes % DAY_MINUTES) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days > 0 ? days + "일" : null,
    hours > 0 ? hours + "시간" : null,
    minutes > 0 ? minutes + "분" : null,
  ].filter((part): part is string => part !== null);
  return "마감까지 " + parts.join(" ");
}

export function getNextPromotionWakeDelay(
  campaign: PromotionCampaign,
  now: Date | number = Date.now()
): number | null {
  const window = getPromotionWindow(campaign);
  const nowMs = toNowMs(now);
  if (!window || !Number.isFinite(nowMs) || nowMs >= window.endMs) return null;

  const targetDelay =
    nowMs < window.startMs
      ? window.startMs - nowMs
      : Math.min(
          window.endMs - nowMs,
          ((window.endMs - nowMs) % MINUTE_MS) + 1
        );
  return Math.max(1, Math.min(targetDelay, MAX_TIMEOUT_MS));
}

export function getPromotionSchedulingDelay(
  campaign: PromotionCampaign,
  snapshotNow: Date | number,
  schedulingNow: Date | number
): number | null {
  const snapshotMs = toNowMs(snapshotNow);
  const schedulingMs = toNowMs(schedulingNow);
  if (!Number.isFinite(snapshotMs) || !Number.isFinite(schedulingMs)) {
    return null;
  }
  const snapshotDelay = getNextPromotionWakeDelay(campaign, snapshotMs);
  if (snapshotDelay === null) return null;

  const wakeAt = snapshotMs + snapshotDelay;
  return Math.min(MAX_TIMEOUT_MS, Math.max(0, wakeAt - schedulingMs));
}
