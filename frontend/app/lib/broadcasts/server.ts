import "server-only";

import { fetchBroadcastArchive, type BroadcastArchiveResult } from "./youtube";

export function getBroadcastArchive(): Promise<BroadcastArchiveResult> {
  return fetchBroadcastArchive({
    apiKey: process.env.YOUTUBE_API_KEY,
    fetchImpl: fetch,
    now: new Date(),
  });
}
