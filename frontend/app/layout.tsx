// Root layout for the Next.js App Router.
// - 전역 폰트/스타일 적용
// - 공통 Header / Footer 래핑
// - 페이지 본문은 {children}으로 주입
import { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { ReactNode, Suspense } from 'react'
import './globals.css'
import { Noto_Sans_KR } from 'next/font/google'
import { Header, Footer } from '@/app/components/layout'
import AnalyticsProvider from '@/app/components/analytics/AnalyticsProvider'
import { MerchPromotionBanner } from '@/app/components/promotions'

const notoSansKr = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://moingfans.com'),
  title: {
    default: '모잉 팬페이지 | 마녀의 포션 공방',
    template: '%s | 모잉 팬페이지',
  },
  description:
    '모잉(Moing) 팬들을 위한 비공식 커뮤니티 허브. 방송 일정, 하이라이트, 유튜브 최신 영상과 인기 영상 정보를 한곳에서 확인하세요.',
  keywords: [
    '모잉',
    'Moing',
    'V튜버',
    '브이튜버',
    '패러블 엔터테인먼트',
    '패러블 소속',
    '마녀의 포션 공방',
    '방송 일정',
    '유튜브 하이라이트',
    '유튜브 최신 영상',
    '팬페이지',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://moingfans.com/',
    title: '모잉 팬페이지 | 마녀의 포션 공방',
    description:
      '모잉(Moing) 방송 일정과 최신/인기 영상, 하이라이트를 모아보는 팬페이지',
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
    title: '모잉 팬페이지 | 마녀의 포션 공방',
    description:
      '모잉(Moing) 방송 일정과 최신/인기 영상, 하이라이트를 모아보는 팬페이지',
    images: ['https://moingfans.com/mainPage/Profile.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
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

export const viewport: Viewport = {
  themeColor: '#7B68EE',
}

interface RootLayoutProps { children: ReactNode }

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${notoSansKr.className} min-h-screen bg-[rgb(var(--moing-bg))] text-ink antialiased flex flex-col`}>
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
        {/* Structured Data: Organization */}
        <Script id="ldjson-organization" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '패러블 엔터테인먼트',
            alternateName: 'Parable Entertainment',
            url: 'https://moingfans.com/',
            logo: 'https://moingfans.com/logos/parable-ent.svg',
          })}
        </Script>
        {/* Structured Data: Person */}
        <Script id="ldjson-person" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: '모잉',
            alternateName: 'Moing',
            description: '패러블 엔터테인먼트 소속 버튜버 모잉(Moing)',
            affiliation: {
              '@type': 'Organization',
              name: '패러블 엔터테인먼트',
              alternateName: 'Parable Entertainment',
            },
            image: 'https://moingfans.com/mainPage/Profile.png',
            url: 'https://moingfans.com/',
            sameAs: [
              'https://chzzk.naver.com/1d333ff175b4db5bd06f87a88579ec1e',
              'https://www.youtube.com/channel/UCHzre37UF4o64HRhp-7CDzQ',
              'https://www.youtube.com/@fullmoing',
            ],
          })}
        </Script>
        <Suspense fallback={null}>
          <AnalyticsProvider />
        </Suspense>
        <Header />
        <MerchPromotionBanner />
        <main className="flex flex-col flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
