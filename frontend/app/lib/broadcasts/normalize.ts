import type { BroadcastAsset, BroadcastSession, RawReplayVideo } from "./types";

const DATE_PREFIX_PATTERN = /^\s*\[(\d{2}|\d{4})\.(\d{2})\.(\d{2})\]\s*/;
const CATEGORY_PATTERN = /【([^】]*)】/g;
const COLLABORATOR_PATTERN = /\((?:with|w\.?)\s*([^)]+)\)/gi;
const SEOUL_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseTitleDate(title: string): string | null {
  const match = DATE_PREFIX_PATTERN.exec(title);

  if (!match) {
    return null;
  }

  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatPublishedAtAsSeoulDate(publishedAt: string): string {
  const parts = SEOUL_DATE_FORMATTER.formatToParts(new Date(publishedAt));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Could not derive the replay's published date");
  }

  return `${year}-${month}-${day}`;
}

function parseCategory(title: string): string | null {
  let category: string | null = null;
  let match = CATEGORY_PATTERN.exec(title);

  while (match) {
    category = match[1].trim() || null;
    match = CATEGORY_PATTERN.exec(title);
  }

  CATEGORY_PATTERN.lastIndex = 0;
  return category;
}

function parseCollaborators(title: string): string[] {
  const collaborators: string[] = [];
  let match = COLLABORATOR_PATTERN.exec(title);

  while (match) {
    collaborators.push(
      ...match[1]
        .split(/[,·/&]/u)
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    );
    match = COLLABORATOR_PATTERN.exec(title);
  }

  COLLABORATOR_PATTERN.lastIndex = 0;
  return collaborators;
}

function cleanDisplayTitle(title: string): string {
  const cleanedTitle = title
    .replace(DATE_PREFIX_PATTERN, "")
    .replace(CATEGORY_PATTERN, "")
    .replace(COLLABORATOR_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanedTitle || title.trim();
}

export function normalizeReplayAsset(video: RawReplayVideo): BroadcastAsset {
  const titleDate = parseTitleDate(video.title);

  return {
    ...video,
    displayTitle: cleanDisplayTitle(video.title),
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`,
    category: parseCategory(video.title),
    collaborators: parseCollaborators(video.title),
    broadcastDate: titleDate ?? formatPublishedAtAsSeoulDate(video.publishedAt),
    dateSource: titleDate ? "title" : "publishedAt",
  };
}

export function groupBroadcastSessions(assets: BroadcastAsset[]): BroadcastSession[] {
  const seenVideoIds = new Set<string>();
  const assetsByDate = new Map<string, BroadcastAsset[]>();

  for (const asset of assets) {
    if (seenVideoIds.has(asset.videoId)) {
      continue;
    }

    seenVideoIds.add(asset.videoId);
    const dateAssets = assetsByDate.get(asset.broadcastDate) ?? [];
    dateAssets.push(asset);
    assetsByDate.set(asset.broadcastDate, dateAssets);
  }

  return Array.from(assetsByDate, ([broadcastDate, dateAssets]): BroadcastSession => {
    const orderedAssets = [...dateAssets].sort((left, right) => {
      const timeDifference = Date.parse(left.publishedAt) - Date.parse(right.publishedAt);
      return timeDifference || left.videoId.localeCompare(right.videoId);
    });
    const categories: string[] = [];
    const collaborators: string[] = [];

    for (const asset of orderedAssets) {
      if (asset.category && !categories.includes(asset.category)) {
        categories.push(asset.category);
      }

      for (const collaborator of asset.collaborators) {
        if (!collaborators.includes(collaborator)) {
          collaborators.push(collaborator);
        }
      }
    }

    return {
      id: `broadcast-${broadcastDate}`,
      broadcastDate,
      dateSource: orderedAssets.some((asset) => asset.dateSource === "publishedAt")
        ? "publishedAt"
        : "title",
      assets: orderedAssets,
      totalDurationSeconds: orderedAssets.reduce(
        (total, asset) => total + asset.durationSeconds,
        0
      ),
      categories,
      collaborators,
      latestPublishedAt: orderedAssets[orderedAssets.length - 1].publishedAt,
    };
  }).sort((left, right) => right.broadcastDate.localeCompare(left.broadcastDate));
}

export function formatDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return "길이 정보 없음";
  }

  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
  }

  return `${seconds}초`;
}

export function formatKoreanBroadcastDate(broadcastDate: string): string {
  const [year, month, day] = broadcastDate.split("-").map(Number);
  const weekday = [
    "일요일",
    "월요일",
    "화요일",
    "수요일",
    "목요일",
    "금요일",
    "토요일",
  ][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${year}년 ${month}월 ${day}일 ${weekday}`;
}
