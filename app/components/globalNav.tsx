// 상단 글로벌 네비게이션 바
// - brand: 좌측 로고 영역 교체용 ReactNode
// - items: 우측 메뉴 항목 배열
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

type NavItem = { label: string; href: string }

interface GlobalNavProps {
  brand?: ReactNode
  items?: NavItem[]
}

const defaultItems: NavItem[] = [
  { label: '치지직', href: '/' },
  { label: '유튜브', href: '/about' },
  { label: '팬카페', href: '/services' },
  { label: '디스코드', href: '/contact' },
]

function NavIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case '유튜브':
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="currentColor"
        >
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M10 9.5v5l5-2.5-5-2.5z" fill="#fff" />
        </svg>
      )
    case '디스코드':
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 7c3-1.5 7-1.5 10 0 1.7 1 3 3 3 5.2 0 1.8-1 3.4-2.6 4.4-.7-.8-1.5-1.5-2.4-2 .3-.3.6-.8.7-1.3-.6.4-1.3.7-2 .8-.7-.1-1.4-.4-2-.8.1.5.4 1 .7 1.3-.9.5-1.7 1.2-2.4 2C5 15.6 4 14 4 12.2 4 10 5.3 8 7 7z" />
          <circle cx="9.5" cy="12" r="1" fill="currentColor" />
          <circle cx="14.5" cy="12" r="1" fill="currentColor" />
        </svg>
      )
    case '팬카페':
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 8a4 4 0 0 1 6-3.5A4 4 0 0 1 20 8c0 5-8 8.5-8 8.5S4 13 4 8z" />
        </svg>
      )
    case '치지직':
    default:
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5,12 12,5 12,10 19,3 12,14 12,10 5,17" />
        </svg>
      )
  }
}

export default function GlobalNav({ brand, items = defaultItems }: GlobalNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full surface">
      <div className="flex items-center justify-between w-full gap-4 py-3 md:gap-4 md:py-2">
        <div className="container flex items-center justify-between w-full">
          <Link href="/" aria-label="홈으로 이동" className="flex items-center gap-3 text-xl font-extrabold md:gap-4 md:text-2xl text-ink">
            <Image src="/mainPage/favicon_moing.png" alt="Moing" width={40} height={40} />
            {brand ?? <span>마녀의 포션공방</span>}
          </Link>

          <nav aria-label="글로벌 내비게이션">
            <ul className="items-center hidden gap-2 md:gap-3 md:flex">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    className="px-3 py-2 md:px-4 md:py-3 text-ink hover:text-[rgb(var(--moing-deep))] rounded-md hover:bg-[rgba(var(--moing-accent),0.35)]"
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <NavIcon name={item.label} className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}