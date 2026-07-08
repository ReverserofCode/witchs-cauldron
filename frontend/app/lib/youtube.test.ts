import { describe, expect, it } from "vitest";
import { summarizeVideoUploads } from "./youtube";

describe("summarizeVideoUploads", () => {
  it("summarizes upload dates without sorting the input list", () => {
    const videos = [
      { publishedAt: "2026-07-02T10:00:00.000Z" },
      { publishedAt: "not-a-date" },
      { publishedAt: "2026-07-09T10:00:00.000Z" },
      { publishedAt: "2026-07-01T10:00:00.000Z" },
    ];

    const result = summarizeVideoUploads(videos);

    expect(videos.map((video) => video.publishedAt)).toEqual([
      "2026-07-02T10:00:00.000Z",
      "not-a-date",
      "2026-07-09T10:00:00.000Z",
      "2026-07-01T10:00:00.000Z",
    ]);
    expect(result).toEqual({
      count: 4,
      latestDate: "7. 9.",
      rangeLabel: "7. 9. ~ 7. 1.",
    });
  });

  it("returns empty date labels when no valid published dates exist", () => {
    expect(summarizeVideoUploads([{ publishedAt: "" }])).toEqual({
      count: 1,
      latestDate: null,
      rangeLabel: null,
    });
  });
});
