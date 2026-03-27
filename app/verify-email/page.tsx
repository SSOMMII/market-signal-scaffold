'use client'
import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyEmailContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? ''

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />

        <div className="px-8 py-10 text-center">
          {/* 아이콘 */}
          <div className="flex justify-center mb-5">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-white border-2 border-white">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </span>
            </div>
          </div>

          <h1 className="text-lg font-bold text-slate-900 mb-2">이메일을 확인하세요</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            {email ? (
              <><span className="font-semibold text-slate-700">{email}</span>으로<br />인증 링크를 보냈습니다.</>
            ) : (
              '가입하신 이메일로 인증 링크를 보냈습니다.'
            )}
          </p>

          {/* 단계 안내 */}
          <div className="mt-6 text-left space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            {[
              '이메일 받은편지함을 열어주세요',
              '\'이메일 주소 확인\' 링크를 클릭하세요',
              '자동으로 로그인되어 대시보드로 이동합니다',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-slate-500">{text}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-5">
            이메일이 오지 않았나요? 스팸 폴더를 확인하거나{' '}
            <Link href={`/login?email=${encodeURIComponent(email)}`}
              className="text-indigo-600 font-semibold hover:underline">
              다시 시도
            </Link>
            해주세요.
          </p>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <Link href="/" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
              </svg>
              대시보드로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}
