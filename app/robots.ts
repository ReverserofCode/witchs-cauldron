import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://moingfans.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // API 라우트와 내부 헬스체크는 크롤 금지
          "/api/",
          "/health",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
