'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, SparklesIcon } from '@/components/icons'
import { useMarket } from '@/context/MarketContext'
import { tabs, krDetailData, usDetailData, aiReportTabs } from '@/lib/detailData'

export default function DetailPage() {
  const { market } = useMarket()
  const isKr = market === 'kr'
  const d = isKr ? krDetailData : usDetailData

  const [activeTab, setActiveTab] = useState(0)
  const [reportTab, setReportTab] = useState(0)

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace('.', '.')

  const accentBg = isKr ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-violet-600 hover:bg-violet-700'

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">상세 분석</h1>
          <p className="text-xs text-slate-400">{isKr ? '국장 → 미장 심층 리포트' : '미장 → 국장 심층 리포트'}</p>
        </div>
      </div>

      {/* Prediction Summary Banner */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${d.gradientClass} p-6 text-white`}>
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SparklesIcon />
              <span className="text-xs font-semibold opacity-70">AI 예측 분석 · {today}</span>
            </div>
            <h2 className="text-2xl font-bold">{d.predictionTitle}</h2>
            <p className="text-sm opacity-80 leading-relaxed max-w-md whitespace-pre-line">
              {d.predictionSub}
            </p>
            <div className="flex items-center gap-4 pt-1">
              {d.stats.map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] opacity-60">{label}</p>
                  <p className="text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center justify-center h-28 w-28 rounded-full bg-white/10 border-4 border-white/20 shrink-0">
            <p className="text-3xl font-black">{d.predictionPct}%</p>
            <p className="text-[10px] opacity-60 text-center leading-tight">상승<br/>예측</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] opacity-60 mb-1">
            <span>하락</span><span>상승</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-white/80 transition-all duration-700" style={{ width: `${d.predictionPct}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              activeTab === i
                ? `${accentBg} text-white shadow-sm`
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ETF Signal Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">ETF 시그널 목록</h3>
                <p className="text-xs text-slate-400">AI 점수 기반 추천 순위</p>
              </div>
              <span className="badge-up">실시간</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['ETF', '현재가', '등락률', '거래량', 'AI Score', '시그널'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {d.etfDetailList.map(({ ticker, name, price, change, volume, signal, score, up }) => (
                    <tr key={ticker} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900 text-sm leading-tight">{name}</p>
                        <p className="text-[10px] text-slate-400">{ticker}</p>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{price}</td>
                      <td className={`px-4 py-3 font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{volume}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${score > 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(Math.abs(score) / 4 * 100, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${score > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {score > 0 ? '+' : ''}{score}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          signal === '매수' ? 'bg-emerald-50 text-emerald-600' :
                          signal === '관망' ? 'bg-slate-100 text-slate-500' :
                          'bg-amber-50 text-amber-600'
                        }`}>{signal}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Technical Indicators Detail */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">기술적 지표 상세</h3>
              <p className="text-xs text-slate-400">각 지표별 현재 신호 및 해석</p>
            </div>
            <div className="p-5 space-y-4">
              {d.indicatorDetail.map(({ label, value, max, badge, cls, desc, color }) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-800 text-sm">{label}</p>
                    <span className={cls}>{badge}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(value / max) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-900 w-10 text-right shrink-0">{value}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Sector Heatmap */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">섹터별 강도</h3>
              <p className="text-xs text-slate-400">AI 섹터 스코어 (0~100)</p>
            </div>
            <div className="p-4 space-y-3">
              {d.sectorData.map(({ name, score, change, up }) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
                      <span className="text-xs font-bold text-slate-900 w-6 text-right">{score}</span>
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Report Generator */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
              <SparklesIcon />
              <h3 className="font-bold text-slate-900 text-sm">AI 투자 리포트</h3>
            </div>

            {/* Report type tabs */}
            <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
              {aiReportTabs.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setReportTab(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    reportTab === i ? `${accentBg} text-white` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                <strong className="text-slate-900 block mb-2">{d.reportContent[reportTab].title}</strong>
                <p>{d.reportContent[reportTab].body}</p>
              </div>
              <Link href="/history"
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${accentBg}`}>
                <SparklesIcon />
                새 리포트 생성
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
