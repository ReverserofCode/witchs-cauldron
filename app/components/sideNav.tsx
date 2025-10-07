import Link from 'next/link'

type Item = { label: string; href: string }

export default function SideNav({ items }: { items: Item[] }) {
	return (
		<aside className="sticky self-start hidden p-3 md:block top-20 surface rounded-xl">
			<nav>
				<ul className="space-y-1">
					{items.map((i) => (
						<li key={i.href}>
							<Link
								href={i.href}
								className="block rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-[rgba(var(--moing-accent),0.4)]"
							>
								{i.label}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</aside>
	)
}
