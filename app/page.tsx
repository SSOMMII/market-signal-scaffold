'use client'
import Link from 'next/link'
import { useMarket } from '@/context/MarketContext'
import { MiniChart } from '@/components/MiniChart'
import {
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowRightIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@/components/icons'

// ── 국장 (Korean market) data ─────────────────────────────────────────────────
const krData = {
  statusTitle: '한국 증시',
  statusSub: 'KOSPI / KOSDAQ',
  statusBadge: '거래중',
  insightTitle: 'Day Insight',
  insightSub: '국장 → 미장 예측',
  insightDir: '상승 예상',
  insightConf: 82,
  insightText: '코스피 외국인 순매수 유입. 반도체 섹터 강세 지속으로 나스닥 상승 예상. 달러 안정세 긍정적. 야간 선물 +0.3% 기반 상승 출발 전망.',
  insightStats: [
    { label: '코스피', value: '+0.8%' },
    { label: '외국인', value: '+2,340억' },
    { label: '환율',   value: '1,320원' },
  ],
  index1: { name: 'KOSPI', sub: '한국 대표 지수', value: '2,720', change: '+21.8 (+0.81%)', data: [2680,2695,2710,2698,2720,2715,2730,2720], color: '#6366f1', ohlc: [['시가','2,695'],['고가','2,735'],['저가','2,690']] },
  index2: { name: 'KOSDAQ', sub: '중소형 성장 지수', value: '891', change: '+9.4 (+1.07%)', data: [870,878,885,880,892,888,895,891], color: '#a855f7', ohlc: [['시가','878'],['고가','896'],['저가','876']] },
  globalStrip: [
    { name: 'S&P 500', value: '5,248',  change: '+0.74%', up: true  },
    { name: 'NASDAQ',  value: '16,382', change: '+1.12%', up: true  },
    { name: 'DOW',     value: '38,905', change: '+0.23%', up: true  },
    { name: 'VIX',     value: '14.2',   change: '-5.3%',  up: false },
    { name: 'WTI',     value: '$82.4',  change: '-0.8%',  up: false },
    { name: 'Gold',    value: '$2,318', change: '+0.6%',  up: true  },
  ],
  stripPreview: [
    { name: 'S&P 500', value: '5,248',  change: '+0.74%', up: true },
    { name: 'NASDAQ',  value: '16,382', change: '+1.12%', up: true },
    { name: 'DOW',     value: '38,905', change: '+0.23%', up: true },
  ],
  signals: [
    { ticker: '360750', name: 'TIGER 미국S&P500', change: '+1.8%', score: '+2.4', action: '매수', up: true },
    { ticker: '305720', name: 'KODEX 반도체',     change: '+2.3%', score: '+3.1', action: '매수', up: true },
    { ticker: '114800', name: 'KODEX 인버스',     change: '-0.9%', score: '-1.7', action: '관망', up: false },
    { ticker: '229200', name: 'KODEX 코스닥150',  change: '+1.1%', score: '+1.5', action: '매수', up: true },
  ],
  indicators: [
    { label: 'RSI (14)',   value: '42.5',  sub: '중립 구간',   badge: '중립', cls: 'badge-hold' },
    { label: 'MACD',      value: '+12',   sub: '골든크로스',  badge: '매수', cls: 'badge-up'   },
    { label: '이동평균',  value: '2,698', sub: '120MA 상회',  badge: '상승', cls: 'badge-up'   },
    { label: '볼린저밴드',value: '중단',  sub: '밴드 수렴',   badge: '중립', cls: 'badge-hold' },
    { label: '스토캐스틱',value: '68.3',  sub: '과매수 근접', badge: '주의', cls: 'badge-hold' },
    { label: '거래량',    value: '↑28%',  sub: '평균 대비',   badge: '강세', cls: 'badge-up'   },
  ],
  portfolio: [
    { code: 'AAPL',   name: 'Apple Inc.',      pct: 25, color: 'bg-blue-500',   profit: '+4.2%' },
    { code: 'NVDA',   name: 'NVIDIA Corp.',    pct: 30, color: 'bg-purple-500', profit: '+11.7%' },
    { code: '005930', name: '삼성전자',        pct: 25, color: 'bg-cyan-500',   profit: '-1.3%' },
    { code: 'MSFT',   name: 'Microsoft Corp.', pct: 20, color: 'bg-indigo-500', profit: '+2.9%' },
  ],
  accentColor: 'bg-indigo-50 text-indigo-600',
  accentBg: 'bg-indigo-600 hover:bg-indigo-700',
  gradientFrom: 'from-indigo-600',
  gradientTo: 'to-purple-600',
}

// ── 미장 (US market) data ─────────────────────────────────────────────────────
const usData = {
  statusTitle: '미국 증시',
  statusSub: 'S&P 500 / NASDAQ',
  statusBadge: '야간장',
  insightTitle: 'Night Insight',
  insightSub: '미장 → 국장 예측',
  insightDir: '상승 예상',
  insightConf: 76,
  insightText: '엔비디아 실적 서프라이즈 기대감. AI 인프라 투자 확대 기조 유지. 10년물 국채금리 소폭 하락, 기술주 밸류에이션 부담 완화. 내일 코스피 상승 출발 전망.',
  insightStats: [
    { label: 'S&P 500',  value: '+0.74%' },
    { label: 'NASDAQ',   value: '+1.12%' },
    { label: 'DXY',      value: '104.2'  },
  ],
  index1: { name: 'S&P 500', sub: '미국 대표 지수', value: '5,248', change: '+38.5 (+0.74%)', data: [5180,5195,5210,5200,5230,5220,5248,5248], color: '#8b5cf6', ohlc: [['시가','5,200'],['고가','5,260'],['저가','5,188']] },
  index2: { name: 'NASDAQ', sub: '기술주 중심 지수', value: '16,382', change: '+182 (+1.12%)', data: [16100,16150,16200,16180,16300,16280,16382,16382], color: '#06b6d4', ohlc: [['시가','16,180'],['고가','16,420'],['저가','16,090']] },
  globalStrip: [
    { name: 'KOSPI',  value: '2,720', change: '+0.81%', up: true  },
    { name: 'KOSDAQ', value: '891',   change: '+1.07%', up: true  },
    { name: 'Nikkei', value: '40,168',change: '+0.55%', up: true  },
    { name: 'DAX',    value: '18,492',change: '-0.12%', up: false },
    { name: 'WTI',    value: '$82.4', change: '-0.8%',  up: false },
    { name: 'BTC',    value: '$67,240',change:'+2.4%',  up: true  },
  ],
  stripPreview: [
    { name: 'KOSPI',  value: '2,720',  change: '+0.81%', up: true },
    { name: 'Nikkei', value: '40,168', change: '+0.55%', up: true },
    { name: 'DAX',    value: '18,492', change: '-0.12%', up: false },
  ],
  signals: [
    { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',    change: '+0.8%',  score: '+1.9', action: '매수', up: true  },
    { ticker: 'QQQ',  name: 'Invesco QQQ Trust',    change: '+1.2%',  score: '+2.8', action: '매수', up: true  },
    { ticker: 'SOXS', name: 'Direxion Semi Bear 3X', change: '-2.1%', score: '-2.5', action: '관망', up: false },
    { ticker: 'ARKK', name: 'ARK Innovation ETF',   change: '+1.7%',  score: '+1.4', action: '매수', up: true  },
  ],
  indicators: [
    { label: 'RSI (14)',   value: '58.2',  sub: '중립 구간',   badge: '중립', cls: 'badge-hold' },
    { label: 'MACD',      value: '+28',   sub: '골든크로스',  badge: '매수', cls: 'badge-up'   },
    { label: '이동평균',  value: '5,210', sub: '50MA 상회',   badge: '상승', cls: 'badge-up'   },
    { label: '볼린저밴드',value: '상단',  sub: '밴드 확장',   badge: '강세', cls: 'badge-up'   },
    { label: '스토캐스틱',value: '72.1',  sub: '고평가 구간', badge: '주의', cls: 'badge-hold' },
    { label: '거래량',    value: '↑15%',  sub: '평균 대비',   badge: '보통', cls: 'badge-hold' },
  ],
  portfolio: [
    { code: 'NVDA', name: 'NVIDIA Corp.',    pct: 35, color: 'bg-purple-500', profit: '+11.7%' },
    { code: 'AAPL', name: 'Apple Inc.',      pct: 25, color: 'bg-blue-500',   profit: '+4.2%'  },
    { code: 'MSFT', name: 'Microsoft Corp.', pct: 25, color: 'bg-indigo-500', profit: '+2.9%'  },
    { code: 'META', name: 'Meta Platforms',  pct: 15, color: 'bg-cyan-500',   profit: '+8.1%'  },
  ],
  accentColor: 'bg-violet-50 text-violet-600',
  accentBg: 'bg-violet-600 hover:bg-violet-700',
  gradientFrom: 'from-violet-600',
  gradientTo: 'to-indigo-700',
}

export default function DashboardPage() {
  const { market } = useMarket()
  const d = market === 'kr' ? krData : usData
  const isKr = market === 'kr'

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
            {d.stripPreview.map((idx) => (
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
                <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-emerald-50 text-emerald-600 font-semibold text-sm">
                  <TrendingUpIcon size={18} />
                  {d.insightDir}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${isKr ? 'bg-indigo-500' : 'bg-violet-500'}`}
                      style={{ width: `${d.insightConf}%` }} />
                  </div>
                  <span className="text-sm font-bold text-slate-600 shrink-0">{d.insightConf}%</span>
                </div>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{d.insightText}</p>
              <div className="grid grid-cols-3 gap-3">
                {d.insightStats.map(({ label, value }) => (
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
            {[d.index1, d.index2].map((idx) => (
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
                      <p className="text-xs font-semibold text-slate-700">{v}</p>
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
              {d.indicators.map(({ label, value, sub, badge, cls }) => (
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
            <h3 className="font-bold text-slate-900 mb-3 text-sm">{isKr ? '글로벌 시장' : '아시아 · 유럽 시장'}</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {d.globalStrip.map(({ name, value, change, up }) => (
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
              {d.signals.map(({ ticker, name, change, score, action, up }) => (
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
                      <p className="text-[10px] text-slate-400">Score: {score}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${action === '매수' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                      {action}
                    </span>
                  </div>
                </div>
              ))}
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
            <Link href="/history"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/20 hover:bg-white/30 py-2.5 text-sm font-semibold transition-colors">
              리포트 생성하기 <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
