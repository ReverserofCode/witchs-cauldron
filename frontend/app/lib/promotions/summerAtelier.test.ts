import { describe, expect, it } from "vitest";
import {
  SUMMER_ATELIER_CAMPAIGN,
  formatPromotionCountdown,
  getNextPromotionWakeDelay,
  getPromotionPhase,
  getPromotionWindow,
  type PromotionCampaign,
} from "./summerAtelier";

describe("summer atelier promotion", () => {
  it("uses the verified canonical campaign data", () => {
    expect(SUMMER_ATELIER_CAMPAIGN.id).toBe("moing-summer-atelier-2026");
    expect(SUMMER_ATELIER_CAMPAIGN.storeUrl).toBe(
      "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/"
    );
    expect(SUMMER_ATELIER_CAMPAIGN.products).toHaveLength(5);
    expect(SUMMER_ATELIER_CAMPAIGN.products[0]).toMatchObject({
      name: "여름의 공방 풀세트",
      price: "77,000원",
    });
  });

  it("uses an inclusive start and exclusive end", () => {
    expect(
      getPromotionPhase(
        SUMMER_ATELIER_CAMPAIGN,
        Date.parse("2026-08-05T09:59:59.999Z")
      )
    ).toBe("upcoming");
    expect(
      getPromotionPhase(
        SUMMER_ATELIER_CAMPAIGN,
        Date.parse("2026-08-05T10:00:00.000Z")
      )
    ).toBe("active");
    expect(
      getPromotionPhase(
        SUMMER_ATELIER_CAMPAIGN,
        Date.parse("2026-08-31T14:59:59.999Z")
      )
    ).toBe("active");
    expect(
      getPromotionPhase(
        SUMMER_ATELIER_CAMPAIGN,
        Date.parse("2026-08-31T15:00:00.000Z")
      )
    ).toBe("ended");
  });

  it("formats day, hour, minute and imminent countdowns", () => {
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(
      formatPromotionCountdown(
        SUMMER_ATELIER_CAMPAIGN,
        endMs - ((2 * 24 + 3) * 60 + 4) * 60_000
      )
    ).toBe("마감까지 2일 3시간 4분");
    expect(
      formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 65 * 60_000)
    ).toBe("마감까지 1시간 5분");
    expect(
      formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 59_000)
    ).toBe("곧 마감");
    expect(formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs)).toBeNull();
  });

  it("wakes at the next relevant minute or campaign boundary", () => {
    const startMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.startAt);
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(
      getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, startMs - 30_000)
    ).toBe(30_000);
    expect(
      getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 10_000)
    ).toBe(10_000);
    expect(getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs)).toBeNull();
  });

  it("rejects invalid or reversed campaign windows", () => {
    const invalid = {
      ...SUMMER_ATELIER_CAMPAIGN,
      startAt: "not-a-date",
    } satisfies PromotionCampaign;
    const reversed = {
      ...SUMMER_ATELIER_CAMPAIGN,
      startAt: SUMMER_ATELIER_CAMPAIGN.endAtExclusive,
      endAtExclusive: SUMMER_ATELIER_CAMPAIGN.startAt,
    } satisfies PromotionCampaign;

    expect(getPromotionWindow(invalid)).toBeNull();
    expect(getPromotionPhase(invalid, Date.now())).toBeNull();
    expect(formatPromotionCountdown(invalid, Date.now())).toBeNull();
    expect(getPromotionWindow(reversed)).toBeNull();
  });
});
