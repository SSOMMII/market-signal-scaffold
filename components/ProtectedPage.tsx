'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

interface Props {
  children: React.ReactNode
  /** 로그인 후 돌아올 경로 (기본값: 현재 URL) */
  redirectTo?: string
}

/**
 * 로그인이 필요한 페이지를 감싸는 컴포넌트.
 * 비로그인 시 /login 으로 리다이렉트합니다.
 *
 * 사용법:
 *   export default function PortfolioPage() {
 *     return (
 *       <ProtectedPage>
 *         <div>포트폴리오 내용</div>
 *       </ProtectedPage>
 *     )
 *   }
 */
export default function ProtectedPage({ children, redirectTo }: Props) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      const next = redirectTo ?? window.location.pathname
      router.replace(`/login?next=${encodeURIComponent(next)}`)
    }
  }, [user, loading, router, redirectTo])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          <p className="text-sm">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
