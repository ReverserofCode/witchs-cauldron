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
  { label: '치지직', href: 'https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e' },
  { label: '유튜브', href: 'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ' },
  { label: '유튜브 다시보기', href: 'https://www.youtube.com/@fullmoing'},
  { label: '팬카페', href: 'https://cafe.naver.com/moinge' },
]

function NavIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case '유튜브':
      // 공식 유튜브 로고 스타일
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000" />
          <polygon points="10,9 16,12 10,15" fill="#fff" />
        </svg>
      )
    case '유튜브 다시보기':
      // 긴 장편 다시보기: 플레이+시계 조합 아이콘
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <circle cx="12" cy="12" r="10" fill="#FF0000" />
          <polygon points="11,9 16,12 11,15" fill="#fff" />
          <circle cx="12" cy="12" r="7" stroke="#fff" strokeWidth="1.5" fill="none" />
          <rect x="11.7" y="8" width="1.6" height="5" rx="0.8" fill="#fff" transform="rotate(30 12.5 10.5)" />
        </svg>
      )
    case '팬카페':
      // 네이버 카페(잎사귀) 느낌 SVG
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <ellipse cx="12" cy="12" rx="8" ry="6" fill="#21C531" />
          <path d="M12 18c-2-2-2-6 0-8 2 2 2 6 0 8z" fill="#fff" />
        </svg>
      )
    case '치지직':
      // 치지직 번개 느낌 SVG
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
          <polygon points="13,2 3,14 11,14 9,22 21,8 13,8" fill="#FFD600" stroke="#FFD600" strokeWidth="1.2" />
        </svg>
      )
    default:
      // 기본 아이콘(동그라미)
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

export default function GlobalNav({ brand, items = defaultItems }: GlobalNavProps) {
  return (
    <header className="sticky top-0 z-50 w-full surface">
      <div className="flex items-center justify-between w-full gap-4 py-3 md:gap-4 md:py-2">
        <div className="container flex items-center justify-between w-full">
          <Link href="/" aria-label="홈으로 이동" className="flex items-center gap-3 text-xl font-extrabold md:gap-4 md:text-2xl text-ink rounded-md hover:bg-[rgba(var(--moing-accent),0.35)] p-1">
            <span className="inline-block w-10 h-10 overflow-hidden rounded-full">
              <Image src="/mainPage/favicon_moing.png" alt="Moing" width={40} height={40} className="object-cover w-full h-full" />
            </span>
            {brand ?? <span>마녀의 포션 공방</span>}
          </Link>

          <nav aria-label="글로벌 내비게이션">
            <ul className="items-center hidden gap-2 md:gap-3 md:flex">
              <span>커뮤니티 바로가기</span>
              {items.map((item) => (
                <li key={item.href}>
                  {item.href.startsWith('http') ? (
                    <a
                      className="px-3 py-2 md:px-4 md:py-3 text-ink hover:text-[rgb(var(--moing-deep))] rounded-md hover:bg-[rgba(var(--moing-accent),0.35)]"
                      href={item.href}
                      aria-label={item.label}
                      title={item.label}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <NavIcon name={item.label} className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="sr-only">{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      className="px-3 py-2 md:px-4 md:py-3 text-ink hover:text-[rgb(var(--moing-deep))] rounded-md hover:bg-[rgba(var(--moing-accent),0.35)]"
                      href={item.href}
                      aria-label={item.label}
                      title={item.label}
                    >
                      <NavIcon name={item.label} className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}