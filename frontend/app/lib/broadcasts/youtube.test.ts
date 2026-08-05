import { describe, expect, it, vi } from "vitest";
import {
  FULLMOING_UPLOADS_PLAYLIST_ID,
  fetchBroadcastArchive,
  type BroadcastFetch,
} from "./youtube";

const NOW = new Date("2026-08-05T12:00:00.000Z");

function playlistItem(
  videoId: string,
  title: string,
  publishedAt = "2026-08-03T09:00:00.000Z",
  videoPublishedAt?: string
) {
  return {
    snippet: {
      title,
      publishedAt,
      resourceId: { videoId },
      thumbnails: { medium: { url: `https://img.youtube.com/${videoId}.jpg` } },
    },
    contentDetails: {
      videoId,
      ...(videoPublishedAt ? { videoPublishedAt } : {}),
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchBroadcastArchive", () => {
  it("returns a stable empty state without making a request when the API key is missing", async () => {
    const fetchImpl = vi.fn<BroadcastFetch>();

    const result = await fetchBroadcastArchive({ apiKey: undefined, fetchImpl, now: NOW });

    expect(result).toMatchObject({ status: "missing_api_key", sessions: [], partial: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("paginates uploads, fetches durations, and groups parts by their broadcast date", async () => {
    const requestedUrls: string[] = [];
    const fetchImpl: BroadcastFetch = vi.fn(async (input, init) => {
      const url = String(input);
      requestedUrls.push(url);
      expect(init?.next?.revalidate).toBe(900);

      if (url.includes("playlistItems") && !url.includes("pageToken=")) {
        return jsonResponse({
          items: [
            playlistItem("part-1", "[26.08.02] 마녀 토크 1부 (w. 통깡이) 【잡담】"),
            playlistItem("part-2", "[26.08.02] 마녀 토크 2부 (w. 통깡이) 【잡담】", "2026-08-04T09:00:00.000Z"),
          ],
          nextPageToken: "NEXT_PAGE",
        });
      }

      if (url.includes("playlistItems") && url.includes("pageToken=NEXT_PAGE")) {
        return jsonResponse({
          items: [playlistItem("solo", "[26.07.20] 조용한 저녁 【소통】", "2026-07-21T09:00:00.000Z")],
        });
      }

      if (url.includes("/videos?")) {
        return jsonResponse({
          items: [
            { id: "part-1", contentDetails: { duration: "PT1H30M" } },
            { id: "part-2", contentDetails: { duration: "PT45M10S" } },
            { id: "solo", contentDetails: { duration: "PT2H" } },
          ],
        });
      }

      return jsonResponse({}, 404);
    });

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.status).toBe("ready");
    expect(result.partial).toBe(false);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]).toMatchObject({
      id: "broadcast-2026-08-02",
      totalDurationSeconds: 8_110,
      categories: ["잡담"],
      collaborators: ["통깡이"],
    });
    expect(result.sessions[0].assets.map((asset) => asset.videoId)).toEqual(["part-1", "part-2"]);
    expect(requestedUrls[0]).toContain(`playlistId=${FULLMOING_UPLOADS_PLAYLIST_ID}`);
    expect(requestedUrls[0]).toContain("maxResults=50");
    expect(requestedUrls.some((url) => url.includes("pageToken=NEXT_PAGE"))).toBe(true);
  });

  it("requests video details in batches of at most 50", async () => {
    const items = Array.from({ length: 51 }, (_, index) =>
      playlistItem(`video-${index + 1}`, `[26.08.02] 다시보기 ${index + 1}부`)
    );
    const detailBatchSizes: number[] = [];
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/playlistItems")) {
        return jsonResponse({ items });
      }
      if (url.pathname.endsWith("/videos")) {
        const ids = (url.searchParams.get("id") ?? "").split(",").filter(Boolean);
        detailBatchSizes.push(ids.length);
        return jsonResponse({
          items: ids.map((id) => ({ id, contentDetails: { duration: "PT10M" } })),
        });
      }
      return jsonResponse({}, 404);
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.status).toBe("ready");
    expect(detailBatchSizes).toEqual([50, 1]);
    expect(result.sessions[0].assets).toHaveLength(51);
  });

  it("filters by parsed broadcast date rather than a recent upload date", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return jsonResponse({
          items: [playlistItem("old-broadcast", "[26.04.01] 뒤늦게 올린 다시보기")],
        });
      }
      return jsonResponse({
        items: [{ id: "old-broadcast", contentDetails: { duration: "PT1H" } }],
      });
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.status).toBe("ready");
    expect(result.sessions).toEqual([]);
  });

  it("prefers the video's publish time over the uploads-playlist addition time", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return jsonResponse({
          items: [
            playlistItem(
              "delayed-playlist-entry",
              "날짜 접두사가 없는 다시보기",
              "2026-08-04T09:00:00.000Z",
              "2026-08-01T09:00:00.000Z"
            ),
          ],
        });
      }
      return jsonResponse({
        items: [{ id: "delayed-playlist-entry", contentDetails: { duration: "PT1H" } }],
      });
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.sessions[0].broadcastDate).toBe("2026-08-01");
    expect(result.sessions[0].latestPublishedAt).toBe("2026-08-01T09:00:00.000Z");
  });

  it("excludes malformed future broadcast dates from the rolling archive", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return jsonResponse({
          items: [playlistItem("future-title", "[99.12.31] 잘못 입력한 미래 방송")],
        });
      }
      return jsonResponse({
        items: [{ id: "future-title", contentDetails: { duration: "PT1H" } }],
      });
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.sessions).toEqual([]);
  });

  it("includes the exact 84-day boundary and excludes the previous day", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return jsonResponse({
          items: [
            playlistItem("boundary", "[26.05.13] 정확한 경계"),
            playlistItem("too-old", "[26.05.12] 하루 오래된 방송"),
          ],
        });
      }
      return jsonResponse({
        items: [
          { id: "boundary", contentDetails: { duration: "PT1H" } },
          { id: "too-old", contentDetails: { duration: "PT1H" } },
        ],
      });
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.sessions.map((session) => session.broadcastDate)).toEqual(["2026-05-13"]);
  });

  it("keeps partial playlist results when a later page fails", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems") && !url.includes("pageToken=")) {
        return jsonResponse({
          items: [playlistItem("part-1", "[26.08.02] 1부")],
          nextPageToken: "BROKEN_PAGE",
        });
      }
      if (url.includes("playlistItems")) {
        return jsonResponse({ error: "temporary" }, 503);
      }
      return jsonResponse({ items: [{ id: "part-1", contentDetails: { duration: "PT1H" } }] });
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.status).toBe("ready");
    expect(result.partial).toBe(true);
    expect(result.sessions).toHaveLength(1);
  });

  it("returns unavailable when the first playlist request fails", async () => {
    const fetchImpl: BroadcastFetch = async () => jsonResponse({ error: "temporary" }, 503);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

      expect(result).toMatchObject({ status: "unavailable", sessions: [], partial: false });
      expect(warn).toHaveBeenCalled();
      const logged = JSON.stringify(warn.mock.calls);
      expect(logged).toContain("playlist");
      expect(logged).not.toContain("test-key");
      expect(logged).not.toContain("googleapis.com");
    } finally {
      warn.mockRestore();
    }
  });

  it("returns unavailable when the first playlist request exceeds its deadline", async () => {
    let receivedSignal = false;
    const fetchImpl: BroadcastFetch = async (_input, init) => {
      const signal = init?.signal;
      if (!signal) {
        throw new Error("missing abort signal");
      }

      receivedSignal = true;
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => reject(new DOMException("request timed out", "AbortError")),
          { once: true }
        );
      });
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      const result = await fetchBroadcastArchive({
        apiKey: "test-key",
        fetchImpl,
        now: NOW,
        requestTimeoutMs: 5,
      });

      expect(receivedSignal).toBe(true);
      expect(result).toMatchObject({ status: "unavailable", sessions: [], partial: false });
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps videos with unknown duration and marks the result partial", async () => {
    const fetchImpl: BroadcastFetch = async (input) => {
      const url = String(input);
      if (url.includes("playlistItems")) {
        return jsonResponse({ items: [playlistItem("part-1", "[26.08.02] 1부")] });
      }
      return jsonResponse({ error: "temporary" }, 503);
    };

    const result = await fetchBroadcastArchive({ apiKey: "test-key", fetchImpl, now: NOW });

    expect(result.status).toBe("ready");
    expect(result.partial).toBe(true);
    expect(result.sessions[0].assets[0].durationSeconds).toBe(0);
  });
});
