import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { MarketProvider } from '@/context/MarketContext'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/Toast'
import AiBotPanel from '@/components/AiBot/AiBotPanel'

export const metadata: Metadata = {
  title: 'Global Market Bridge AI',
  description: '미국장과 국장을 연결하는 AI 기반 주식 예측 서비스',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>
          <ToastProvider>
            <MarketProvider>
              <Nav />
              <main className="pt-14 pb-20 md:pt-16 md:pb-8">
                {children}
              </main>
              <AiBotPanel />
            </MarketProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
