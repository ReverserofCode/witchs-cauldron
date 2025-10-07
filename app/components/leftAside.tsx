// 좌측 사이드바: 빠른 링크 네비게이션
import Link from 'next/link'
import type { ReactElement } from 'react'

export default function LeftAside(): ReactElement {
	return (
		<aside className="hidden md:block sticky top-20 self-start surface rounded-xl p-4 w-64">
			<div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">빠른 링크</div>
			<nav>
				<ul className="space-y-1">
					{[
						{ label: '둘러보기', href: '#about' },
						{ label: '문의하기', href: '#contact' },
					].map((i) => (
						<li key={i.href}>
							<Link href={i.href} className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-[rgba(var(--moing-accent),0.35)]">
								{i.label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</aside>
	)
}
