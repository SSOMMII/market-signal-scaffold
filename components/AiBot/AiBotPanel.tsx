'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────
type MarketItem = {
  id: number
  symbol: string
  name: string | null
  market_type: string | null
  asset_type: string | null
}

type Analysis = {
  symbol: string
  name: string
  market: string
  aiScore: number
  signal: '매수' | '매도' | '관망'
  reliability: number
  fearGreed: number
  redditMentions: number
  weeklyIssues: string[]
  technicals: { label: string; value: string; badge: string; up: boolean | null }[]
}

// ── Sub-components ───────────────────────────────────────────────────────────
function BotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/><path d="M20 14h2"/>
      <path d="M15 13v2"/><path d="M9 13v2"/>
    </svg>
  )
}

function ScoreArc({ score }: { score: number }) {
  const norm  = Math.max(0, Math.min(1, (score + 4.5) / 9))
  const total = Math.PI * 35
  const filled = norm * total
  const color = score >= 1.5 ? '#10b981' : score <= -1.0 ? '#ef4444' : '#f59e0b'

  return (
    <div className="relative flex items-end justify-center" style={{ width: 88, height: 52 }}>
      <svg width="88" height="52" viewBox="0 0 88 52" className="absolute bottom-0">
        <path d="M 9,48 A 35,35 0 0,1 79,48"
          fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
        <path d="M 9,48 A 35,35 0 0,1 79,48"
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filled} ${total}`}
          strokeDashoffset="0"/>
      </svg>
      <div className="relative z-10 pb-1 flex flex-col items-center">
        <span style={{ color }} className="text-base font-black leading-none">
          {score > 0 ? '+' : ''}{score}
        </span>
        <span className="text-[9px] text-slate-600 mt-0.5">AI Score</span>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-slate-500 shrink-0">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

// ── Symbol row ───────────────────────────────────────────────────────────────
function SymbolRow({
  item, inWatchlist, onSelect, onToggleStar,
}: {
  item: MarketItem
  inWatchlist: boolean
  onSelect: () => void
  onToggleStar: (e: React.MouseEvent) => void
}) {
  const isKr = item.market_type === 'KR'
  const initials = (item.symbol || '?').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()
  return (
    <div
      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-900 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0
          ${isKr ? 'bg-indigo-500/20 text-indigo-400' : 'bg-violet-500/20 text-violet-400'}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white leading-tight truncate max-w-[140px]">
            {item.name || item.symbol}
          </p>
          <p className="text-[10px] text-slate-500 font-mono">{item.symbol}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className={`text-[10px] rounded px-1.5 py-0.5 font-semibold
          ${isKr ? 'bg-indigo-500/10 text-indigo-400' : 'bg-violet-500/10 text-violet-400'}`}>
          {item.market_type || 'US'}
        </span>
        <button
          onClick={onToggleStar}
          className={`text-lg leading-none transition-colors
            ${inWatchlist ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400'}`}
        >
          ★
        </button>
      </div>
    </div>
  )
}

// ── Analysis View ────────────────────────────────────────────────────────────
function AnalysisView({
  analysis, inWatchlist, onToggleStar, onBack,
}: {
  analysis: Analysis
  inWatchlist: boolean
  onToggleStar: () => void
  onBack: () => void
}) {
  const isKr = analysis.market === 'KR'
  const sigColor =
    analysis.signal === '매수' ? 'text-emerald-400'
    : analysis.signal === '매도' ? 'text-red-400'
    : 'text-amber-400'
  const sigBg =
    analysis.signal === '매수' ? 'bg-emerald-500/10 border-emerald-500/20'
    : analysis.signal === '매도' ? 'bg-red-500/10 border-red-500/20'
    : 'bg-amber-500/10 border-amber-500/20'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Sub-header */}
      <div className="px-5 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          뒤로
        </button>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] rounded-md px-2 py-0.5 bg-slate-800 text-slate-400 font-mono">
                {analysis.symbol}
              </span>
              <span className={`text-[10px] rounded-md px-2 py-0.5 font-semibold
                ${isKr ? 'bg-indigo-500/20 text-indigo-400' : 'bg-violet-500/20 text-violet-400'}`}>
                {analysis.market}
              </span>
            </div>
            <p className="text-white font-bold text-base leading-tight">{analysis.name}</p>
          </div>
          <button
            onClick={onToggleStar}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition-colors
              ${inWatchlist ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-600 hover:text-amber-400'}`}
          >
            ★
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* AI Signal + Score Arc */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
            AI 분석 시그널 <span className="text-slate-700 normal-case font-normal">(기술 지표 기반)</span>
          </p>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-4xl font-black ${sigColor}`}>{analysis.signal}</div>
              <div className={`inline-flex items-center gap-1.5 mt-2 rounded-full px-3 py-1 text-xs font-semibold border ${sigBg} ${sigColor}`}>
                동종업계 대비{' '}
                {analysis.aiScore >= 1.5 ? '상위 20%' : analysis.aiScore <= -1.0 ? '하위 30%' : '중간 수준'}
              </div>
            </div>
            <ScoreArc score={analysis.aiScore} />
          </div>
        </div>

        {/* Data reliability */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
              데이터 신뢰도
            </p>
            <span className="text-sm font-bold text-white">{analysis.reliability}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700
                ${analysis.reliability >= 75 ? 'bg-emerald-500' : analysis.reliability >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${analysis.reliability}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5">
            RSI · MACD · SMA50 실데이터 기반
          </p>
        </div>

        {/* Fear & Greed + Reddit */}
        <div className="space-y-3">

          {/* Fear & Greed */}
          {(() => {
            const fg = analysis.fearGreed
            const label =
              fg <= 25 ? '극단적 공포' : fg <= 45 ? '공포' : fg <= 55 ? '중립' : fg <= 75 ? '탐욕' : '극단적 탐욕'
            const labelColor =
              fg <= 25 ? 'text-red-500' : fg <= 45 ? 'text-orange-400' : fg <= 55 ? 'text-amber-400' : fg <= 75 ? 'text-emerald-400' : 'text-emerald-500'
            const gradientStyle = {
              background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #84cc16, #22c55e)',
            }
            return (
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Fear &amp; Greed Index</p>
                  <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
                </div>
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-3xl font-black text-white leading-none">{fg}</span>
                  <span className="text-xs text-slate-500 mb-1">/ 100</span>
                </div>
                <div className="relative h-2 rounded-full overflow-hidden mb-1" style={gradientStyle}>
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-3.5 w-1.5 rounded-full bg-white shadow-md border border-slate-300"
                    style={{ left: `calc(${fg}% - 3px)` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                  <span>극단 공포</span><span>중립</span><span>극단 탐욕</span>
                </div>
              </div>
            )
          })()}

          {/* Reddit 언급량 */}
          {(() => {
            const n = analysis.redditMentions
            const isKrStock = analysis.market === 'KR'
            if (isKrStock) return null  // KR 종목은 Reddit 데이터 없음

            const level = n >= 500 ? 4 : n >= 200 ? 3 : n >= 80 ? 2 : n > 0 ? 1 : 0
            const levelLabel = ['데이터 없음', '낮음', '보통', '높음', '매우 높음'][level]
            const levelColor = ['text-slate-600', 'text-slate-400', 'text-amber-400', 'text-emerald-400', 'text-emerald-400'][level]
            return (
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Reddit 언급량</p>
                  <span className={`text-xs font-bold ${levelColor}`}>{levelLabel}</span>
                </div>
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-3xl font-black text-white leading-none">
                    {n > 0 ? n.toLocaleString() : '-'}
                  </span>
                  {n > 0 && <span className="text-xs text-slate-500 mb-1">건 · 24h</span>}
                </div>
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-colors
                        ${i <= level
                          ? level >= 4 ? 'bg-emerald-500' : level === 3 ? 'bg-emerald-400' : level === 2 ? 'bg-amber-400' : 'bg-slate-500'
                          : 'bg-slate-800'}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-600 mt-1">
                  <span>낮음</span><span>보통</span><span>높음</span><span>매우 높음</span>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Technical Summary */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
            기술 지표 요약
          </p>
          <div className="space-y-2.5">
            {analysis.technicals.map(t => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">{t.value}</span>
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-semibold
                    ${t.up === true ? 'bg-emerald-500/15 text-emerald-400' : t.up === false ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {t.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주요 이슈 (지표 기반) */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
            지표 기반 주요 시그널
          </p>
          <div className="space-y-2.5">
            {analysis.weeklyIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 rounded px-1.5 py-0.5 mt-0.5 shrink-0">
                  #{i + 1}
                </span>
                <span className="text-xs text-slate-300 leading-relaxed">{issue}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function AnalysisSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>
          </svg>
          뒤로
        </button>
        <div className="h-4 w-32 bg-slate-800 rounded animate-pulse" />
        <div className="h-5 w-24 bg-slate-800 rounded animate-pulse mt-2" />
      </div>
      <div className="flex-1 p-4 space-y-3">
        {[120, 80, 96, 80, 80].map((h, i) => (
          <div key={i} className={`bg-slate-900 rounded-2xl border border-slate-800 animate-pulse`} style={{ height: h }} />
        ))}
      </div>
    </div>
  )
}

// ── Main Panel ───────────────────────────────────────────────────────────────
export default function AiBotPanel() {
  const [open, setOpen]               = useState(false)
  const [tab, setTab]                 = useState<'search' | 'watchlist'>('search')
  const [query, setQuery]             = useState('')
  const [masters, setMasters]         = useState<MarketItem[]>([])
  const [watchlist, setWatchlist]     = useState<string[]>([])
  const [selected, setSelected]       = useState<string | null>(null)
  const [analysis, setAnalysis]       = useState<Analysis | null>(null)
  const [loadingAnalysis, setLoading] = useState(false)
  const { user, signOut } = useAuth()
  const router = useRouter()

  // 패널 열릴 때 마켓 마스터 목록 로드
  useEffect(() => {
    if (open && masters.length === 0) {
      fetch('/api/market-masters')
        .then(r => r.json())
        .then(({ data }) => { if (data?.length) setMasters(data) })
        .catch(() => {})
    }
  }, [open, masters.length])

  // 즐겨찾기 localStorage 복원
  useEffect(() => {
    const saved = localStorage.getItem('gmb_watchlist')
    if (saved) {
      try { setWatchlist(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  // 종목 선택 시 실데이터 분석 fetch
  useEffect(() => {
    if (!selected) { setAnalysis(null); return }
    setLoading(true)
    setAnalysis(null)
    fetch(`/api/analysis/${selected}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setAnalysis(data)
      })
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false))
  }, [selected])

  function saveWatchlist(list: string[]) {
    setWatchlist(list)
    localStorage.setItem('gmb_watchlist', JSON.stringify(list))
  }

  function toggleWatchlist(symbol: string) {
    saveWatchlist(
      watchlist.includes(symbol)
        ? watchlist.filter(s => s !== symbol)
        : [...watchlist, symbol]
    )
  }

  // INDEX, FX, FUTURE 제외 — 기술 지표 데이터가 없는 종목 유형
  const tradeable = masters.filter(m =>
    m.asset_type !== 'INDEX' && m.asset_type !== 'FX' && m.asset_type !== 'FUTURE'
  )

  const filtered = query.trim().length >= 1
    ? tradeable.filter(m =>
        m.symbol.toLowerCase().includes(query.toLowerCase()) ||
        (m.name ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : tradeable.slice(0, 10)

  const watchlistItems = tradeable.filter(m => watchlist.includes(m.symbol))

  function handleClose() {
    setOpen(false)
    setSelected(null)
  }

  return (
    <>
      {/* ── Floating trigger button ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
          aria-label="AI 어시스턴트 열기"
        >
          <BotIcon size={22} />
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
        </button>
      )}

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      )}

      {/* ── Panel ── */}
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-full md:w-[400px]
        bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <BotIcon size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">AI 어시스턴트</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[10px] text-slate-500">종목 분석 · 즐겨찾기</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                  {(user.user_metadata?.name?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                </div>
                <span className="max-w-[60px] truncate">
                  {user.user_metadata?.name ?? user.email?.split('@')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => { handleClose(); router.push('/login') }}
                className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-colors"
              >
                로그인
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="닫기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Analysis view (loading or loaded) ── */}
        {selected && (
          loadingAnalysis
            ? <AnalysisSkeleton onBack={() => setSelected(null)} />
            : analysis
              ? <AnalysisView
                  analysis={analysis}
                  inWatchlist={watchlist.includes(analysis.symbol)}
                  onToggleStar={() => toggleWatchlist(analysis.symbol)}
                  onBack={() => setSelected(null)}
                />
              : (
                <div className="flex flex-col flex-1 items-center justify-center gap-3 p-8 text-center">
                  <p className="text-sm text-slate-400">분석 데이터를 불러올 수 없습니다</p>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    목록으로 돌아가기
                  </button>
                </div>
              )
        )}

        {/* ── Search / Watchlist ── */}
        {!selected && (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-slate-800 shrink-0">
              {(['search', 'watchlist'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2
                    ${tab === t
                      ? 'text-white border-indigo-500'
                      : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                  {t === 'search'
                    ? '🔍 종목 검색'
                    : `⭐ 즐겨찾기${watchlist.length > 0 ? ` (${watchlist.length})` : ''}`}
                </button>
              ))}
            </div>

            {/* ── Search tab ── */}
            {tab === 'search' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 shrink-0">
                  <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-3 py-2.5 border border-slate-800 focus-within:border-indigo-500/60 transition-colors">
                    <SearchIcon />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="종목코드 또는 종목명 검색..."
                      className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {query && (
                      <button onClick={() => setQuery('')} className="text-slate-600 hover:text-white transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {masters.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-slate-500">검색 결과가 없습니다</p>
                      <p className="text-xs text-slate-700 mt-1">&quot;{query}&quot;</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-0.5">
                      {!query && (
                        <p className="px-3 py-2 text-[10px] text-slate-600 font-semibold uppercase tracking-wider">
                          등록된 종목
                        </p>
                      )}
                      {filtered.map(item => (
                        <SymbolRow
                          key={item.id}
                          item={item}
                          inWatchlist={watchlist.includes(item.symbol)}
                          onSelect={() => setSelected(item.symbol)}
                          onToggleStar={e => { e.stopPropagation(); toggleWatchlist(item.symbol) }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Watchlist tab ── */}
            {tab === 'watchlist' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {watchlist.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center px-8">
                    <div className="text-4xl">⭐</div>
                    <p className="text-sm text-slate-400">즐겨찾기한 종목이 없습니다</p>
                    <p className="text-xs text-slate-600">검색 탭에서 ★를 눌러 추가하세요</p>
                    <button
                      onClick={() => setTab('search')}
                      className="mt-2 rounded-xl bg-indigo-500/20 px-5 py-2.5 text-xs font-semibold text-indigo-400 hover:bg-indigo-500/30 transition-colors"
                    >
                      종목 검색하기
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-3 space-y-0.5 mt-2">
                    {watchlistItems.length > 0
                      ? watchlistItems.map(item => (
                          <SymbolRow
                            key={item.id}
                            item={item}
                            inWatchlist={true}
                            onSelect={() => setSelected(item.symbol)}
                            onToggleStar={e => { e.stopPropagation(); toggleWatchlist(item.symbol) }}
                          />
                        ))
                      : watchlist.map(sym => (
                          <button
                            key={sym}
                            onClick={() => setSelected(sym)}
                            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-slate-900 transition-colors"
                          >
                            <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 shrink-0">
                              {sym.slice(0, 2)}
                            </div>
                            <p className="text-sm font-semibold text-white">{sym}</p>
                          </button>
                        ))
                    }
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </>
  )
}
