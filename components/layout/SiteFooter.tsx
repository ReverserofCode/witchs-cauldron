import { Container } from '../ui/Container'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-200 bg-white/70 py-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
      <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-100">Witch&apos;s Cauldron</p>
          <p>프론트엔드 개발을 위한 기본 구조 프로젝트</p>
        </div>
        <p className="text-xs">&copy; {year} Witch&apos;s Cauldron. All rights reserved.</p>
      </Container>
    </footer>
  )
}
