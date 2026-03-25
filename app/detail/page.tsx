'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, SparklesIcon } from '@/components/icons'
import { tabs, sectorData, etfDetailList, indicatorDetail, aiReportTabs } from '@/lib/detailData'



export default function DetailPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [reportTab, setReportTab] = useState(0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">상세 분석</h1>
          <p className="text-xs text-slate-400">국장 → 미장 심층 리포트</p>
        </div>
      </div>

      {/* Prediction Summary Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <SparklesIcon />
              <span className="text-xs font-semibold text-indigo-200">AI 예측 분석 · 2025.03.25</span>
            </div>
            <h2 className="text-2xl font-bold">나스닥 상승 확률 82%</h2>
            <p className="text-sm text-indigo-200 leading-relaxed max-w-md">
              코스피 외국인 순매수 +2,340억 유입. 반도체·AI 섹터 강세가 미장 상승을 견인할 전망.
              달러인덱스(DXY) 104.2 안정, 국채금리 소폭 하락으로 기술주에 우호적 환경.
            </p>
            <div className="flex items-center gap-4 pt-1">
              {[
                { label: '코스피 외인', value: '+2,340억' },
                { label: '환율',       value: '1,320원'  },
                { label: '나스닥 선물', value: '+0.31%'  },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                  <p className="text-[10px] text-indigo-300">{label}</p>
                  <p className="text-sm font-bold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:flex flex-col items-center justify-center h-28 w-28 rounded-full bg-white/10 border-4 border-white/20">
            <p className="text-3xl font-black">82%</p>
            <p className="text-[10px] text-indigo-300 text-center leading-tight">상승<br/>예측</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-indigo-300 mb-1">
            <span>하락</span><span>상승</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-white/80" style={{ width: '82%' }} />
          </div>
        </div>
      </div>

      {/* Tabs: 일간/주간/섹터별/커스텀 */}
      <div className="flex gap-2 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              activeTab === i
                ? 'bg-indigo-600 text-white shadow-sm'
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
                  {etfDetailList.map(({ ticker, name, price, change, volume, signal, score, up }) => (
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
              {indicatorDetail.map(({ label, value, max, badge, cls, desc, color }) => (
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
              {sectorData.map(({ name, score, change, up }) => (
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
                    reportTab === i ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                {reportTab === 0 && (
                  <p>
                    <strong className="text-slate-900">📊 일간 시장 요약</strong><br /><br />
                    코스피는 외국인 순매수 +2,340억을 기반으로 0.81% 상승 마감. 반도체·AI 관련주 강세가
                    두드러졌으며, 삼성전자와 SK하이닉스가 각각 1.2%, 2.1% 상승. 코스닥도 바이오·엔터주 주도로
                    1.07% 상승. 오늘 밤 나스닥은 82% 확률로 상승 전망.
                  </p>
                )}
                {reportTab === 1 && (
                  <p>
                    <strong className="text-slate-900">📅 주간 시장 전망</strong><br /><br />
                    이번 주 FOMC 의사록 발표 예정. 금리 동결 기조 유지 전망으로 기술주 중심 상승 흐름 예상.
                    엔비디아 실적 발표(목)가 나스닥 방향성을 결정할 핵심 변수. 코스피는 2,700~2,750 박스권 전망.
                  </p>
                )}
                {reportTab === 2 && (
                  <p>
                    <strong className="text-slate-900">🏭 섹터 분석</strong><br /><br />
                    반도체 섹터(Score 92) 최강세. HBM 수요 급증으로 SK하이닉스 목표가 상향 다수.
                    엔터 섹터(Score 81) 일본·동남아 팬덤 확장으로 하이브·JYP 매출 성장세 지속.
                    2차전지(Score 58) 전기차 수요 둔화 우려로 관망 권고.
                  </p>
                )}
                {reportTab === 3 && (
                  <p>
                    <strong className="text-slate-900">⚙️ 커스텀 분석</strong><br /><br />
                    포트폴리오 기반 맞춤 분석: NVDA(30%) 비중이 높아 실적 발표 리스크 존재.
                    삼성전자(25%)는 단기 조정 후 반등 구간 진입. AAPL(25%)은 AI 피처 기대감으로 강보합.
                    전체 리스크 스코어 65/100 — 보통 수준, 분산투자 권장.
                  </p>
                )}
              </div>
              <Link href="/history"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
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
