'use client'
import { useState, useEffect } from 'react'
import LoginModal from './LoginModal'

// ── Types ────────────────────────────────────────────────────────────────────
type MarketItem = {
  id: number
  symbol: string
  name: string | null
  market: string | null
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

// ── Mock analysis generator ──────────────────────────────────────────────────
// Deterministic pseudo-random from symbol string so values are stable per symbol
function hashOf(s: string) {
  return s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0)
}

function buildAnalysis(item: MarketItem): Analysis {
  const h = hashOf(item.symbol)
  const score = Math.round(((h % 90) - 45) / 10 * 10) / 10  // -4.5 ~ +4.5
  const signal: '매수' | '매도' | '관망' =
    score >= 1.5 ? '매수' : score <= -1.0 ? '매도' : '관망'
  const rsi = 25 + (h % 55)
  const fg  = 20 + (h % 65)

  return {
    symbol: item.symbol,
    name: item.name || item.symbol,
    market: item.market || 'US',
    aiScore: score,
    signal,
    reliability: 55 + (h % 40),
    fearGreed: fg,
    redditMentions: 40 + (h % 900),
    weeklyIssues: [
      `${item.name || item.symbol} 관련 긍정 분석 증가`,
      `기관 수급 변화 포착`,
      `실적 발표 일정 주목`,
    ],
    technicals: [
      { label: 'RSI (14)', value: String(rsi),
        badge: rsi >= 70 ? '과매수' : rsi <= 30 ? '과매도' : '중립',
        up: rsi <= 30 ? true : rsi >= 70 ? false : null },
      { label: 'MACD', value: score >= 0 ? `+${(score * 0.3).toFixed(2)}` : `${(score * 0.3).toFixed(2)}`,
        badge: score >= 0 ? '매수' : '매도', up: score >= 0 },
      { label: 'SMA 50', value: score >= 0 ? '상회' : '하회',
        badge: score >= 0 ? '상승' : '하락', up: score >= 0 },
    ],
  }
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
  // Normalize -4.5~+4.5 → 0~1, map to semicircle arc
  const norm  = Math.max(0, Math.min(1, (score + 4.5) / 9))
  const total = Math.PI * 35 // ≈ 109.96
  const filled = norm * total
  const color = score >= 1.5 ? '#10b981' : score <= -1.0 ? '#ef4444' : '#f59e0b'

  return (
    <div className="relative flex items-end justify-center" style={{ width: 88, height: 52 }}>
      <svg width="88" height="52" viewBox="0 0 88 52" className="absolute bottom-0">
        {/* track */}
        <path d="M 9,48 A 35,35 0 0,1 79,48"
          fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"/>
        {/* fill */}
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

function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )
}

// ── Symbol row (used in both search + watchlist) ─────────────────────────────
function SymbolRow({
  item, inWatchlist, onSelect, onToggleStar,
}: {
  item: MarketItem
  inWatchlist: boolean
  onSelect: () => void
  onToggleStar: (e: React.MouseEvent) => void
}) {
  const isKr = item.market === 'KR'
  const initials = (item.symbol || '?').replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 hover:bg-slate-900 transition-colors text-left"
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
          {item.market || 'US'}
        </span>
        <button
          onClick={onToggleStar}
          className={`text-lg leading-none transition-colors
            ${inWatchlist ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400'}`}
        >
          ★
        </button>
      </div>
    </button>
  )
}

// ── Analysis View ────────────────────────────────────────────────────────────
function AnalysisView({
  analysis, inWatchlist, onToggleStar, onBack, isLoggedIn, onLoginClick,
}: {
  analysis: Analysis
  inWatchlist: boolean
  onToggleStar: () => void
  onBack: () => void
  isLoggedIn: boolean
  onLoginClick: () => void
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
            AI 분석 시그널
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
            기술지표 · 감성분석 · Reddit 데이터 종합
          </p>
        </div>

        {/* Fear & Greed + Reddit */}
        <div className="space-y-3">

          {/* Fear & Greed — 0~100 스펙트럼 게이지 */}
          {(() => {
            const fg = analysis.fearGreed
            const label =
              fg <= 25 ? '극단적 공포' : fg <= 45 ? '공포' : fg <= 55 ? '중립' : fg <= 75 ? '탐욕' : '극단적 탐욕'
            const labelColor =
              fg <= 25 ? 'text-red-500' : fg <= 45 ? 'text-orange-400' : fg <= 55 ? 'text-amber-400' : fg <= 75 ? 'text-emerald-400' : 'text-emerald-500'
            // 게이지 색: 빨강→주황→노랑→연두→초록
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
                {/* 스펙트럼 게이지 */}
                <div className="relative h-2 rounded-full overflow-hidden mb-1" style={gradientStyle}>
                  {/* 포인터 */}
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

          {/* Reddit 언급 — 상대적 레벨 바 */}
          {(() => {
            const n = analysis.redditMentions
            // 500 이상이면 매우 높음 기준
            const level = n >= 500 ? 4 : n >= 200 ? 3 : n >= 80 ? 2 : 1
            const levelLabel = ['', '낮음', '보통', '높음', '매우 높음'][level]
            const levelColor = ['', 'text-slate-400', 'text-amber-400', 'text-emerald-400', 'text-emerald-400'][level]
            return (
              <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Reddit 언급량</p>
                  <span className={`text-xs font-bold ${levelColor}`}>{levelLabel}</span>
                </div>
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-3xl font-black text-white leading-none">{n.toLocaleString()}</span>
                  <span className="text-xs text-slate-500 mb-1">건 · 7일</span>
                </div>
                {/* 레벨 바 (4단계) */}
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

        {/* Reddit Issues */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">
            Reddit 주요 이슈 (7일)
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

        {/* Login CTA */}
        {!isLoggedIn && (
          <button
            onClick={onLoginClick}
            className="w-full rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 text-center hover:bg-indigo-500/20 transition-colors"
          >
            <p className="text-sm font-semibold text-indigo-400">
              로그인하면 즐겨찾기 기기 간 동기화
            </p>
            <p className="text-xs text-slate-500 mt-1">알림 설정 · 분석 히스토리 보관</p>
          </button>
        )}
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
  const [showLogin, setShowLogin]     = useState(false)
  const [isLoggedIn, setIsLoggedIn]   = useState(false)

  // Fetch market masters once panel is opened
  useEffect(() => {
    if (open && masters.length === 0) {
      fetch('/api/market-masters')
        .then(r => r.json())
        .then(({ data }) => { if (data?.length) setMasters(data) })
        .catch(() => {})
    }
  }, [open, masters.length])

  // Persist watchlist in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gmb_watchlist')
    if (saved) {
      try { setWatchlist(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

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

  // Filter search results
  const filtered = query.trim().length >= 1
    ? masters.filter(m =>
        m.symbol.toLowerCase().includes(query.toLowerCase()) ||
        (m.name ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : masters.slice(0, 10)

  const selectedItem  = masters.find(m => m.symbol === selected) ?? null
  const analysis      = selectedItem ? buildAnalysis(selectedItem) : null
  const watchlistItems = masters.filter(m => watchlist.includes(m.symbol))

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
          {/* Online indicator */}
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
            {isLoggedIn ? (
              <button
                onClick={() => setIsLoggedIn(false)}
                className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center text-[9px] font-bold text-white">
                  S
                </div>
                SSOMMII
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
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

        {/* ── Analysis view ── */}
        {selected && analysis ? (
          <AnalysisView
            analysis={analysis}
            inWatchlist={watchlist.includes(analysis.symbol)}
            onToggleStar={() => toggleWatchlist(analysis.symbol)}
            onBack={() => setSelected(null)}
            isLoggedIn={isLoggedIn}
            onLoginClick={() => setShowLogin(true)}
          />
        ) : (
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
                {/* Search input */}
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

                {/* Results */}
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
                {/* Login sync banner */}
                {!isLoggedIn && (
                  <div className="mx-4 mt-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 flex items-start gap-2.5 shrink-0">
                    <div className="text-indigo-400 mt-0.5 shrink-0"><InfoIcon /></div>
                    <div>
                      <p className="text-xs font-semibold text-indigo-300">로그인하면 기기 간 동기화</p>
                      <button
                        onClick={() => setShowLogin(true)}
                        className="text-[10px] text-indigo-400 underline hover:text-indigo-300 transition-colors"
                      >
                        지금 로그인하기 →
                      </button>
                    </div>
                  </div>
                )}

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

      {/* ── Login modal ── */}
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onLogin={() => { setIsLoggedIn(true); setShowLogin(false) }}
        />
      )}
    </>
  )
}
