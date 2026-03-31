'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMarket } from '@/context/MarketContext'
import { krData, usData, type StripItem, type IndicatorItem } from '@/lib/marketData'
import { MiniChart } from '@/components/MiniChart'
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@/components/icons'
import { GeoRiskPanel } from '@/components/GeoRiskPanel'

// ── 포맷 헬퍼 ──────────────────────────────────────────────────────────
function fmt0(v: number | null) { return v ? Math.round(v).toLocaleString() : '-' }
function fmt1(v: number | null) { return v ? v.toFixed(1) : '-' }
function fmt2(v: number | null) { return v ? v.toFixed(2) : '-' }
function fmtPct(v: number | null) {
  if (v == null) return '-'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

// ── 기술적 지표 → UI 매핑 ───────────────────────────────────────────────
function buildIndicators(row: Record<string, any>): IndicatorItem[] {
  const close = Number(row.close)
  const rsi = Number(row.rsi)
  const macd = Number(row.macd)
  const signal = Number(row.signal_line)
  const sma50 = Number(row.sma_50)
  const sma200 = Number(row.sma_200)
  const bbUp = Number(row.bollinger_upper)
  const bbLow = Number(row.bollinger_lower)
  const stochK = Number(row.stoch_k)

  const rsiBadge = rsi >= 70 ? { badge: '과매수', cls: 'badge-sell', sub: '과매수 구간' }
    : rsi <= 30 ? { badge: '과매도', cls: 'badge-buy', sub: '과매도 구간' }
    : { badge: '중립', cls: 'badge-hold', sub: '중립 구간' }

  return [
    { label: 'RSI (14)',   value: fmt1(rsi),       sub: rsiBadge.sub, badge: rsiBadge.badge, cls: rsiBadge.cls },
    { label: 'MACD',       value: macd >= 0 ? `+${fmt2(macd)}` : fmt2(macd),
      sub: macd > signal ? 'Signal 상회' : 'Signal 하회',
      badge: macd > signal ? '매수' : '매도', cls: macd > signal ? 'badge-up' : 'badge-sell' },
    { label: '이동평균',   value: fmt0(sma50),
      sub: close > sma50 ? '50MA 상회' : '50MA 하회',
      badge: close > sma50 ? '상승' : '하락', cls: close > sma50 ? 'badge-up' : 'badge-sell' },
    { label: 'SMA 200',    value: fmt0(sma200),
      sub: close > sma200 ? '장기 상승추세' : '장기 하락추세',
      badge: close > sma200 ? '강세' : '약세', cls: close > sma200 ? 'badge-up' : 'badge-sell' },
    { label: '볼린저밴드', value: close > bbUp ? '상단' : close < bbLow ? '하단' : '중단',
      sub: close > bbUp ? '밴드 상단 돌파' : close < bbLow ? '밴드 하단 이탈' : '밴드 내부',
      badge: close > bbUp ? '과매수' : close < bbLow ? '과매도' : '중립',
      cls: close > bbUp ? 'badge-sell' : close < bbLow ? 'badge-buy' : 'badge-hold' },
    { label: '스토캐스틱', value: fmt1(stochK),
      sub: stochK >= 80 ? '과매수 구간' : stochK <= 20 ? '과매도 구간' : '중립 구간',
      badge: stochK >= 80 ? '과매수' : stochK <= 20 ? '과매도' : '중립',
      cls: stochK >= 80 ? 'badge-sell' : stochK <= 20 ? 'badge-buy' : 'badge-hold' },
  ]
}

type GlobalSnap = {
  sp500:   { value: number | null; change: number | null }
  nasdaq:  { value: number | null; change: number | null }
  vix:     { value: number | null; change: number | null }
  wti:     { value: number | null; change: number | null }
  gold:    { value: number | null; change: number | null }
  usd_krw: { value: number | null; change: number | null }
  as_of:   string
}

type RealSignalItem = {
  ticker: string
  name: string
  change: string
  score: number        // 하이브리드 0-100
  techScore: number
  aiScore: number | null
  aiLabel: string | null
  confidence: number | null  // LightGBM 신뢰도 (0-1)
  action: string
  signalStrength: string  // 5분류 (이모지 포함)
  up: boolean
  hasAI: boolean
}

export default function DashboardPage() {
  const { market } = useMarket()
  const d = market === 'kr' ? krData : usData
  const isKr = market === 'kr'

  // ── 실시간 데이터 상태 ──────────────────────────────────────────────
  const [globalSnap, setGlobalSnap] = useState<GlobalSnap | null>(null)
  const [activeRows, setActiveRows] = useState<Record<string, any>[]>([])
  const [index2Rows, setIndex2Rows] = useState<Record<string, any>[]>([])
  const [realSignals, setRealSignals] = useState<RealSignalItem[] | null>(null)
  const [foreignFlow, setForeignFlow] = useState<{ net_buy_str: string } | null>(null)

  useEffect(() => {
    fetch('/api/global-indicators')
      .then(r => r.json())
      .then(({ data }) => { if (data) setGlobalSnap(data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const symbol = isKr ? '^KS11' : '^GSPC'
    setActiveRows([])
    fetch(`/api/market-summary?symbol=${symbol}`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.length) setActiveRows(data) })
      .catch(() => {})
  }, [isKr])

  useEffect(() => {
    const symbol = isKr ? '^KQ11' : '^IXIC'
    setIndex2Rows([])
    fetch(`/api/market-summary?symbol=${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.length) setIndex2Rows(data) })
      .catch(() => {})
  }, [isKr])

  useEffect(() => {
    fetch(`/api/signals?market=${isKr ? 'kr' : 'us'}`)
      .then(r => r.json())
      .then(({ data }) => { if (data?.length) setRealSignals(data) })
      .catch(() => {})
  }, [isKr])

  useEffect(() => {
    if (!isKr) return
    setForeignFlow(null)
    fetch('/api/foreign-flow?market=KRX')
      .then(r => r.json())
      .then(({ data }) => { if (data) setForeignFlow(data) })
      .catch(() => {})
  }, [isKr])

  // ── 실제 데이터 → UI 포맷 변환 ─────────────────────────────────────
  const latestRow = activeRows[0]
  const closeArr = [...activeRows].reverse().map(r => Number(r.close)).filter(Boolean)

  const realGlobalStrip: StripItem[] | null = globalSnap ? [
    { name: 'S&P 500', value: fmt0(globalSnap.sp500.value),   change: fmtPct(globalSnap.sp500.change),   up: (globalSnap.sp500.change ?? 0) >= 0 },
    { name: 'NASDAQ',  value: fmt0(globalSnap.nasdaq.value),  change: fmtPct(globalSnap.nasdaq.change),  up: (globalSnap.nasdaq.change ?? 0) >= 0 },
    { name: 'VIX',     value: fmt2(globalSnap.vix.value),     change: fmtPct(globalSnap.vix.change),     up: (globalSnap.vix.change ?? 0) < 0 },
    { name: 'WTI',     value: `$${fmt2(globalSnap.wti.value)}`,     change: fmtPct(globalSnap.wti.change),     up: (globalSnap.wti.change ?? 0) >= 0 },
    { name: 'Gold',    value: `$${fmt0(globalSnap.gold.value)}`,    change: fmtPct(globalSnap.gold.change),    up: (globalSnap.gold.change ?? 0) >= 0 },
    { name: 'USD/KRW', value: fmt1(globalSnap.usd_krw.value), change: fmtPct(globalSnap.usd_krw.change), up: (globalSnap.usd_krw.change ?? 0) >= 0 },
  ] : null

  const realStripPreview: StripItem[] | null = globalSnap ? [
    { name: 'S&P 500', value: fmt0(globalSnap.sp500.value),  change: fmtPct(globalSnap.sp500.change),  up: (globalSnap.sp500.change ?? 0) >= 0 },
    { name: 'NASDAQ',  value: fmt0(globalSnap.nasdaq.value), change: fmtPct(globalSnap.nasdaq.change), up: (globalSnap.nasdaq.change ?? 0) >= 0 },
    { name: 'USD/KRW', value: fmt1(globalSnap.usd_krw.value),change: fmtPct(globalSnap.usd_krw.change),up: (globalSnap.usd_krw.change ?? 0) >= 0 },
  ] : null

  // RSI 등 지표가 실제 계산된 경우만 사용 (null이면 mock 유지)
  const realIndicators: IndicatorItem[] | null =
    latestRow?.rsi != null ? buildIndicators(latestRow) : null

  // ── Day Insight 실데이터 계산 ────────────────────────────────────────
  const avgScore = realSignals?.length
    ? realSignals.reduce((s, r) => s + r.score, 0) / realSignals.length
    : null

  const realInsightDir: string | null = avgScore != null
    ? avgScore >= 60 ? '상승 예상' : avgScore <= 40 ? '하락 예상' : '보합 예상'
    : null

  // 신호 강도: 방향별로 0~100% 범위로 정규화
  // · 상승 예상(60~100): 0~100% → (score-60)/40*100
  // · 하락 예상(0~40):  0~100% → (40-score)/40*100
  // · 보합 예상(40~60): 중립 거리 기준, 50 근접일수록 높음
  const realInsightConf: number | null = avgScore != null
    ? avgScore >= 60
      ? Math.round((avgScore - 60) / 40 * 100)
      : avgScore <= 40
        ? Math.round((40 - avgScore) / 40 * 100)
        : Math.round((1 - Math.abs(avgScore - 50) / 10) * 100)
    : null

  // 방향 바 색상
  const insightBarColor = (realInsightDir ?? d.insightDir).includes('상승')
    ? 'bg-emerald-500'
    : (realInsightDir ?? d.insightDir).includes('하락')
      ? 'bg-red-400'
      : 'bg-slate-400'

  // KOSPI 일간 등락률
  const kospiChangePct = latestRow?.close && activeRows[1]?.close
    ? (latestRow.close - activeRows[1].close) / activeRows[1].close * 100
    : null

  const realInsightStats: { label: string; value: string }[] | null =
    isKr && globalSnap ? [
      { label: '코스피', value: kospiChangePct != null ? fmtPct(kospiChangePct) : '-' },
      { label: '외국인', value: foreignFlow?.net_buy_str ?? '-' },
      { label: '환율',   value: globalSnap.usd_krw.value != null ? `${fmt0(globalSnap.usd_krw.value)}원` : '-' },
    ]
    : !isKr && globalSnap ? [
      { label: 'S&P 500', value: fmtPct(globalSnap.sp500.change) },
      { label: 'NASDAQ',  value: fmtPct(globalSnap.nasdaq.change) },
      { label: 'VIX',     value: globalSnap.vix.value != null ? fmt2(globalSnap.vix.value) : '-' },
    ]
    : null

  const index2Latest = index2Rows[0]
  const index2CloseArr = [...index2Rows].reverse().map(r => Number(r.close)).filter(Boolean)
  const realIndex2 = index2Latest ? {
    ...d.index2,
    value: fmt0(index2Latest.close),
    change: (() => {
      const prev = index2Rows[1]?.close
      const curr = index2Latest.close
      if (!prev || !curr) return d.index2.change
      const diff = curr - prev
      const pct = (diff / prev * 100).toFixed(2)
      return `${diff >= 0 ? '+' : ''}${fmt0(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`
    })(),
    data: index2CloseArr.length >= 2 ? index2CloseArr : d.index2.data,
    ohlc: [
      ['시가', fmt0(index2Latest.open)],
      ['고가', fmt0(index2Latest.high)],
      ['저가', fmt0(index2Latest.low)],
    ] as [string, string][],
  } : null

  const realIndex1 = latestRow ? {
    ...d.index1,
    value: fmt0(latestRow.close),
    change: (() => {
      const prev = activeRows[1]?.close
      const curr = latestRow.close
      if (!prev || !curr) return d.index1.change
      const diff = curr - prev
      const pct = (diff / prev * 100).toFixed(2)
      return `${diff >= 0 ? '+' : ''}${fmt0(diff)} (${diff >= 0 ? '+' : ''}${pct}%)`
    })(),
    data: closeArr.length >= 2 ? closeArr : d.index1.data,
    ohlc: [
      ['시가', fmt0(latestRow.open)],
      ['고가', fmt0(latestRow.high)],
      ['저가', fmt0(latestRow.low)],
    ] as [string, string][],
  } : d.index1

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* ── Market Status Bar ── */}
      <div className="flex items-center justify-between rounded-2xl p-5 bg-white border border-slate-200 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300 ${isKr ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
            {isKr ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/><path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 transition-all duration-300">{d.statusTitle}</h2>
            <p className="text-sm text-slate-500">{d.statusSub}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-4">
            {(realStripPreview ?? d.stripPreview).map((idx) => (
              <div key={idx.name} className="text-center">
                <p className="text-[10px] text-slate-400 font-medium">{idx.name}</p>
                <p className="text-sm font-bold text-slate-900">{idx.value}</p>
                <p className={`text-xs font-semibold ${idx.up ? 'text-emerald-500' : 'text-red-500'}`}>{idx.change}</p>
              </div>
            ))}
          </div>
          <div className={`rounded-xl px-4 py-2 text-center transition-colors duration-300 ${isKr ? 'bg-indigo-50' : 'bg-violet-50'}`}>
            <p className="text-[10px] text-slate-400">장 상태</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-2 w-2 rounded-full animate-pulse ${isKr ? 'bg-emerald-500' : 'bg-violet-500'}`} />
              <p className={`text-sm font-bold ${isKr ? 'text-indigo-700' : 'text-violet-700'}`}>{d.statusBadge}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 3-col Grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left col-span-2 */}
        <div className="lg:col-span-2 space-y-6">

          {/* Insight Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-300">
            <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-300 ${isKr ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                  {isKr ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>
                      <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                      <path d="M2 12h2"/><path d="M20 12h2"/>
                      <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>
                    </svg>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{d.insightTitle}</h3>
                  <p className="text-xs text-slate-400">{d.insightSub}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 transition-colors duration-300 ${isKr ? 'text-indigo-600' : 'text-violet-600'}`}>
                <SparklesIcon />
                <span className="text-xs font-semibold">AI 분석</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-sm ${
                  (realInsightDir ?? d.insightDir).includes('상승') ? 'bg-emerald-50 text-emerald-600'
                  : (realInsightDir ?? d.insightDir).includes('하락') ? 'bg-red-50 text-red-500'
                  : 'bg-slate-100 text-slate-600'
                }`}>
                  {(realInsightDir ?? d.insightDir).includes('하락')
                    ? <TrendingDownIcon size={18} />
                    : <TrendingUpIcon size={18} />}
                  {realInsightDir ?? d.insightDir}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300 z-10" />
                    <div className={`h-full rounded-full transition-all duration-700 ${insightBarColor}`}
                      style={{ width: `${realInsightConf ?? d.insightConf}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>약세</span>
                    <span className="font-semibold text-slate-600">{realInsightConf ?? d.insightConf}%</span>
                    <span>강세</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{d.insightText}</p>
              <div className="grid grid-cols-3 gap-3">
                {(realInsightStats ?? d.insightStats).map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-1 text-sm font-bold text-emerald-600">{value}</p>
                  </div>
                ))}
              </div>
              <Link href="/detail"
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-colors duration-300 ${d.accentBg}`}>
                상세 리포트 보기 <ArrowRightIcon />
              </Link>
            </div>
          </div>

          {/* Index Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            {[realIndex1, realIndex2 ?? d.index2].map((idx) => (
              <div key={idx.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition-all duration-300">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{ background: idx.color + '18', color: idx.color }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{idx.name}</p>
                      <p className="text-[10px] text-slate-400">{idx.sub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-slate-900">{idx.value}</p>
                    <p className="text-sm font-semibold text-emerald-500">{idx.change}</p>
                  </div>
                </div>
                <MiniChart data={idx.data} color={idx.color} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {idx.ohlc.map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-slate-50 p-2">
                      <p className="text-[10px] text-slate-400">{k}</p>
                      <p className={`text-xs font-semibold ${v === '-' ? 'text-slate-300' : 'text-slate-700'}`}>{v === '-' ? '―' : v}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Technical Indicators */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-slate-100">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 ${isKr ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-slate-900">기술적 지표</h3>
                <p className="text-xs text-slate-400">{isKr ? 'KOSPI 기반 보조지표' : 'S&P 500 기반 보조지표'}</p>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-3">
              {(realIndicators ?? d.indicators).map(({ label, value, sub, badge, cls }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-slate-500">{label}</p>
                    <span className={cls}>{badge}</span>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Global Markets Strip */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 text-sm">{isKr ? '글로벌 시장' : '아시아 · 유럽 시장'}</h3>
            {globalSnap
              ? <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  LIVE · {new Date(globalSnap.as_of as string).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              : <span className="text-[10px] text-slate-400">목업 데이터</span>
            }
          </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {(realGlobalStrip ?? d.globalStrip).map(({ name, value, change, up }) => (
                <div key={name} className={`rounded-xl p-3 text-center ${up ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-[10px] text-slate-500 font-medium">{name}</p>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{value}</p>
                  <p className={`text-xs font-semibold mt-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <GeoRiskPanel />

          {/* Signal Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Today&#39;s Signal</h3>
                  <p className="text-xs text-slate-400">{isKr ? 'AI 선별 Top ETF' : 'US ETF 추천'}</p>
                </div>
              </div>
              <Link href="/detail" className="flex items-center gap-0.5 text-xs text-indigo-600 font-medium hover:underline">
                전체보기 <ChevronRightIcon />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {(realSignals ?? d.signals).map(({ ticker, name, change, score, action, confidence, signalStrength, up }) => {
                const strengthColor = signalStrength?.includes('강한 매수') ? 'bg-emerald-100 text-emerald-700'
                  : signalStrength?.includes('매수') ? 'bg-emerald-50 text-emerald-600'
                  : signalStrength?.includes('관망') ? 'bg-slate-100 text-slate-600'
                  : signalStrength?.includes('매도') && signalStrength?.includes('강한') ? 'bg-red-100 text-red-700'
                  : signalStrength?.includes('매도') ? 'bg-red-50 text-red-500'
                  : 'bg-slate-100 text-slate-600'

                return (
                  <div key={ticker}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3 hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {up ? <TrendingUpIcon size={14} /> : <TrendingDownIcon size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{name}</p>
                        <p className="text-[10px] text-slate-400">{ticker}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</p>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <span>Score: {score}</span>
                          {confidence !== null && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                              confidence >= 0.60 ? 'bg-emerald-100 text-emerald-700'
                              : confidence >= 0.40 ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-600'
                            }`}>
                              Conf: {(confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          action === '매수' ? 'bg-emerald-50 text-emerald-600'
                          : action === '매도' ? 'bg-red-50 text-red-500'
                          : 'bg-slate-200 text-slate-500'
                        }`}>
                          {action}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-center ${strengthColor}`}>
                          {signalStrength || '➡️ 관망'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Portfolio */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-300 ${isKr ? 'bg-indigo-50 text-indigo-600' : 'bg-violet-50 text-violet-600'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">내 포트폴리오</h3>
                  <p className="text-xs text-slate-400">Risk Score: 65/100</p>
                </div>
              </div>
              <span className="badge-hold text-[10px]">보통</span>
            </div>
            <div className="px-5 py-3">
              <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
                {d.portfolio.map(({ code, pct, color }) => (
                  <div key={code} className={`${color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                {d.portfolio.map(({ code, color }) => (
                  <div key={code} className="flex items-center gap-1">
                    <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                    <span className="text-[9px] font-medium text-slate-500">{code}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              {d.portfolio.map(({ code, name, pct, color, profit }) => {
                const up = profit.startsWith('+')
                return (
                  <div key={code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center text-xs font-bold text-white`}>
                        {code.slice(0, 1)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{code}</p>
                        <p className="text-[10px] text-slate-400">{name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-700">{pct}%</p>
                      <p className={`text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{profit}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* AI Report CTA */}
          <div className={`bg-gradient-to-br ${d.gradientFrom} ${d.gradientTo} rounded-xl p-5 text-white transition-all duration-300`}>
            <div className="flex items-center gap-2 mb-2">
              <SparklesIcon />
              <p className="text-sm font-semibold">AI 투자 리포트</p>
            </div>
            <p className="text-xs text-white/70 leading-relaxed mb-4">
              {isKr
                ? '오늘의 국내 시장 데이터를 기반으로 맞춤형 AI 투자 분석 리포트를 생성합니다.'
                : '미국 시장 데이터를 기반으로 내일 국장 예측 리포트를 생성합니다.'}
            </p>
            <Link href="/detail"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 py-2.5 text-sm font-semibold transition-colors">
              리포트 보기 <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
