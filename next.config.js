/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const nextConfig = {
  reactStrictMode: true,
  // 개발 중 프런트 → GPT 컨테이너로 프록시 (CORS 회피)
  async rewrites() {
    if (!isDev) return [];
    return [
      {
        source: "/api/gpt/:path*",
        destination: "http://gpt-codex:8080/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
