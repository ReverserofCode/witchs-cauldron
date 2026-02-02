/**
 * Next.js 구성 파일
 * - reactStrictMode: 개발 중 잠재적 사이드 이펙트 탐지 강화
 * - output: standalone - Docker 컨테이너에서 실행할 수 있는 독립적인 서버 생성
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // 이미지 최적화를 위한 설정 (필요한 경우)
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
