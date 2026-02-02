// Root layout for the Next.js App Router.
// - 전역 폰트/스타일 적용
// - 공통 Header / Footer 래핑
// - 페이지 본문은 {children}으로 주입
import { Metadata } from 'next'
import Script from 'next/script'
import { ReactNode } from 'react'
import './globals.css'
import { Noto_Sans_KR } from 'next/font/google'
import { Header, Footer } from '@/app/components/layout'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://moingfans.com'),
  title: {
    default: '모잉 팬 페이지 | 마녀의 포션 공방',
    template: '%s | 모잉 팬 페이지',
  },
  description:
    '모잉(Moing) 팬들을 위한 비공식 커뮤니티 허브. 방송 일정, 하이라이트, 유튜브 최신 영상과 인기 영상 정보를 한곳에서 확인하세요.',
  keywords: [
    '모잉',
    'Moing',
    'V튜버',
    '브이튜버',
    '마녀의 포션 공방',
    '방송 일정',
    '유튜브 하이라이트',
    '유튜브 최신 영상',
    '팬 페이지',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://moingfans.com/',
    title: '모잉 팬 페이지 | 마녀의 포션 공방',
    description:
      '모잉(Moing) 방송 일정과 최신/인기 영상, 하이라이트를 모아보는 팬 페이지',
    siteName: 'Moing Fans',
    images: [
      {
        url: 'https://moingfans.com/mainPage/Profile.png',
        width: 1200,
        height: 630,
        alt: 'Moing Profile',
      },
    ],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '모잉 팬 페이지 | 마녀의 포션 공방',
    description:
      '모잉(Moing) 방송 일정과 최신/인기 영상, 하이라이트를 모아보는 팬 페이지',
    images: ['https://moingfans.com/mainPage/Profile.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  themeColor: '#7B68EE',
  applicationName: 'Moing Fans',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

interface RootLayoutProps { children: ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSansKr.className} min-h-screen bg-[#7B68EE] text-ink antialiased flex flex-col`}>
        {/* Structured Data: Website */}
        <Script id="ldjson-website" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Moing Fans',
            url: 'https://moingfans.com/',
            inLanguage: 'ko-KR',
            description:
              '모잉(Moing) 팬들을 위한 비공식 커뮤니티 허브. 방송 일정, 하이라이트, 유튜브 최신/인기 영상 정보를 한곳에서 확인하세요.',
          })}
        </Script>
        <Header />
        <main className="flex flex-col flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
