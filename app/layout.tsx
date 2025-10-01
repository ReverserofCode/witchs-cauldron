import { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Moing | Witch\'s Cauldron',
  description: 'The witch of the potion store – base UI skeleton',
};

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.className} min-h-dvh bg-page text-ink antialiased`}> 
        {children}
      </body>
    </html>
  );
}
