'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, CheckIcon, XIcon, SparklesIcon } from '@/components/icons'
import { predictions, filterOptions, statCards } from '@/lib/historyData'

type Prediction = {
  date: string
  direction: '상승' | '하락'
  confidence: number
  actual: '상승' | '하락'
  kospiActual: string
  nasdaqActual: string
  foreignBuy: string
  hit: boolean
  summary: string
}



export default function HistoryPage() {
  const [filter, setFilter] = useState(0)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const filtered = predictions.filter((p) => {
    if (filter === 1) return p.hit
    if (filter === 2) return !p.hit
    return true
  })

  const totalHits = predictions.filter((p) => p.hit).length
  const accuracy = Math.round((totalHits / predictions.length) * 100)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">예측 이력</h1>
          <p className="text-xs text-slate-400">AI 예측 결과 및 정확도 분석</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color} mb-3`}>
              <SparklesIcon />
            </div>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-sm font-semibold text-slate-700 mt-0.5">{label}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Accuracy Gauge */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900">이번 주 예측 적중률</h3>
            <p className="text-xs text-slate-400">최근 {predictions.length}회 예측 기준</p>
          </div>
          <span className="text-2xl font-black text-indigo-600">{accuracy}%</span>
        </div>
        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${accuracy}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
          <span>0%</span>
          <span className="text-indigo-500 font-medium">목표: 70%</span>
          <span>100%</span>
        </div>

        {/* Mini history dots */}
        <div className="mt-4 flex items-center gap-1.5">
          <p className="text-xs text-slate-400 mr-1 shrink-0">최근 결과</p>
          {predictions.slice().reverse().map((p, i) => (
            <div
              key={i}
              title={`${p.date} — ${p.hit ? '적중' : '빗나감'}`}
              className={`h-4 w-4 rounded-full flex items-center justify-center text-white ${p.hit ? 'bg-emerald-500' : 'bg-red-400'}`}
            >
              {p.hit ? <CheckIcon /> : <XIcon />}
            </div>
          ))}
        </div>
      </div>

      {/* Filter + List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
            {filterOptions.map((opt, i) => (
              <button
                key={opt}
                onClick={() => setFilter(i)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === i ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">{filtered.length}건</p>
        </div>

        <div className="space-y-3">
          {filtered.map((p, i) => (
            <div
              key={p.date}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Row */}
              <button
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                {/* Hit indicator */}
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${p.hit ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                  {p.hit ? <CheckIcon /> : <XIcon />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{p.date}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      p.direction === '상승' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                    }`}>
                      예측: {p.direction}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      p.actual === '상승' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      실제: {p.actual}
                    </span>
                    {p.hit
                      ? <span className="badge-up text-[10px]">적중</span>
                      : <span className="badge-down text-[10px]">빗나감</span>
                    }
                  </div>
                  <p className="text-xs text-slate-400 mt-1 truncate">{p.summary}</p>
                </div>

                {/* Confidence */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-indigo-600">{p.confidence}%</p>
                  <p className="text-[10px] text-slate-400">신뢰도</p>
                </div>

                {/* Chevron */}
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-slate-400 shrink-0 transition-transform ${expandedIdx === i ? 'rotate-90' : ''}`}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {/* Expanded detail */}
              {expandedIdx === i && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[
                      { label: '코스피 실제',   value: p.kospiActual,  up: p.kospiActual.startsWith('+') },
                      { label: '나스닥 실제',   value: p.nasdaqActual, up: p.nasdaqActual.startsWith('+') },
                      { label: '외국인 순매수', value: p.foreignBuy,   up: p.foreignBuy.startsWith('+') },
                    ].map(({ label, value, up }) => (
                      <div key={label} className="rounded-lg bg-white border border-slate-100 p-3 text-center">
                        <p className="text-[10px] text-slate-400">{label}</p>
                        <p className={`text-sm font-bold mt-0.5 ${up ? 'text-emerald-600' : 'text-red-500'}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{p.summary}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${p.confidence}%` }} />
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">신뢰도 {p.confidence}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
