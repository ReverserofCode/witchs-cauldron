export interface NavigationItem {
  label: string
  href: string
  external?: boolean
}

export const mainNavigation: NavigationItem[] = [
  { label: '대시보드', href: '/' },
  { label: '테스트 페이지', href: '/test' },
  { label: '헬스체크 API', href: '/api/health' },
]

export const resourceLinks = [
  {
    title: '프로젝트 가이드',
    description: 'Next.js와 Tailwind CSS 조합으로 작업을 시작하는 방법을 정리했습니다.',
    href: 'https://nextjs.org/docs',
    badge: 'Docs',
  },
  {
    title: 'UI 토큰 정의',
    description: '색상, 타이포그래피 등 디자인 시스템 토큰을 구성하세요.',
    href: 'https://tailwindcss.com/docs/theme',
    badge: 'Design',
  },
  {
    title: 'API 연동 예시',
    description: 'gpt-codex 개발 서버와 통신하는 패턴을 확인하세요.',
    href: '/api/gpt/health',
    badge: 'API',
  },
  {
    title: '테스트 체크리스트',
    description: '기능별 테스트 시나리오를 정리하여 QA 프로세스를 설계하세요.',
    href: 'https://testing-library.com/docs/react-testing-library/intro/',
    badge: 'Testing',
  },
] as const
