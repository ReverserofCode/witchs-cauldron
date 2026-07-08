const SHORT_KO_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "numeric",
  day: "numeric",
});

export interface VideoUploadSummary {
  count: number;
  latestDate: string | null;
  rangeLabel: string | null;
}

export function formatShortKoreanDateLabel(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "날짜 미정";
  }

  return SHORT_KO_DATE_FORMATTER.format(date);
}

export function summarizeVideoUploads(videos: Array<{ publishedAt?: string | null }>): VideoUploadSummary {
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let oldestTimestamp = Number.POSITIVE_INFINITY;

  for (const video of videos) {
    const timestamp = Date.parse(video.publishedAt ?? "");
    if (!Number.isFinite(timestamp)) {
      continue;
    }

    if (timestamp > latestTimestamp) {
      latestTimestamp = timestamp;
    }

    if (timestamp < oldestTimestamp) {
      oldestTimestamp = timestamp;
    }
  }

  if (!Number.isFinite(latestTimestamp) || !Number.isFinite(oldestTimestamp)) {
    return {
      count: videos.length,
      latestDate: null,
      rangeLabel: null,
    };
  }

  const latestDate = formatShortKoreanDateLabel(latestTimestamp);
  const oldestDate = formatShortKoreanDateLabel(oldestTimestamp);

  return {
    count: videos.length,
    latestDate,
    rangeLabel: `${latestDate} ~ ${oldestDate}`,
  };
}
