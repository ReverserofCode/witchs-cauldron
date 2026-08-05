import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatKoreanBroadcastDate,
  groupBroadcastSessions,
  normalizeReplayAsset,
} from "./normalize";
import type { BroadcastAsset, BroadcastDateSource } from "./types";

interface AssetFixtureOptions {
  videoId: string;
  broadcastDate: string;
  publishedAt: string;
  durationSeconds: number;
  category: string | null;
  collaborators: string[];
  dateSource?: BroadcastDateSource;
}

function makeAsset({
  videoId,
  broadcastDate,
  publishedAt,
  durationSeconds,
  category,
  collaborators,
  dateSource = "title",
}: AssetFixtureOptions): BroadcastAsset {
  return {
    videoId,
    title: videoId,
    displayTitle: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://img.youtube.com/${videoId}.jpg`,
    publishedAt,
    durationSeconds,
    category,
    collaborators,
    broadcastDate,
    dateSource,
  };
}

describe("broadcast replay title normalization", () => {
  it("normalizes a replay with a two-digit broadcast date and title metadata", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-a",
      title: "[26.08.02] 게임 1부 (w. 통깡이, 여까) 【게임명】",
      thumbnail: "https://img.youtube.com/video-a.jpg",
      publishedAt: "2026-08-03T02:00:00.000Z",
      durationSeconds: 3_723,
    });

    expect(asset).toEqual({
      videoId: "video-a",
      title: "[26.08.02] 게임 1부 (w. 통깡이, 여까) 【게임명】",
      displayTitle: "게임 1부",
      url: "https://www.youtube.com/watch?v=video-a",
      thumbnail: "https://img.youtube.com/video-a.jpg",
      publishedAt: "2026-08-03T02:00:00.000Z",
      durationSeconds: 3_723,
      category: "게임명",
      collaborators: ["통깡이", "여까"],
      broadcastDate: "2026-08-02",
      dateSource: "title",
    });
  });

  it("accepts a real four-digit leap date, the final category, and every collaborator delimiter", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-b",
      title:
        "[2024.02.29] 늦은 방송 (with Alice · Bob/Carol & Dave) 【잡담】 【게임】",
      thumbnail: "https://img.youtube.com/video-b.jpg",
      publishedAt: "2024-03-01T00:00:00.000Z",
      durationSeconds: 90,
    });

    expect(asset.broadcastDate).toBe("2024-02-29");
    expect(asset.dateSource).toBe("title");
    expect(asset.category).toBe("게임");
    expect(asset.collaborators).toEqual(["Alice", "Bob", "Carol", "Dave"]);
    expect(asset.displayTitle).toBe("늦은 방송");
  });

  it("parses the compact collaborator notation used by real replay titles", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-compact-collab",
      title: "[26.08.03] 김모잉 굿즈 발표 공지 (w.통깡이,여까) 【라디오】",
      thumbnail: "https://img.youtube.com/video-compact-collab.jpg",
      publishedAt: "2026-08-04T02:00:00.000Z",
      durationSeconds: 3_600,
    });

    expect(asset.collaborators).toEqual(["통깡이", "여까"]);
    expect(asset.displayTitle).toBe("김모잉 굿즈 발표 공지");
  });

  it("falls back to the published timestamp's Seoul date when the title has no date", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-c",
      title: "심야 잡담 【토크】",
      thumbnail: "https://img.youtube.com/video-c.jpg",
      publishedAt: "2026-08-02T15:30:00.000Z",
      durationSeconds: 600,
    });

    expect(asset.broadcastDate).toBe("2026-08-03");
    expect(asset.dateSource).toBe("publishedAt");
  });

  it("rejects an impossible title date and uses the published Seoul date instead", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-d",
      title: "[26.02.29] 달력 점검",
      thumbnail: "https://img.youtube.com/video-d.jpg",
      publishedAt: "2026-03-01T14:59:59.000Z",
      durationSeconds: 60,
    });

    expect(asset.broadcastDate).toBe("2026-03-01");
    expect(asset.dateSource).toBe("publishedAt");
  });

  it("uses the original title when removing metadata would leave an empty display title", () => {
    const asset = normalizeReplayAsset({
      videoId: "video-e",
      title: "[26.08.02] (w. 여까) 【잡담】",
      thumbnail: "https://img.youtube.com/video-e.jpg",
      publishedAt: "2026-08-03T00:00:00.000Z",
      durationSeconds: 60,
    });

    expect(asset.displayTitle).toBe("[26.08.02] (w. 여까) 【잡담】");
  });
});

describe("broadcast session grouping", () => {
  it("groups a broadcast, deduplicates video ids globally, and aggregates ordered assets", () => {
    const laterPart = makeAsset({
      videoId: "part-2",
      broadcastDate: "2026-08-02",
      publishedAt: "2026-08-03T02:00:00.000Z",
      durationSeconds: 70,
      category: "게임",
      collaborators: ["여까", "통깡이"],
    });
    const earlierPart = makeAsset({
      videoId: "part-1",
      broadcastDate: "2026-08-02",
      publishedAt: "2026-08-03T01:00:00.000Z",
      durationSeconds: 50,
      category: "잡담",
      collaborators: ["통깡이"],
    });
    const duplicateInAnotherDate = makeAsset({
      videoId: "part-1",
      broadcastDate: "2026-08-04",
      publishedAt: "2026-08-05T01:00:00.000Z",
      durationSeconds: 999,
      category: "중복",
      collaborators: ["중복 게스트"],
    });

    const sessions = groupBroadcastSessions([
      laterPart,
      earlierPart,
      duplicateInAnotherDate,
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("broadcast-2026-08-02");
    expect(sessions[0].assets.map((asset) => asset.videoId)).toEqual(["part-1", "part-2"]);
    expect(sessions[0].totalDurationSeconds).toBe(120);
    expect(sessions[0].categories).toEqual(["잡담", "게임"]);
    expect(sessions[0].collaborators).toEqual(["통깡이", "여까"]);
    expect(sessions[0].latestPublishedAt).toBe("2026-08-03T02:00:00.000Z");
  });

  it("orders sessions by newest broadcast date first", () => {
    const older = makeAsset({
      videoId: "older",
      broadcastDate: "2026-07-31",
      publishedAt: "2026-08-01T01:00:00.000Z",
      durationSeconds: 60,
      category: null,
      collaborators: [],
    });
    const newer = makeAsset({
      videoId: "newer",
      broadcastDate: "2026-08-02",
      publishedAt: "2026-08-03T01:00:00.000Z",
      durationSeconds: 60,
      category: null,
      collaborators: [],
    });

    expect(groupBroadcastSessions([older, newer]).map((session) => session.broadcastDate)).toEqual([
      "2026-08-02",
      "2026-07-31",
    ]);
  });

  it("marks a session as publishedAt-based when any grouped asset used the fallback date", () => {
    const titleDated = makeAsset({
      videoId: "title-date",
      broadcastDate: "2026-08-02",
      publishedAt: "2026-08-02T20:00:00.000Z",
      durationSeconds: 60,
      category: null,
      collaborators: [],
    });
    const fallbackDated = makeAsset({
      videoId: "fallback-date",
      broadcastDate: "2026-08-02",
      publishedAt: "2026-08-02T21:00:00.000Z",
      durationSeconds: 60,
      category: null,
      collaborators: [],
      dateSource: "publishedAt",
    });

    expect(groupBroadcastSessions([titleDated, fallbackDated])[0].dateSource).toBe("publishedAt");
  });
});

describe("broadcast display formatting", () => {
  it("labels a zero duration as unavailable", () => {
    expect(formatDuration(0)).toBe("길이 정보 없음");
  });

  it("labels non-finite durations as unavailable", () => {
    expect(formatDuration(Number.NaN)).toBe("길이 정보 없음");
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe("길이 정보 없음");
  });

  it("keeps seconds for short videos and uses hour-minute precision for long videos", () => {
    expect(formatDuration(45)).toBe("45초");
    expect(formatDuration(65)).toBe("1분 5초");
    expect(formatDuration(3_723)).toBe("1시간 2분");
  });

  it("formats an ISO broadcast date with a full Korean weekday", () => {
    expect(formatKoreanBroadcastDate("2026-08-02")).toBe("2026년 8월 2일 일요일");
  });
});
