import { ReactNode } from 'react'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'
import { Container } from '../ui/Container'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <Container as="main" className="flex-1 py-12">
        {children}
      </Container>
      <SiteFooter />
    </div>
  )
}
