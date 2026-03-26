'use client'

interface Props {
  onClose: () => void
  onLogin?: () => void
}

export default function LoginModal({ onClose, onLogin }: Props) {
  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto">
      {/* Backdrop — absolute (fixed 아님): 외부 fixed 컨테이너가 viewport를 커버하므로 충분 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centering wrapper */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4 py-8">

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-500" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="닫기"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-slate-100">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4H8"/>
                <rect width="16" height="12" x="4" y="8" rx="2"/>
                <path d="M2 14h2"/><path d="M20 14h2"/>
                <path d="M15 13v2"/><path d="M9 13v2"/>
              </svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Global Market Bridge</h2>
          <p className="text-sm text-slate-500 mt-1">AI 어시스턴트에 로그인하세요</p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Google OAuth */}
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google로 로그인
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400">또는 이메일로 계속</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Email form */}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="이메일"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <input
              type="password"
              placeholder="비밀번호"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
            <button
              onClick={onLogin}
              className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              로그인
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-2">
          <p className="text-xs text-slate-500">
            계정이 없으신가요?{' '}
            <button onClick={onLogin} className="text-indigo-600 font-semibold hover:underline">
              회원가입
            </button>
          </p>
          <p className="text-[10px] text-slate-300">
            로그인 시{' '}
            <span className="underline cursor-pointer">이용약관</span>
            {' '}및{' '}
            <span className="underline cursor-pointer">개인정보처리방침</span>
            에 동의합니다
          </p>
        </div>
      </div>

      </div>{/* centering wrapper */}
    </div>
  )
}
