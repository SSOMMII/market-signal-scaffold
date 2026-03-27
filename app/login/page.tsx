'use client'
import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/Toast'

type Mode = 'login' | 'signup' | 'forgot'

function LoginContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>((params.get('mode') as Mode) ?? 'login')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast('로그인 성공!', 'success')
        router.push(params.get('next') ?? '/')
      } else if (mode === 'signup') {
        if (password !== confirmPassword) { toast('비밀번호가 일치하지 않습니다.', 'error'); return }
        if (password.length < 6) { toast('비밀번호는 6자 이상이어야 합니다.', 'error'); return }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name } },
        })
        if (error) throw error
        router.push(`/verify-email?email=${encodeURIComponent(email)}`)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
        toast('비밀번호 재설정 링크를 이메일로 보냈습니다.', 'success')
        setMode('login')
      }
    } catch (err: unknown) {
      toast(translateError(err instanceof Error ? err.message : '오류가 발생했습니다.'), 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) toast(translateError(error.message), 'error')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">

      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />
      </div>

      {/* 뒤로 가기 */}
      <div className="relative z-10 w-full max-w-sm mb-5">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          대시보드로 돌아가기
        </Link>
      </div>

      {/* 카드 */}
      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* 상단 accent 바 */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />

        {/* 로고 + 탭 */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <div className="flex justify-center mb-4">
            <div className="relative flex h-13 w-13 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/><path d="M20 14h2"/>
                <path d="M15 13v2"/><path d="M9 13v2"/>
              </svg>
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            </div>
          </div>
          <h1 className="text-center text-lg font-bold text-slate-900">Global Market Bridge</h1>
          <p className="text-center text-sm text-slate-400 mt-0.5">AI 투자 인사이트 플랫폼</p>

          {mode !== 'forgot' && (
            <div className="flex gap-1 mt-5 p-1 bg-slate-100 rounded-xl">
              {(['login', 'signup'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
          )}

          {mode === 'forgot' && (
            <div className="mt-5 text-center">
              <p className="text-sm font-semibold text-slate-700">비밀번호 찾기</p>
              <p className="text-xs text-slate-400 mt-1">가입한 이메일로 재설정 링크를 보내드립니다</p>
            </div>
          )}
        </div>

        {/* 폼 */}
        <div className="px-8 py-6 space-y-4">

          {/* Google OAuth */}
          {mode !== 'forgot' && (
            <>
              <button type="button" onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google로 {mode === 'login' ? '로그인' : '시작하기'}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-100" />
                <span className="text-xs text-slate-400">또는</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input type="text" placeholder="이름" value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            )}
            <input type="email" placeholder="이메일" value={email} required
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            {mode !== 'forgot' && (
              <input type="password" placeholder="비밀번호" value={password} required
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            )}
            {mode === 'signup' && (
              <input type="password" placeholder="비밀번호 확인" value={confirmPassword} required
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            )}

            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => setMode('forgot')}
                  className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                  비밀번호 찾기
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.99] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  처리 중...
                </span>
              ) : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 링크 보내기'}
            </button>

            {mode === 'forgot' && (
              <button type="button" onClick={() => setMode('login')}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all"
              >
                로그인으로 돌아가기
              </button>
            )}
          </form>
        </div>

        {/* 푸터 */}
        <div className="px-8 pb-7 pt-2 text-center space-y-3 border-t border-slate-100">
          <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> 알림 설정</span>
            <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> 분석 히스토리</span>
          </div>
          {mode !== 'forgot' && (
            <p className="text-xs text-slate-400">
              {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
              <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-indigo-600 font-semibold hover:underline">
                {mode === 'login' ? '회원가입' : '로그인'}
              </button>
            </p>
          )}
          <p className="text-[10px] text-slate-300">
            계속 진행 시{' '}
            <span className="underline cursor-pointer hover:text-slate-500">이용약관</span>
            {' '}및{' '}
            <span className="underline cursor-pointer hover:text-slate-500">개인정보처리방침</span>
            에 동의합니다
          </p>
        </div>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (msg.includes('Email not confirmed')) return '이메일 인증이 필요합니다. 받은편지함을 확인해주세요.'
  if (msg.includes('User already registered')) return '이미 가입된 이메일입니다.'
  if (msg.includes('Password should be')) return '비밀번호는 6자 이상이어야 합니다.'
  if (msg.includes('Unable to validate email')) return '유효하지 않은 이메일 주소입니다.'
  return msg
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
