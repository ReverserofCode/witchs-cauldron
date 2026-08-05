import { groupBroadcastSessions, normalizeReplayAsset } from "./normalize";
import type { BroadcastSession, RawReplayVideo } from "./types";

export const FULLMOING_CHANNEL_ID = "UC2fJutQqQRGmlbqiAYFsBuQ";
export const FULLMOING_UPLOADS_PLAYLIST_ID = "UU2fJutQqQRGmlbqiAYFsBuQ";

const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";
const FETCH_REVALIDATE_SECONDS = 15 * 60;
const MAX_PLAYLIST_PAGES = 3;
const YOUTUBE_PAGE_SIZE = 50;
const ARCHIVE_WINDOW_DAYS = 84;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

export type BroadcastArchiveStatus = "ready" | "missing_api_key" | "unavailable";

export interface BroadcastArchiveResult {
  status: BroadcastArchiveStatus;
  sessions: BroadcastSession[];
  partial: boolean;
  fetchedAt: string;
}

export type BroadcastFetchInit = RequestInit & {
  next?: {
    revalidate?: number;
  };
};

export type BroadcastFetch = (
  input: string | URL,
  init?: BroadcastFetchInit
) => Promise<Response>;

export interface FetchBroadcastArchiveOptions {
  apiKey?: string | null;
  fetchImpl?: BroadcastFetch;
  now?: Date;
  requestTimeoutMs?: number;
}

interface PlaylistPage {
  videos: Omit<RawReplayVideo, "durationSeconds">[];
  nextPageToken: string | null;
}

interface PlaylistCollection {
  videos: Omit<RawReplayVideo, "durationSeconds">[];
  partial: boolean;
}

interface DurationCollection {
  durationByVideoId: Map<string, number>;
  partial: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readHttpUrl(value: unknown): string | null {
  const candidate = readNonEmptyString(value);

  if (!candidate) {
    return null;
  }

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parsePlaylistVideo(value: unknown): Omit<RawReplayVideo, "durationSeconds"> | null {
  if (!isRecord(value) || !isRecord(value.snippet)) {
    return null;
  }

  const snippet = value.snippet;
  const contentDetails = isRecord(value.contentDetails) ? value.contentDetails : null;
  const resourceId = isRecord(snippet.resourceId) ? snippet.resourceId : null;
  const videoId =
    readNonEmptyString(contentDetails?.videoId) ?? readNonEmptyString(resourceId?.videoId);
  const title = readNonEmptyString(snippet.title);
  const videoPublishedAt = readNonEmptyString(contentDetails?.videoPublishedAt);
  const playlistPublishedAt = readNonEmptyString(snippet.publishedAt);
  const publishedAt =
    videoPublishedAt && Number.isFinite(Date.parse(videoPublishedAt))
      ? videoPublishedAt
      : playlistPublishedAt;

  if (!videoId || !title || !publishedAt || !Number.isFinite(Date.parse(publishedAt))) {
    return null;
  }

  const thumbnails = isRecord(snippet.thumbnails) ? snippet.thumbnails : null;
  const thumbnailKeys = ["maxres", "standard", "high", "medium", "default"] as const;
  let thumbnail: string | null = null;

  for (const key of thumbnailKeys) {
    const thumbnailData = thumbnails && isRecord(thumbnails[key]) ? thumbnails[key] : null;
    thumbnail = readHttpUrl(thumbnailData?.url);

    if (thumbnail) {
      break;
    }
  }

  return {
    videoId,
    title,
    publishedAt,
    thumbnail: thumbnail ?? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`,
  };
}

function parsePlaylistPage(value: unknown): PlaylistPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const videos: Omit<RawReplayVideo, "durationSeconds">[] = [];

  for (const item of value.items) {
    const video = parsePlaylistVideo(item);

    if (video) {
      videos.push(video);
    }
  }

  return {
    videos,
    nextPageToken: readNonEmptyString(value.nextPageToken),
  };
}

function parseIsoDurationSeconds(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    value
  );

  if (!match || match.slice(1).every((component) => component === undefined)) {
    return null;
  }

  const weeks = Number(match[1] ?? 0);
  const days = Number(match[2] ?? 0);
  const hours = Number(match[3] ?? 0);
  const minutes = Number(match[4] ?? 0);
  const seconds = Number(match[5] ?? 0);
  const totalSeconds =
    weeks * 7 * 24 * 60 * 60 + days * 24 * 60 * 60 + hours * 60 * 60 + minutes * 60 + seconds;

  return Number.isFinite(totalSeconds) ? Math.floor(totalSeconds) : null;
}

function parseDurationItems(value: unknown): Map<string, number> | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }

  const durations = new Map<string, number>();

  for (const item of value.items) {
    if (!isRecord(item) || !isRecord(item.contentDetails)) {
      continue;
    }

    const videoId = readNonEmptyString(item.id);
    const durationSeconds = parseIsoDurationSeconds(item.contentDetails.duration);

    if (videoId && durationSeconds !== null) {
      durations.set(videoId, durationSeconds);
    }
  }

  return durations;
}

async function readJson(response: Response): Promise<unknown | null> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function normalizeRequestTimeoutMs(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return Math.max(1, Math.floor(value));
}

function createFetchInit(requestTimeoutMs: number): BroadcastFetchInit {
  return {
    signal: AbortSignal.timeout(requestTimeoutMs),
    next: {
      revalidate: FETCH_REVALIDATE_SECONDS,
    },
  };
}

function logSourceIssue(details: {
  phase: "playlist" | "duration";
  requestIndex: number;
  reason: "http" | "invalid_payload" | "exception";
  status?: number;
  errorName?: string;
}) {
  console.warn("[broadcasts] YouTube source request failed", details);
}

function createPlaylistUrl(apiKey: string, pageToken: string | null): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/playlistItems`);
  url.searchParams.set("part", "snippet,contentDetails");
  url.searchParams.set("playlistId", FULLMOING_UPLOADS_PLAYLIST_ID);
  url.searchParams.set("maxResults", String(YOUTUBE_PAGE_SIZE));
  url.searchParams.set("key", apiKey);

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return url;
}

function createVideoDetailsUrl(apiKey: string, videoIds: string[]): URL {
  const url = new URL(`${YOUTUBE_API_BASE_URL}/videos`);
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("id", videoIds.join(","));
  url.searchParams.set("key", apiKey);
  return url;
}

async function collectPlaylistVideos(
  apiKey: string,
  fetchImpl: BroadcastFetch,
  requestTimeoutMs: number
): Promise<PlaylistCollection | null> {
  const videos: Omit<RawReplayVideo, "durationSeconds">[] = [];
  let pageToken: string | null = null;
  let partial = false;

  for (let pageIndex = 0; pageIndex < MAX_PLAYLIST_PAGES; pageIndex += 1) {
    try {
      const response = await fetchImpl(
        createPlaylistUrl(apiKey, pageToken),
        createFetchInit(requestTimeoutMs)
      );

      if (!response.ok) {
        logSourceIssue({
          phase: "playlist",
          requestIndex: pageIndex + 1,
          reason: "http",
          status: response.status,
        });
        if (pageIndex === 0) {
          return null;
        }

        partial = true;
        break;
      }

      const page = parsePlaylistPage(await readJson(response));

      if (!page) {
        logSourceIssue({
          phase: "playlist",
          requestIndex: pageIndex + 1,
          reason: "invalid_payload",
          status: response.status,
        });
        if (pageIndex === 0) {
          return null;
        }

        partial = true;
        break;
      }

      videos.push(...page.videos);
      pageToken = page.nextPageToken;

      if (!pageToken) {
        break;
      }
    } catch (error) {
      logSourceIssue({
        phase: "playlist",
        requestIndex: pageIndex + 1,
        reason: "exception",
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      if (pageIndex === 0) {
        return null;
      }

      partial = true;
      break;
    }
  }

  return { videos, partial };
}

async function collectDurations(
  apiKey: string,
  videoIds: string[],
  fetchImpl: BroadcastFetch,
  requestTimeoutMs: number
): Promise<DurationCollection> {
  const durationByVideoId = new Map<string, number>();
  const batches: string[][] = [];

  for (let offset = 0; offset < videoIds.length; offset += YOUTUBE_PAGE_SIZE) {
    batches.push(videoIds.slice(offset, offset + YOUTUBE_PAGE_SIZE));
  }

  const batchResults = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      try {
        const response = await fetchImpl(
          createVideoDetailsUrl(apiKey, batch),
          createFetchInit(requestTimeoutMs)
        );

        if (!response.ok) {
          logSourceIssue({
            phase: "duration",
            requestIndex: batchIndex + 1,
            reason: "http",
            status: response.status,
          });
          return { durations: new Map<string, number>(), partial: true };
        }

        const durations = parseDurationItems(await readJson(response));

        if (!durations) {
          logSourceIssue({
            phase: "duration",
            requestIndex: batchIndex + 1,
            reason: "invalid_payload",
            status: response.status,
          });
          return { durations: new Map<string, number>(), partial: true };
        }

        return {
          durations,
          partial: batch.some((videoId) => !durations.has(videoId)),
        };
      } catch (error) {
        logSourceIssue({
          phase: "duration",
          requestIndex: batchIndex + 1,
          reason: "exception",
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        return { durations: new Map<string, number>(), partial: true };
      }
    })
  );

  let partial = false;
  for (const result of batchResults) {
    partial ||= result.partial;

    for (const [videoId, durationSeconds] of result.durations) {
        durationByVideoId.set(videoId, durationSeconds);
    }
  }

  return { durationByVideoId, partial };
}

const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatSeoulDate(date: Date): string {
  const parts = SEOUL_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not calculate the broadcast archive window");
  }

  return `${year}-${month}-${day}`;
}

function createArchiveResult(
  status: BroadcastArchiveStatus,
  sessions: BroadcastSession[],
  partial: boolean,
  fetchedAt: string
): BroadcastArchiveResult {
  return { status, sessions, partial, fetchedAt };
}

export async function fetchBroadcastArchive({
  apiKey,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  requestTimeoutMs,
}: FetchBroadcastArchiveOptions): Promise<BroadcastArchiveResult> {
  const fetchedAt = now.toISOString();
  const normalizedApiKey = apiKey?.trim();
  const normalizedRequestTimeoutMs = normalizeRequestTimeoutMs(requestTimeoutMs);

  if (!normalizedApiKey) {
    return createArchiveResult("missing_api_key", [], false, fetchedAt);
  }

  const playlist = await collectPlaylistVideos(
    normalizedApiKey,
    fetchImpl,
    normalizedRequestTimeoutMs
  );

  if (!playlist) {
    return createArchiveResult("unavailable", [], false, fetchedAt);
  }

  const uniqueVideoIds = Array.from(new Set(playlist.videos.map((video) => video.videoId)));
  const durations = await collectDurations(
    normalizedApiKey,
    uniqueVideoIds,
    fetchImpl,
    normalizedRequestTimeoutMs
  );
  const cutoffDate = formatSeoulDate(
    new Date(now.getTime() - ARCHIVE_WINDOW_DAYS * MILLISECONDS_PER_DAY)
  );
  const todayDate = formatSeoulDate(now);
  const assets = playlist.videos
    .map((video) =>
      normalizeReplayAsset({
        ...video,
        durationSeconds: durations.durationByVideoId.get(video.videoId) ?? 0,
      })
    )
    .filter(
      (asset) => asset.broadcastDate >= cutoffDate && asset.broadcastDate <= todayDate
    );

  return createArchiveResult(
    "ready",
    groupBroadcastSessions(assets),
    playlist.partial || durations.partial,
    fetchedAt
  );
}
