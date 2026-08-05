export type BroadcastDateSource = "title" | "publishedAt";

export interface RawReplayVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
}

export interface BroadcastAsset {
  videoId: string;
  title: string;
  displayTitle: string;
  url: string;
  thumbnail: string;
  publishedAt: string;
  durationSeconds: number;
  category: string | null;
  collaborators: string[];
  broadcastDate: string;
  dateSource: BroadcastDateSource;
}

export interface BroadcastSession {
  id: string;
  broadcastDate: string;
  dateSource: BroadcastDateSource;
  assets: BroadcastAsset[];
  totalDurationSeconds: number;
  categories: string[];
  collaborators: string[];
  latestPublishedAt: string;
}
