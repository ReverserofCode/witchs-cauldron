import { MetadataRoute } from "next";
import { POTION_GAME_ENABLED } from "./lib/games/potion-timing/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://moingfans.com";

  // 검색 엔진에 공개할 정적 페이지. 섹션 앵커는 제외한다.
  const routes: Array<{
    url: string;
    lastModified?: string;
    changeFrequency?: MetadataRoute.Sitemap[0]["changeFrequency"];
    priority?: number;
  }> = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/broadcasts`, changeFrequency: "daily", priority: 0.8 },
  ];

  if (POTION_GAME_ENABLED) {
    routes.push({ url: `${baseUrl}/games/potion-timing`, changeFrequency: "daily", priority: 0.6 });
  }

  return routes.map((r) => ({
    url: r.url,
    lastModified: r.lastModified ?? new Date().toISOString(),
    changeFrequency: r.changeFrequency ?? "weekly",
    priority: r.priority ?? 0.7,
  }));
}
