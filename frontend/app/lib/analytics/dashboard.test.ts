import { describe, expect, it } from "vitest";

import {
  buildAnalyticsDatePreset,
  buildAnalyticsProfileFindings,
  getAnalyticsEmptyState,
  getAnalyticsHealthStatus,
} from "./dashboard";

describe("analytics dashboard helpers", () => {
  it("builds date presets from the current Asia/Seoul calendar date", () => {
    const range = buildAnalyticsDatePreset(7, new Date("2026-07-10T15:30:00.000Z"));

    expect(range).toEqual({
      from: "2026-07-05",
      to: "2026-07-11",
    });
  });

  it("clamps analytics presets to the supported 366-day range", () => {
    const range = buildAnalyticsDatePreset(500, new Date("2026-07-11T03:00:00.000Z"));

    expect(range).toEqual({
      from: "2025-07-11",
      to: "2026-07-11",
    });
  });

  it("marks analytics health as ok when DB, schema, and recent events are healthy", () => {
    const status = getAnalyticsHealthStatus({
      ok: true,
      database: { connected: true, latencyMs: 32 },
      events: {
        latestEventAt: "2026-07-08T10:20:30.000Z",
        events24h: 42,
        pageviews24h: 18,
        unknownEvents: 0,
        missingVisitorKey: 0,
        missingEventDateKst: 0,
      },
      schema: {
        version: 2,
        timeZone: "Asia/Seoul",
        requiredColumns: ["visitor_key", "event_date_kst"],
        requiredIndexes: ["analytics_events_date_type_idx"],
        missingColumns: [],
        missingIndexes: [],
      },
      generatedAt: "2026-07-08T10:21:00.000Z",
    });

    expect(status.level).toBe("ok");
    expect(status.label).toBe("정상");
    expect(status.reasons).toEqual([]);
  });

  it("marks analytics health as critical when schema or database integrity is broken", () => {
    const status = getAnalyticsHealthStatus({
      ok: false,
      database: { connected: true, latencyMs: 120 },
      events: {
        latestEventAt: "2026-07-08T10:20:30.000Z",
        events24h: 10,
        pageviews24h: 6,
        unknownEvents: 0,
        missingVisitorKey: 3,
        missingEventDateKst: 2,
      },
      schema: {
        version: 2,
        timeZone: "Asia/Seoul",
        requiredColumns: ["visitor_key", "event_date_kst"],
        requiredIndexes: ["analytics_events_date_type_idx"],
        missingColumns: ["visitor_key"],
        missingIndexes: [],
      },
      generatedAt: "2026-07-08T10:21:00.000Z",
    });

    expect(status.level).toBe("critical");
    expect(status.reasons).toContain("필수 컬럼 누락 1개");
    expect(status.reasons).toContain("visitor_key 누락 이벤트 3건");
  });

  it("marks analytics health as warning when recent collection is empty", () => {
    const status = getAnalyticsHealthStatus({
      ok: true,
      database: { connected: true, latencyMs: 80 },
      events: {
        latestEventAt: null,
        events24h: 0,
        pageviews24h: 0,
        unknownEvents: 0,
        missingVisitorKey: 0,
        missingEventDateKst: 0,
      },
      schema: {
        version: 2,
        timeZone: "Asia/Seoul",
        requiredColumns: [],
        requiredIndexes: [],
        missingColumns: [],
        missingIndexes: [],
      },
      generatedAt: "2026-07-08T10:21:00.000Z",
    });

    expect(status.level).toBe("warning");
    expect(status.reasons).toContain("최근 24시간 이벤트 없음");
  });

  it("keeps a missing performance index at warning severity", () => {
    const status = getAnalyticsHealthStatus({
      ok: false,
      database: { connected: true, latencyMs: 80 },
      events: {
        latestEventAt: "2026-07-08T10:20:00.000Z",
        events24h: 20,
        pageviews24h: 10,
        unknownEvents: 0,
        missingVisitorKey: 0,
        missingEventDateKst: 0,
      },
      schema: {
        version: 2,
        timeZone: "Asia/Seoul",
        requiredColumns: [],
        requiredIndexes: ["analytics_events_date_type_idx"],
        missingColumns: [],
        missingIndexes: ["analytics_events_date_type_idx"],
      },
      generatedAt: "2026-07-08T10:21:00.000Z",
    });

    expect(status.level).toBe("warning");
    expect(status.reasons).toEqual(["인덱스 누락 1개"]);
  });

  it("returns operation-oriented empty-state copy", () => {
    expect(getAnalyticsEmptyState("referrers")).toEqual({
      title: "유입 데이터가 없습니다.",
      description: "직접 방문만 있거나 referrer_host backfill이 아직 끝나지 않았을 수 있습니다.",
    });
  });

  it("builds data-quality findings from a collected analytics profile", () => {
    const findings = buildAnalyticsProfileFindings({
      rows: 100,
      events24h: 0,
      missingVisitorKey: 4,
      missingEventDateKst: 1,
      rawIpRows: 8,
      unknownEvents: 2,
      duplicateEventIds: 3,
    });

    expect(findings.map((finding) => finding.severity)).toEqual([
      "high",
      "high",
      "medium",
      "medium",
      "medium",
    ]);
    expect(findings[0].message).toBe("최근 24시간 이벤트가 없어 수집 중단 가능성이 있습니다.");
  });
});
