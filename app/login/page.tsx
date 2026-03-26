'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // TODO: Supabase Auth 연동 후 실제 로그인 처리
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      {/* Back to dashboard */}
      <div className="relative z-10 w-full max-w-sm mb-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          대시보드로 돌아가기
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Top accent bar */}
        <div className="h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 to-violet-500" />

        <div className="bg-slate-900 rounded-b-2xl border border-slate-800 border-t-0 shadow-2xl overflow-hidden">

          {/* Logo + Title */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-slate-800">
            <div className="flex justify-center mb-4">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8V4H8"/>
                  <rect width="16" height="12" x="4" y="8" rx="2"/>
                  <path d="M2 14h2"/><path d="M20 14h2"/>
                  <path d="M15 13v2"/><path d="M9 13v2"/>
                </svg>
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-white">Global Market Bridge</h1>
            <p className="text-sm text-slate-400 mt-1">AI 투자 인사이트 플랫폼</p>

            {/* Mode toggle */}
            <div className="flex gap-1 mt-5 p-1 bg-slate-800 rounded-xl">
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all
                    ${mode === m
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'}`}
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-6 space-y-5">
            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 {mode === 'login' ? '로그인' : '시작하기'}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-xs text-slate-600">또는</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            {/* Email / PW form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <input
                  type="text"
                  placeholder="닉네임"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              )}
              <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
              {mode === 'signup' && (
                <input
                  type="password"
                  placeholder="비밀번호 확인"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                    비밀번호 찾기
                  </button>
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.99] transition-all shadow-lg shadow-indigo-500/20"
              >
                {mode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 pb-7 text-center space-y-3 border-t border-slate-800 pt-5">
            {/* Features hint */}
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600">
              <span className="flex items-center gap-1">
                <span className="text-emerald-500">✓</span> 즐겨찾기 동기화
              </span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-500">✓</span> 알림 설정
              </span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-500">✓</span> 분석 히스토리
              </span>
            </div>
            <p className="text-[10px] text-slate-600">
              {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-indigo-400 font-semibold hover:underline"
              >
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
            <p className="text-[9px] text-slate-700">
              계속 진행 시{' '}
              <span className="underline cursor-pointer hover:text-slate-500">이용약관</span>
              {' '}및{' '}
              <span className="underline cursor-pointer hover:text-slate-500">개인정보처리방침</span>
              에 동의합니다
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
