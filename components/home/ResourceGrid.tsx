import Link from 'next/link'
import { resourceLinks } from '@/config/navigation'

export function ResourceGrid() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">프로젝트 탐색</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          기본 구조를 확장하거나 팀 온보딩 자료로 활용할 수 있는 리소스를 모았습니다.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {resourceLinks.map((resource) => {
          const isExternal = resource.href.startsWith('http')

          return (
            <Link
              key={resource.href}
              href={resource.href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noreferrer' : undefined}
              className="group relative flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
            >
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/20 dark:text-indigo-300 dark:group-hover:bg-indigo-500 dark:group-hover:text-white">
                  {resource.badge}
                </span>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{resource.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{resource.description}</p>
                </div>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition group-hover:text-indigo-500 dark:text-indigo-400 dark:group-hover:text-indigo-300">
                {isExternal ? '문서 열기' : '바로 가기'}
                <svg
                  aria-hidden
                  width="24"
                  height="24"
                  className="h-4 w-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M5 12h14m0 0-6-6m6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
