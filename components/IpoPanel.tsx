'use client'
import { useEffect, useState } from 'react'

interface IpoItem {
  name: string
  code?: string
  filedAt?: string
  subscriptionStart: string
  subscriptionEnd: string
  listingDate: string
  priceMin: number
  priceMax: number
  brokers: string[]
  marketType: 'KOSPI' | 'KOSDAQ' | 'KONEX' | '-'
  reportName?: string
  competitionRatio?: string
  proportionalRatio?: string
  equalAllocExpected?: string
  allocatedQty?: string
  totalSubscribers?: string
  totalSubscriptionQty?: string
  hasDetail?: boolean
}

function getDday(dateStr: string): string {
  if (!dateStr) return '-'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'D-Day'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}

function isSubscriptionOpen(start: string, end: string): boolean {
  if (!start || !end) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= new Date(start) && today <= new Date(end)
}

function StatItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-400">{label}</span>
      <span className="text-[11px] font-semibold text-slate-700">{value}</span>
    </div>
  )
}

export function IpoPanel() {
  const [items, setItems] = useState<IpoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/ipo')
      .then(r => r.json())
      .then(payload => {
        if (!mounted) return
        if (Array.isArray(payload?.data)) {
          setItems(payload.data)
        } else if (payload?.error) {
          setError(payload.error)
        }
      })
      .catch(() => setError('데이터를 불러올 수 없습니다'))
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">공모주 캘린더</h3>
            <p className="text-xs text-slate-400">청약 일정 · 발행실적 · DART 연동</p>
          </div>
        </div>
        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
          DART Live
        </span>
      </div>

      {/* 목록 */}
      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-center text-xs text-slate-400 py-6">불러오는 중...</p>
        )}

        {!loading && error && (
          <p className="text-center text-xs text-red-400 py-6">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">
            최근 90일간 지분증권 공모 내역이 없습니다
          </p>
        )}

        {!loading && items.map((ipo, i) => {
          const open = isSubscriptionOpen(ipo.subscriptionStart, ipo.subscriptionEnd)
          const dday = getDday(ipo.subscriptionStart || ipo.filedAt || '')
          const hasStats = ipo.competitionRatio || ipo.totalSubscribers || ipo.allocatedQty

          return (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
              {/* 종목명 + 시장 + 상태 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-slate-900 truncate">{ipo.name}</span>
                  {ipo.marketType !== '-' && (
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      ipo.marketType === 'KOSPI' ? 'bg-blue-50 text-blue-600'
                      : ipo.marketType === 'KOSDAQ' ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-purple-50 text-purple-600'
                    }`}>
                      {ipo.marketType}
                    </span>
                  )}
                </div>
                {ipo.subscriptionStart ? (
                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${
                    open ? 'bg-emerald-100 text-emerald-700'
                    : dday.startsWith('D-') && dday !== 'D-' ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    {open ? '청약중' : dday}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    공시완료
                  </span>
                )}
              </div>

              {/* 청약기간 / 상장일 */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                {ipo.subscriptionStart ? (
                  <>
                    <span><span className="text-slate-400">청약 </span>{ipo.subscriptionStart.slice(5)} ~ {ipo.subscriptionEnd.slice(5)}</span>
                    {ipo.listingDate && <span><span className="text-slate-400">상장 </span>{ipo.listingDate.slice(5)}</span>}
                  </>
                ) : (
                  <span><span className="text-slate-400">공시 </span>{ipo.filedAt ?? '-'}</span>
                )}
              </div>

              {/* 공모가 / 주관사 */}
              {(ipo.priceMin > 0 || ipo.brokers.length > 0) && (
                <div className="flex items-center justify-between gap-2">
                  {ipo.priceMin > 0 && (
                    <span className="text-[11px] text-slate-600">
                      <span className="text-slate-400">공모가 </span>
                      <span className="font-semibold text-slate-800">
                        {ipo.priceMin === ipo.priceMax
                          ? `${ipo.priceMin.toLocaleString()}원`
                          : `${ipo.priceMin.toLocaleString()}~${ipo.priceMax.toLocaleString()}원`}
                      </span>
                    </span>
                  )}
                  {ipo.brokers.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {ipo.brokers.slice(0, 3).map(b => (
                        <span key={b} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                          {b}
                        </span>
                      ))}
                      {ipo.brokers.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{ipo.brokers.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 경쟁률 / 배정 통계 */}
              {hasStats && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                  <StatItem label="경쟁률" value={ipo.competitionRatio ? `${ipo.competitionRatio}:1` : undefined} />
                  <StatItem label="비례배정경쟁률" value={ipo.proportionalRatio ? `${ipo.proportionalRatio}:1` : undefined} />
                  <StatItem label="균등배정예상수주" value={ipo.equalAllocExpected} />
                  <StatItem label="배정물량" value={ipo.allocatedQty ? Number(ipo.allocatedQty).toLocaleString() : undefined} />
                  <StatItem label="총 청약자수" value={ipo.totalSubscribers ? Number(ipo.totalSubscribers).toLocaleString() + '명' : undefined} />
                  <StatItem label="총 청약수량" value={ipo.totalSubscriptionQty ? Number(ipo.totalSubscriptionQty).toLocaleString() : undefined} />
                </div>
              )}

              {/* 상세 없음 안내 */}
              {!ipo.hasDetail && (
                <p className="text-[10px] text-slate-300">{ipo.reportName}</p>
              )}
            </div>
          )
        })}

        <p className="text-center text-[10px] text-slate-300 pt-1">
          DART OpenAPI · 지분증권 공모 · 최근 90일
        </p>
      </div>
    </div>
  )
}
