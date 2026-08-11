import { describe, expect, it } from "vitest";
import {
  SUMMER_ATELIER_CAMPAIGN,
  formatPromotionCountdown,
  getNextPromotionWakeDelay,
  getPromotionPhase,
  getPromotionSchedulingDelay,
  getPromotionWindow,
  type PromotionCampaign,
} from "./summerAtelier";

describe("summer atelier promotion", () => {
  it("uses the verified canonical campaign data", () => {
    expect(SUMMER_ATELIER_CAMPAIGN.id).toBe("moing-summer-atelier-2026");
    expect(SUMMER_ATELIER_CAMPAIGN.storeUrl).toBe(
      "https://fantompick.com/category/%EB%AA%A8%EC%9E%89/110/"
    );
    const expectedProducts = [
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
    ] as const;

    expect(SUMMER_ATELIER_CAMPAIGN.products).toEqual(expectedProducts);
    expect(SUMMER_ATELIER_CAMPAIGN.deadlineShort).toBe("8월 31일 23:59 마감");
    expect(SUMMER_ATELIER_CAMPAIGN.deadlineLong).toBe("2026년 8월 31일 23:59 마감");
    expect(SUMMER_ATELIER_CAMPAIGN.shippingDisplay).toBe("10월 7일부터 순차 출고 예정");
  });

  it("uses unique official FantomPick product detail URLs without image metadata", () => {
    const products = SUMMER_ATELIER_CAMPAIGN.products;
    expect(new Set(products.map(({ id }) => id)).size).toBe(products.length);
    expect(new Set(products.map(({ detailUrl }) => detailUrl)).size).toBe(
      products.length
    );

    const productNumbers = products.map(({ detailUrl }) => {
      const url = new URL(detailUrl);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("fantompick.com");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(url.pathname).toMatch(/^\/product\/.+\/(37[5-9])\/$/);
      expect(url.pathname).not.toMatch(/\/web\/(product|upload)\//);
      return url.pathname.match(/\/(37[5-9])\/$/)?.[1];
    });

    expect(productNumbers).toEqual(["375", "376", "377", "378", "379"]);
    for (const product of products) {
      expect("imageSrc" in product).toBe(false);
      expect("imageUrl" in product).toBe(false);
    }
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

  it("formats the final-minute threshold", () => {
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(
      formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 60_000)
    ).toBe("마감까지 1분");
    expect(
      formatPromotionCountdown(SUMMER_ATELIER_CAMPAIGN, endMs - 59_999)
    ).toBe("곧 마감");
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

  it("wakes just after floor-countdown label thresholds", () => {
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(
      getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 60_001)
    ).toBe(2);
    expect(
      getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 60_000)
    ).toBe(1);
    expect(
      getNextPromotionWakeDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 59_999)
    ).toBe(59_999);
  });

  it("keeps the final-minute wake anchored across a delayed effect", () => {
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);
    expect(
      getPromotionSchedulingDelay(
        SUMMER_ATELIER_CAMPAIGN,
        endMs - 60_001,
        endMs - 60_000
      )
    ).toBe(1);
    expect(
      getPromotionSchedulingDelay(
        SUMMER_ATELIER_CAMPAIGN,
        endMs - 60_000,
        endMs - 59_900
      )
    ).toBe(0);
  });

  it("anchors effect scheduling to the render snapshot's absolute wake", () => {
    const startMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.startAt);
    const endMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.endAtExclusive);

    expect(getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, startMs - 1, startMs + 100)).toBe(0);
    expect(getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, endMs - 1, endMs + 100)).toBe(0);
    expect(getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, startMs - 1_000, startMs - 100)).toBe(100);
    expect(getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, endMs, endMs + 100)).toBeNull();

    const invalid = { ...SUMMER_ATELIER_CAMPAIGN, startAt: "invalid" } satisfies PromotionCampaign;
    expect(getPromotionSchedulingDelay(invalid, startMs - 1, startMs + 100)).toBeNull();
  });

  it("rejects invalid scheduling timestamps", () => {
    const startMs = Date.parse(SUMMER_ATELIER_CAMPAIGN.startAt);
    expect(
      getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, Number.NaN, startMs)
    ).toBeNull();
    expect(
      getPromotionSchedulingDelay(SUMMER_ATELIER_CAMPAIGN, startMs, Number.NaN)
    ).toBeNull();
  });

  it("caps far-future scheduling waits", () => {
    const farFuture = {
      ...SUMMER_ATELIER_CAMPAIGN,
      startAt: "2100-01-01T00:00:00+09:00",
      endAtExclusive: "2100-02-01T00:00:00+09:00",
    } satisfies PromotionCampaign;
    const snapshotMs = Date.parse("2026-08-05T00:00:00+09:00");
    expect(
      getPromotionSchedulingDelay(farFuture, snapshotMs, snapshotMs)
    ).toBe(2_147_483_647);
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
