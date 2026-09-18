import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FanArtDisplayImage } from "./display";

const fixtures = vi.hoisted(() => ({
  legacy: [] as FanArtDisplayImage[],
  published: [] as FanArtDisplayImage[],
}));

// Keep the page and gallery real; isolate unrelated homepage data/widgets and
// the catalog subscription boundary so the server's legacy list can be empty.
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/lib/fanart", () => ({ loadFanArtImages: () => fixtures.legacy }));
vi.mock("@/app/hooks/useFanArtCatalog", () => ({ useFanArtCatalog: (legacy: FanArtDisplayImage[]) => [...fixtures.published, ...legacy] }));
vi.mock("@/app/lib/fanart/display", async () => import("./display"));
vi.mock("@/app/components/gallery", async () => ({ FanArtGallery: (await import("../../components/gallery/FanArtGallery")).default }));
vi.mock("@/app/components/modals", async () => ({ FanArtModal: (await import("../../components/modals/FanArtModal")).default }));
vi.mock("@/app/components/cards", () => ({ SectionCard: ({ children }: { children: unknown }) => children }));
vi.mock("@/app/components/animations", () => ({ ScrollReveal: ({ children }: { children: unknown }) => children }));
vi.mock("@/app/components/analytics/SectionTracker", () => ({ SectionTracker: ({ children }: { children: unknown }) => children }));
vi.mock("@/app/components/sections", () => ({
  ClipsSection: () => null,
  ScheduleSection: () => null,
  FeaturedVideoSection: () => null,
  LiveStatusCard: () => null,
  LiveStatusChip: () => null,
  LiveStatusDescription: () => null,
  LiveStatusProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/app/components/promotions", () => ({ MerchPromotionCard: () => null }));
vi.mock("@/app/components/games/GameEntryCard", () => ({ default: () => null }));
vi.mock("@/app/lib/games/potion-timing/config", () => ({ POTION_GAME_ENABLED: false }));
vi.mock("@/app/lib/birthday", () => ({ isBirthdayToday: () => false, getBirthdayBannerCopy: () => "" }));

import Page from "../../page";

describe("homepage managed gallery without legacy files", () => {
  it("shows a published catalog artwork in the main gallery even when the static list is empty", () => {
    fixtures.legacy = [];
    fixtures.published = [{
      id: "1c65776f-0dc4-49f7-8ef7-bd373e3ab72b",
      src: "/media/fanart/1c65776f-0dc4-49f7-8ef7-bd373e3ab72b",
      alt: "자체 제작 테스트 도형",
      credit: "테스트 작가",
      sourceUrl: "https://cafe.naver.com/moinge/123456",
      publishedAt: "2026-09-18T00:00:00.000Z",
    }];

    const html = renderToStaticMarkup(createElement(Page));

    expect(html).toContain('id="fanart-section"');
    expect(html).toContain('aria-label="자체 제작 테스트 도형 크게 보기"');
    expect(html).toContain("테스트 작가");
    expect(html).toContain('href="https://cafe.naver.com/moinge/123456"');
  });

  it("keeps the empty gallery mounted to receive future publications", () => {
    fixtures.legacy = [];
    fixtures.published = [];

    const html = renderToStaticMarkup(createElement(Page));

    expect(html).toContain('id="fanart-section"');
    expect(html).toContain("아직 등록된 작품이 없습니다.");
  });
});
