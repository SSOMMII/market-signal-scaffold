'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMarket } from '@/context/MarketContext'
import { SunIcon, MoonIcon } from '@/components/icons'

const links = [
  { href: '/',        label: '대시보드', icon: <IconChart /> },
  { href: '/detail',  label: '상세분석', icon: <IconActivity /> },
  { href: '/history', label: '예측이력', icon: <IconClock /> },
]

function IconChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
      <path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  )
}

function IconActivity() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
    </svg>
  )
}

function IconClock() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )
}

function IconBell() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.268 21a2 2 0 0 0 3.464 0"/>
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
    </svg>
  )
}

function IconUser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3 4 7l4 4"/><path d="M4 7h16"/>
      <path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>
    </svg>
  )
}

function MarketToggle() {
  const { market, toggle } = useMarket()
  const isKr = market === 'kr'

  return (
    <button
      onClick={toggle}
      className="relative flex items-center gap-2.5 rounded-full border-2 px-3 py-1.5 transition-all duration-300 hover:shadow-md"
      style={{
        borderColor: isKr ? '#6366f1' : '#8b5cf6',
        background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      aria-label="시장 전환"
    >
      {/* 국장 side */}
      <span className={`flex items-center gap-1.5 transition-all duration-300 ${isKr ? 'text-indigo-600 opacity-100' : 'text-slate-400 opacity-50'}`}>
        <SunIcon size={15} />
        <span className="text-sm font-semibold">국장</span>
      </span>

      {/* Toggle knob */}
      <span className="relative mx-0.5 flex h-7 w-12 rounded-full bg-slate-100 shrink-0">
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full flex items-center justify-center text-white shadow-sm transition-all duration-300"
          style={{
            left: isKr ? '2px' : 'calc(100% - 26px)',
            background: isKr ? '#6366f1' : '#8b5cf6',
          }}
        >
          <SwapIcon />
        </span>
      </span>

      {/* 미장 side */}
      <span className={`flex items-center gap-1.5 transition-all duration-300 ${!isKr ? 'text-violet-600 opacity-100' : 'text-slate-400 opacity-50'}`}>
        <span className="text-sm font-semibold">미장</span>
        <MoonIcon size={15} />
      </span>
    </button>
  )
}

export default function Nav() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop — top bar */}
      <header className="hidden md:flex fixed top-0 inset-x-0 z-50 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="w-full max-w-7xl mx-auto px-6 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-slate-900">Global Market Bridge</p>
              <p className="text-[10px] text-slate-400 leading-none">AI 투자 인사이트</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-1">
            {links.map(({ href, label, icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  pathname === href
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {icon}
                {label}
              </Link>
            ))}
          </nav>

          {/* Market Toggle (right) */}
          <MarketToggle />
        </div>
      </header>

      {/* Mobile — top toggle bar + bottom nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-50 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-center px-4">
        <MarketToggle />
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex bg-white border-t border-slate-200">
        {links.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
              pathname === href ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <span className={`p-1 rounded-lg ${pathname === href ? 'bg-indigo-50' : ''}`}>
              {icon}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  )
}
