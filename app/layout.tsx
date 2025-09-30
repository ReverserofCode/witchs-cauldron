import { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Demo App',
  description: 'Next.js starter in Docker',
};

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body className="min-h-screen p-6 text-gray-900 bg-white dark:bg-zinc-900 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
