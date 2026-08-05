import { describe, expect, it } from "vitest";

import {
  ANALYTICS_TIME_ZONE,
  createIpHash,
  createVisitorKey,
  normalizeAnalyticsPath,
  normalizeDimensionKey,
  normalizeElementLabel,
  normalizeReferrerHost,
  parseAnalyticsDateRange,
  resolveAnalyticsHashSecret,
  validateAnalyticsPayload,
} from "./contract";

describe("analytics contract", () => {
  it("parses YYYY-MM-DD ranges as KST calendar days", () => {
    const range = parseAnalyticsDateRange({
      from: "2026-07-08",
      to: "2026-07-08",
      now: new Date("2026-07-08T03:00:00.000Z"),
    });

    expect(range.ok).toBe(true);
    if (!range.ok) return;

    expect(range.from).toBe("2026-07-08");
    expect(range.to).toBe("2026-07-08");
    expect(range.timeZone).toBe(ANALYTICS_TIME_ZONE);
    expect(range.fromUtcIso).toBe("2026-07-07T15:00:00.000Z");
    expect(range.toExclusiveUtcIso).toBe("2026-07-08T15:00:00.000Z");
    expect(range.days).toBe(1);
  });

  it("falls back instead of rolling an impossible calendar date into another month", () => {
    const range = parseAnalyticsDateRange({
      from: "2026-02-31",
      to: "2026-07-08",
      now: new Date("2026-07-08T03:00:00.000Z"),
    });

    expect(range.ok).toBe(true);
    if (!range.ok) return;

    expect(range.from).toBe("2026-07-02");
    expect(range.to).toBe("2026-07-08");
  });

  it("rejects analytics ranges longer than 366 KST days", () => {
    const range = parseAnalyticsDateRange({
      from: "2025-01-01",
      to: "2026-01-02",
      now: new Date("2026-07-08T03:00:00.000Z"),
    });

    expect(range).toEqual({
      ok: false,
      status: 400,
      error: "range_too_large",
      maxRangeDays: 366,
    });
  });

  it("normalizes referrers to one host before visitor counting", () => {
    expect(normalizeReferrerHost("https://Cafe.Naver.com/moing/a?x=1")).toBe("cafe.naver.com");
    expect(normalizeReferrerHost("https://cafe.naver.com/moing/b")).toBe("cafe.naver.com");
    expect(normalizeReferrerHost("https://www.Bing.com/search?q=moing")).toBe("bing.com");
    expect(normalizeReferrerHost("https://m.cafe.naver.com/ca-fe/web/cafes/moing")).toBe("cafe.naver.com");
    expect(normalizeReferrerHost("android-app://com.google.android.youtube")).toBe(
      "android-app://com.google.android.youtube"
    );
    expect(normalizeReferrerHost("")).toBe("(direct)");
    expect(normalizeReferrerHost("not-a-url")).toBe("(direct)");
  });

  it("canonicalizes paths, element ids, labels, and locations before storage", () => {
    expect(normalizeAnalyticsPath("https://moingfans.com/clips/?utm_source=x#clip-1")).toBe("/clips");
    expect(normalizeAnalyticsPath("/clips/?utm_source=x#clip-1")).toBe("/clips");
    expect(normalizeDimensionKey(" https://WWW.YouTube.com/@Moing/videos?view=0#shorts ")).toBe(
      "https://youtube.com/@Moing/videos"
    );
    expect(normalizeDimensionKey("  Header   Menu  ")).toBe("header menu");
    expect(normalizeElementLabel("  공식\n  채널\t바로가기  ")).toBe("공식 채널 바로가기");

    const valid = validateAnalyticsPayload({
      type: "menu_click",
      path: "https://moingfans.com/?utm_source=x#hero",
      element: {
        type: "A",
        id: " https://www.youtube.com/@Moing/videos?view=0#shorts ",
        label: "  공식\n  채널\t바로가기  ",
      },
      metadata: { location: " Header " },
    });

    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.path).toBe("/");
    expect(valid.elementType).toBe("a");
    expect(valid.elementId).toBe("https://youtube.com/@Moing/videos");
    expect(valid.elementLabel).toBe("공식 채널 바로가기");
    expect(valid.metadata).toEqual({ location: "header" });
  });

  it("validates event types and event-specific metadata", () => {
    expect(validateAnalyticsPayload({ type: "unknown_event" })).toEqual({
      ok: false,
      status: 400,
      error: "invalid_event_type",
    });

    expect(validateAnalyticsPayload({ type: "scroll_depth", metadata: { threshold: 80 } })).toEqual({
      ok: false,
      status: 400,
      error: "invalid_metadata",
    });

    const valid = validateAnalyticsPayload({
      type: "scroll_depth",
      path: "/",
      metadata: { threshold: 75, depth: 82 },
    });

    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.eventType).toBe("scroll_depth");
    expect(valid.metadata).toEqual({ threshold: 75, depth: 82 });
  });

  it("accepts section view visibility ratio metadata", () => {
    const valid = validateAnalyticsPayload({
      type: "section_view",
      path: "/",
      element: {
        type: "section",
        id: "featured-videos",
        label: "featured-videos",
      },
      metadata: {
        visibility_ratio: 0.556,
      },
    });

    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.eventType).toBe("section_view");
    expect(valid.metadata).toEqual({ visibility_ratio: 0.556 });
  });

  it("rejects oversized metadata payloads", () => {
    expect(
      validateAnalyticsPayload({
        type: "pageview",
        metadata: { location: "x".repeat(5000) },
      })
    ).toEqual({
      ok: false,
      status: 413,
      error: "payload_too_large",
    });
  });

  it("uses session visitor keys before hashed IP fallback", () => {
    const secret = resolveAnalyticsHashSecret({ NODE_ENV: "test", ANALYTICS_HASH_SECRET: "unit-secret" });
    const ipHash = createIpHash("203.0.113.7", secret);

    expect(ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createVisitorKey("11111111-1111-4111-8111-111111111111", ipHash)).toBe(
      "session:11111111-1111-4111-8111-111111111111"
    );
    expect(createVisitorKey(null, ipHash)).toBe(`ip:${ipHash}`);
  });
});
