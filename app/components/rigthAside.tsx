// 우측 사이드바: 태그/보조 정보 표시
import type { ReactElement } from 'react'

export default function RigthAside(): ReactElement {
	return (
		<aside className="hidden md:block sticky top-20 self-start surface rounded-xl p-4 w-64">
			<div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">태그</div>
			<div className="flex flex-wrap gap-2">
				{['Dangerous', 'Love', 'Healing'].map((t) => (
					<span key={t} className="chip">{t}</span>
				))}
			</div>
		</aside>
	)
}
