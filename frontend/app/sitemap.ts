import { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://moingfans.com";

  // 정적 경로들: 홈만 노출 (필요시 섹션 앵커는 제외)
  const routes: Array<{
    url: string;
    lastModified?: string;
    changeFrequency?: MetadataRoute.Sitemap[0]["changeFrequency"];
    priority?: number;
  }> = [{ url: `${baseUrl}/`, changeFrequency: "daily", priority: 1.0 }];

  return routes.map((r) => ({
    url: r.url,
    lastModified: r.lastModified ?? new Date().toISOString(),
    changeFrequency: r.changeFrequency ?? "weekly",
    priority: r.priority ?? 0.7,
  }));
}
