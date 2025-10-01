import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Noto_Sans_KR } from 'next/font/google'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'

const notoSans = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: "Witch's Cauldron",
    template: "%s | Witch's Cauldron",
  },
  description: '프론트엔드 개발을 위한 기본 구조와 예시 UI를 제공하는 Next.js 스타터입니다.',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" className="h-full">
      <body
        className={`${notoSans.className} min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
