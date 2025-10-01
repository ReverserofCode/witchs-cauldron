import Link from 'next/link'
import { Container } from '../ui/Container'
import { mainNavigation } from '@/config/navigation'

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Witch&apos;s Cauldron
        </Link>

        <nav className="flex items-center gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noreferrer' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  )
}
