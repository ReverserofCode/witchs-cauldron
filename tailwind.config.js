/**
 * Tailwind 설정
 * - content: purge 스캔 경로
 * - theme.container: 중앙 정렬 및 반응형 패딩
 * - extend.colors: Moing 팔레트 프리셋
 * - extend.boxShadow: 브랜디드 섀도우 유틸리티
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        md: '1.5rem',
        lg: '2rem',
      },
    },
    extend: {
      colors: {
        moing: {
          primary: '#9F6AF8',
          accent: '#DBCEF7',
          deep: '#5E4E75',
          pink: '#B9A8CB',
          gold: '#CCC5D2',
          black: '#170D2B',
          white: '#FFFFFF',
        },
      },
      boxShadow: {
        'moing-md': '0 10px 24px rgba(159,106,248,0.22)',
        'moing-deep': '0 10px 24px rgba(94,78,117,0.18)',
      },
    },
  },
  plugins: [],
};
