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
        DEFAULT: '1.5rem',
        sm: '1.5rem',
        md: '1.5rem',
        lg: '1.5rem',
        xl: '1.5rem',
        '2xl': '1.5rem',
      },
    },
    extend: {
      colors: {
        moing: {
          primary: '#A020F0', // 메인 컬러 (rgb(160,32,240))
          accent: '#ADD8E6',  // 밝은 하이라이트 (rgb(173,216,230))
          deep: '#191970',    // 딥/배경 (rgb(25,25,112))
          pink: '#A020F0',    // 핑크도 메인과 통일
          gold: '#ADD8E6',    // 골드도 밝은 하이라이트로 통일
          black: '#191970',   // 블랙도 딥 컬러로 통일
          white: '#FFFFFF',
        },
      },
      boxShadow: {
        'moing-md': '0 10px 24px rgba(160,32,240,0.22)', // #A020F0 기반
        'moing-deep': '0 10px 24px rgba(25,25,112,0.18)', // #191970 기반
      },
    },
  },
  plugins: [],
};
