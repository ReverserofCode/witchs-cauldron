import Link from 'next/link'

export function HomeHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-100 via-slate-50 to-purple-100 px-10 py-16 text-center shadow-sm dark:border-indigo-900/60 dark:from-slate-900 dark:via-slate-950 dark:to-indigo-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
          Frontend Starter Kit
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">
          Witch&apos;s Cauldron 프론트엔드 베이스
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300">
          Next.js 14와 Tailwind CSS v4를 기반으로 한 프론트엔드 개발 환경입니다. 공통 레이아웃과 UI 컴포넌트 예시가 준비되어 있어 팀의 개발 가이드를 빠르게 구축할 수 있습니다.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/test"
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          >
            셋업 확인하기
          </Link>
          <Link
            href="https://nextjs.org/docs"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
            target="_blank"
            rel="noreferrer"
          >
            Next.js 문서 보기
          </Link>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_65%)]" />
    </section>
  )
}
