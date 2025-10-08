// Root layout for the Next.js App Router.
// - 전역 폰트/스타일 적용
// - 공통 GlobalNav / Footer 래핑
// - 페이지 본문은 {children}으로 주입
import { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'
import { Noto_Sans_KR } from 'next/font/google'
import GlobalNav from './components/globalNav'
import Footer from './components/footer'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Moing | Witch's Cauldron",
  description: 'The witch of the potion store – base UI skeleton',
};

interface RootLayoutProps { children: ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSansKr.className} min-h-screen bg-[#7B68EE] text-ink antialiased flex flex-col`}>
        <GlobalNav />
        <main className="flex flex-col flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
