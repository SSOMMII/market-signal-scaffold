'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon, SparklesIcon } from '@/components/icons'
import { useMarket } from '@/context/MarketContext'
import { krGradientClass, usGradientClass } from '@/lib/detailData'

const tabs = ['일간', '주간', '섹터별', '커스텀']
const aiReportTabs = ['일간 리포트', '주간 전망', '섹터 분석', '커스텀']
const reportContent = [
  { title: '일간 AI 리포트', body: '당일 시장 흐름 기반 AI 분석 리포트입니다. 실데이터 연동 후 자동 생성됩니다.' },
  { title: '주간 전망', body: '주간 기술 지표 추세 기반 전망입니다. 실데이터 연동 후 자동 생성됩니다.' },
  { title: '섹터 분석', body: '섹터별 강도 및 순환 흐름 분석입니다. 실데이터 연동 후 자동 생성됩니다.' },
  { title: '커스텀 리포트', body: '사용자 포트폴리오 기반 맞춤 리포트입니다. 포트폴리오 연동 후 활성화됩니다.' },
]

type DetailApiResponse = {
  predictionTitle: string
  predictionPct: number
  predictionSub: string
  stats: { label: string; value: string }[]
  etfDetailList: {
    ticker: string
    name: string
    price: string
    change: string
    volume: string
    signal: string
    score: number
    up: boolean
  }[]
  indicatorDetail: {
    label: string
    value: number
    max: number
    badge: string
    cls: string
    desc: string
    color: string
  }[]
  sectorData: { name: string; score: number; change: string; up: boolean }[]
}

export default function DetailPage() {
  const { market } = useMarket()
  const isKr = market === 'kr'
  const gradientClass = isKr ? krGradientClass : usGradientClass

  const [detailApiData, setDetailApiData] = useState<DetailApiResponse | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(true)

  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).replace(/\. /g, '.').replace('.', '.')

  const accentBg = isKr ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-violet-600 hover:bg-violet-700'

  useEffect(() => {
    let cancelled = false
    setDetailLoading(true)
    setDetailError(null)
    setDetailApiData(null)

    fetch(`/api/detail?market=${market}`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || res.statusText || 'API 오류')
        }
        return res.json()
      })
      .then((payload) => {
        if (cancelled) return
        if (payload?.data) {
          setDetailApiData(payload.data)
        } else {
          throw new Error('데이터 응답이 없습니다.')
        }
      })
      .catch((err) => {
        if (cancelled) return
        setDetailError(err.message ?? '알 수 없는 오류')
      })
      .finally(() => {
        if (cancelled) return
        setDetailLoading(false)
      })
    return () => { cancelled = true }
  }, [market])

  const etfDetailList = detailApiData?.etfDetailList ?? []
  const indicatorDetail = detailApiData?.indicatorDetail ?? []
  const sectorData = detailApiData?.sectorData ?? []

  const [activeTab, setActiveTab] = useState(0)
  const [reportTab, setReportTab] = useState(0)
  const [currentEtfPage, setCurrentEtfPage] = useState(1)
  const PAGE_SIZE = 6
  const totalEtfPages = Math.max(1, Math.ceil(etfDetailList.length / PAGE_SIZE))
  useEffect(() => { setCurrentEtfPage(1) }, [etfDetailList.length])
  const paginatedEtfs = useMemo(() => {
    const start = (currentEtfPage - 1) * PAGE_SIZE
    return etfDetailList.slice(start, start + PAGE_SIZE)
  }, [currentEtfPage, etfDetailList])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
          <ArrowLeftIcon />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">상세 분석</h1>
          <p className="text-xs text-slate-400">{isKr ? '한국 시장 AI 예측 요약' : 'US market AI overview'}</p>
        </div>
      </div>

      {detailError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
          데이터를 불러오지 못했습니다: {detailError}
        </div>
      )}

      {/* Prediction Summary Banner */}
      {detailLoading ? (
        <div className={`animate-pulse rounded-2xl bg-gradient-to-r ${gradientClass} h-44 opacity-40`} />
      ) : detailApiData ? (
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradientClass} p-6 text-white`}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="relative flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <SparklesIcon />
                <span className="text-xs font-semibold opacity-70">AI 신호 요약 {today}</span>
              </div>
              <h2 className="text-2xl font-bold">{detailApiData.predictionTitle}</h2>
              <p className="text-sm opacity-80 leading-relaxed max-w-md whitespace-pre-line">
                {detailApiData.predictionSub}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {detailApiData.stats.map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-white/10 px-3 py-2 text-center">
                    <p className="text-[10px] opacity-60">{label}</p>
                    <p className="text-sm font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center justify-center h-28 w-28 rounded-full bg-white/10 border-4 border-white/20 shrink-0">
              <p className="text-3xl font-black">{detailApiData.predictionPct}%</p>
              <p className="text-[10px] opacity-60 text-center leading-tight">
                {detailApiData.predictionPct >= 50 ? '상승' : '하락'}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-[10px] opacity-60 mb-1">
              <span>하락</span><span>상승</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-white/80 transition-all duration-700" style={{ width: `${detailApiData.predictionPct}%` }} />
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1.5 bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`flex-1 rounded-lg py-2 text-xs sm:text-sm font-medium transition-all ${
              activeTab === i ? `${accentBg} text-white shadow-sm` : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── 탭별 레이아웃 ─────────────────────────────────────────────── */}

      {/* 일간 탭: ETF 신호 + 기술지표 (left) / 섹터 히트맵 (right) */}
      {activeTab === 0 && (
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ETF Signal List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">ETF 신호 목록</h3>
                <p className="text-xs text-slate-400">AI 평가로 선별된 ETF 순위</p>
              </div>
              <span className="badge-up">신호</span>
            </div>

            {detailLoading ? (
              <div className="p-4 space-y-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse h-12 rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : etfDetailList.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-400">
                ETF 데이터가 없습니다
              </div>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden divide-y divide-slate-100">
                  {paginatedEtfs.map(({ ticker, name, price, change, volume, signal, score, up }) => (
                    <div key={ticker} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">{name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{ticker} · 거래량 {volume}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          signal === '매수' ? 'bg-emerald-50 text-emerald-600' :
                          signal === '관망' ? 'bg-slate-100 text-slate-500' :
                          'bg-amber-50 text-amber-600'
                        }`}>{signal}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-slate-800 text-sm">{price}</span>
                        <span className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-14 shrink-0">AI Score</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${score > 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                            style={{ width: `${Math.min(Math.abs(score) / 4 * 100, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold w-8 text-right shrink-0 ${score > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {score > 0 ? '+' : ''}{score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['ETF', '현재가', '변동률', '거래량', 'AI Score', '신호'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginatedEtfs.map(({ ticker, name, price, change, volume, signal, score, up }) => (
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

                {/* 페이지네이션 */}
                {totalEtfPages > 1 && (
                  <div className="flex items-center justify-between px-5 pb-5 pt-4 text-xs text-slate-500">
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 transition-colors hover:border-slate-300 disabled:opacity-40"
                      onClick={() => setCurrentEtfPage((p) => Math.max(1, p - 1))}
                      disabled={currentEtfPage === 1}
                    >
                      이전
                    </button>
                    <span>{currentEtfPage} / {totalEtfPages}</span>
                    <button
                      className="rounded-full border border-slate-200 px-3 py-1 transition-colors hover:border-slate-300 disabled:opacity-40"
                      onClick={() => setCurrentEtfPage((p) => Math.min(totalEtfPages, p + 1))}
                      disabled={currentEtfPage === totalEtfPages}
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Technical Indicators */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">최근 지표 요약</h3>
              <p className="text-xs text-slate-400">등락 지표를 한눈에 확인하세요</p>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? (
                [0, 1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-20" />
                ))
              ) : indicatorDetail.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">
                  지표 데이터가 없습니다
                  <span className="block text-xs mt-1 text-slate-300">{isKr ? '^KS11' : '^GSPC'} 수집 데이터 확인 필요</span>
                </p>
              ) : indicatorDetail.map(({ label, value, max, badge, cls, desc, color }) => (
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
              <h3 className="font-bold text-slate-900">섹터 히트맵</h3>
              <p className="text-xs text-slate-400">AI 점수 (0~100)</p>
            </div>
            <div className="p-4 space-y-3">
              {detailLoading ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="animate-pulse h-8 rounded-lg bg-slate-100" />
                ))
              ) : sectorData.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">섹터 데이터가 없습니다</p>
              ) : sectorData.map(({ name, score, change, up }) => (
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

          {/* 예측 이력 바로가기 */}
          <Link href="/history"
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold text-white transition-colors ${accentBg}`}>
            <SparklesIcon />
            AI 예측 이력 보기
          </Link>
        </div>
      </div>
      )}

      {/* 주간 탭: 기술지표 + AI 리포트 / 섹터 히트맵 */}
      {activeTab === 1 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Technical Indicators */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">최근 지표 요약</h3>
                <p className="text-xs text-slate-400">주간 기준 기술 지표 흐름</p>
              </div>
              <div className="p-5 space-y-4">
                {detailLoading ? [0,1,2,3].map(i => <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-20" />)
                  : indicatorDetail.map(({ label, value, max, badge, cls, desc, color }) => (
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
            {/* AI 리포트 */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                <SparklesIcon />
                <h3 className="font-bold text-slate-900 text-sm">AI 리포트</h3>
              </div>
              <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                {aiReportTabs.map((t, i) => (
                  <button key={t} onClick={() => setReportTab(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportTab === i ? `${accentBg} text-white` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                  <strong className="text-slate-900 block mb-2">{reportContent[reportTab].title}</strong>
                  <p>{reportContent[reportTab].body}</p>
                </div>
                <Link href="/history" className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${accentBg}`}>
                  <SparklesIcon />AI 리포트 생성
                </Link>
              </div>
            </div>
          </div>
          {/* 섹터 히트맵 */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">섹터 히트맵</h3>
                <p className="text-xs text-slate-400">AI 점수 (0~100)</p>
              </div>
              <div className="p-4 space-y-3">
                {detailLoading ? [0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-8 rounded-lg bg-slate-100" />)
                  : sectorData.map(({ name, score, change, up }) => (
                    <div key={name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">{name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
                          <span className="text-xs font-bold text-slate-900 w-6 text-right">{score}</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 섹터별 탭: 섹터 히트맵 + 기술지표 나란히 */}
      {activeTab === 2 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">섹터 히트맵</h3>
              <p className="text-xs text-slate-400">AI 점수 기준 섹터 강도</p>
            </div>
            <div className="p-4 space-y-3">
              {detailLoading ? [0,1,2,3,4].map(i => <div key={i} className="animate-pulse h-8 rounded-lg bg-slate-100" />)
                : sectorData.map(({ name, score, change, up }) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
                        <span className="text-xs font-bold text-slate-900 w-6 text-right">{score}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
                    </div>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-5 pt-5 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">최근 지표 요약</h3>
              <p className="text-xs text-slate-400">섹터별 기술 지표 참고</p>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? [0,1,2,3].map(i => <div key={i} className="animate-pulse rounded-xl bg-slate-100 h-20" />)
                : indicatorDetail.map(({ label, value, max, badge, cls, desc, color }) => (
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
      )}

      {/* 커스텀 탭: ETF 신호 + AI 리포트 */}
      {activeTab === 3 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">ETF 신호 목록</h3>
                  <p className="text-xs text-slate-400">커스텀 필터 기준 ETF 순위</p>
                </div>
                <span className="badge-up">신호</span>
              </div>
              {detailLoading ? (
                <div className="p-4 space-y-3">{[0,1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-12 rounded-lg bg-slate-100" />)}</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginatedEtfs.map(({ ticker, name, price, change, signal, score, up }) => (
                    <div key={ticker} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{ticker}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-slate-800">{price}</span>
                        <span className={`text-sm font-bold ${up ? 'text-emerald-600' : 'text-red-500'}`}>{change}</span>
                        <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${signal === '매수' ? 'bg-emerald-50 text-emerald-600' : signal === '관망' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'}`}>{signal}</span>
                        <span className={`text-xs font-bold w-8 text-right ${score > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{score > 0 ? '+' : ''}{score}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between px-5 pb-5 pt-4 text-xs text-slate-500">
                <button className="rounded-full border border-slate-200 px-3 py-1 hover:border-slate-300 disabled:opacity-40" onClick={() => setCurrentEtfPage(p => Math.max(1,p-1))} disabled={currentEtfPage===1}>이전</button>
                <span>{currentEtfPage} / {totalEtfPages}</span>
                <button className="rounded-full border border-slate-200 px-3 py-1 hover:border-slate-300 disabled:opacity-40" onClick={() => setCurrentEtfPage(p => Math.min(totalEtfPages,p+1))} disabled={currentEtfPage===totalEtfPages}>다음</button>
              </div>
            </div>
          </div>
          <div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center gap-2">
                <SparklesIcon />
                <h3 className="font-bold text-slate-900 text-sm">AI 리포트</h3>
              </div>
              <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
                {aiReportTabs.map((t, i) => (
                  <button key={t} onClick={() => setReportTab(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reportTab === i ? `${accentBg} text-white` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed border border-slate-100">
                  <strong className="text-slate-900 block mb-2">{reportContent[reportTab].title}</strong>
                  <p>{reportContent[reportTab].body}</p>
                </div>
                <Link href="/history" className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors ${accentBg}`}>
                  <SparklesIcon />AI 리포트 생성
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
