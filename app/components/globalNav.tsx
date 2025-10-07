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
  { label: '홈', href: '/' },
  { label: '소개', href: '/about' },
  { label: '서비스', href: '/services' },
  { label: '문의', href: '/contact' },
]

export default function GlobalNav({ brand, items = defaultItems }: GlobalNavProps) {
  return (
    <header className="sticky top-0 z-50 px-36 surface">
      <div className="container flex items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="홈으로 이동" className="flex items-center gap-2 text-lg font-extrabold text-ink">
          <Image src="/icon.svg" alt="Moing" width={28} height={28} />
          {brand ?? <span>마녀의 포션공방</span>}
        </Link>

        <nav aria-label="글로벌 내비게이션">
          <ul className="items-center hidden gap-2 md:flex">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  className="px-3 py-2 text-sm font-semibold text-ink hover:text-[rgb(var(--moing-deep))] rounded-md hover:bg-[rgba(var(--moing-accent),0.35)]"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}