'use client'
import { useEffect, useState, useMemo } from 'react'

interface IpoItem {
  id: string
  name: string
  subscriptionStart: string
  subscriptionEnd: string
  listingDate: string
  confirmedPrice: number
  priceMin: number
  priceMax: number
  competitionRatio: string
  equalAlloc: string
  proportionalAlloc: string
  totalSubscribers: string
  totalSubscriptionQty: string
  brokers: string[]
}

type DayEvent = {
  type: 'subscription' | 'listing'
  item: IpoItem
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1
  const days: (Date | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function buildDateMap(items: IpoItem[]): Map<string, DayEvent[]> {
  const map = new Map<string, DayEvent[]>()

  const push = (key: string, event: DayEvent) => {
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }

  for (const item of items) {
    // 청약 기간 전체 표시
    if (item.subscriptionStart) {
      const start = new Date(item.subscriptionStart)
      const end = new Date(item.subscriptionEnd || item.subscriptionStart)
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        push(d.toISOString().slice(0, 10), { type: 'subscription', item })
      }
    }
    // 상장일 표시 (중복 없이)
    if (item.listingDate) {
      push(item.listingDate, { type: 'listing', item })
    }
  }
  return map
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fmt(n: string | number): string {
  const num = typeof n === 'string' ? Number(n.replace(/,/g, '')) : n
  return isNaN(num) ? String(n) : num.toLocaleString()
}

function StatRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  )
}

export function IpoCalendar() {
  const [items, setItems] = useState<IpoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const today = useMemo(() => toYMD(new Date()), [])
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  useEffect(() => {
    fetch('/api/ipo')
      .then(r => r.json())
      .then(p => {
        if (Array.isArray(p?.data)) setItems(p.data)
        else setError(p?.error ?? '데이터 없음')
      })
      .catch(() => setError('불러오기 실패'))
      .finally(() => setLoading(false))
  }, [])

  const dateMap = useMemo(() => buildDateMap(items), [items])
  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth])
  const selectedEvents = selectedDate ? (dateMap.get(selectedDate) ?? []) : []

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // 로드 후 가장 가까운 청약 예정 월로 이동
  useEffect(() => {
    if (items.length === 0) return
    const upcoming = items
      .filter(i => i.subscriptionStart >= today)
      .sort((a, b) => a.subscriptionStart.localeCompare(b.subscriptionStart))
    if (upcoming.length > 0) {
      const d = new Date(upcoming[0].subscriptionStart)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [items, today])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">공모주 캘린더</h3>
            <p className="text-xs text-slate-400">청약 일정 · 상장일 · 38커뮤니케이션</p>
          </div>
        </div>
        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Live</span>
      </div>

      <div className="p-4">
        {loading && <p className="text-center text-xs text-slate-400 py-8">불러오는 중...</p>}
        {!loading && error && <p className="text-center text-xs text-red-400 py-8">{error}</p>}

        {!loading && !error && (
          <>
            {/* 월 내비게이션 */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span className="text-sm font-semibold text-slate-800">{viewYear}년 {viewMonth + 1}월</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((d, i) => (
                <div key={d} className={`text-center text-[10px] font-medium py-1 ${
                  i === 5 ? 'text-blue-400' : i === 6 ? 'text-red-400' : 'text-slate-400'
                }`}>{d}</div>
              ))}
            </div>

            {/* 달력 그리드 */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`pad-${i}`} />
                const key = toYMD(day)
                const events = dateMap.get(key) ?? []
                const isToday = key === today
                const isSelected = key === selectedDate
                const hasEvents = events.length > 0
                const isPast = key < today
                const dow = day.getDay()

                const hasListing = events.some(e => e.type === 'listing')
                const hasSub = events.some(e => e.type === 'subscription')

                return (
                  <button
                    key={key}
                    onClick={() => hasEvents ? setSelectedDate(isSelected ? null : key) : undefined}
                    disabled={!hasEvents}
                    className={`
                      relative flex flex-col items-center rounded-lg py-1 px-0.5 text-center transition-all min-h-[46px]
                      ${isSelected ? 'ring-2 ring-offset-1 ' + (hasListing ? 'bg-red-100 ring-red-400' : 'bg-amber-100 ring-amber-400') : ''}
                      ${isToday && !isSelected ? 'ring-2 ring-amber-300' : ''}
                      ${hasEvents && !isSelected ? 'hover:bg-slate-50 cursor-pointer' : ''}
                      ${!hasEvents ? 'cursor-default' : ''}
                    `}
                  >
                    <span className={`text-[11px] font-medium leading-none mb-0.5 ${
                      isSelected ? (hasListing ? 'text-red-700' : 'text-amber-700') :
                      isToday ? 'text-amber-600 font-bold' :
                      dow === 0 ? 'text-red-400' :
                      dow === 6 ? 'text-blue-400' :
                      isPast ? 'text-slate-300' :
                      'text-slate-700'
                    }`}>
                      {day.getDate()}
                    </span>

                    {/* 청약 이벤트 */}
                    {hasSub && events.filter(e => e.type === 'subscription').slice(0, 1).map(e => (
                      <span key={`s-${e.item.id}`} className={`block w-full text-[8px] truncate px-0.5 rounded leading-tight py-0.5 ${
                        isSelected ? 'bg-amber-200 text-amber-900' :
                        isPast ? 'bg-slate-100 text-slate-400' :
                        e.item.confirmedPrice > 0 ? 'bg-emerald-100 text-emerald-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {e.item.name}
                      </span>
                    ))}

                    {/* 상장일 이벤트 (빨간색) */}
                    {hasListing && events.filter(e => e.type === 'listing').slice(0, 1).map(e => (
                      <span key={`l-${e.item.id}`} className={`block w-full text-[8px] truncate px-0.5 rounded leading-tight py-0.5 ${
                        isSelected ? 'bg-red-200 text-red-900' :
                        isPast ? 'bg-rose-50 text-rose-300' :
                        'bg-red-100 text-red-600'
                      }`}>
                        ▲{e.item.name}
                      </span>
                    ))}

                    {events.length > 2 && (
                      <span className={`text-[8px] ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                        +{events.length - 2}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 범례 */}
            <div className="flex gap-3 mt-2 justify-end">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-100 inline-block" />청약예정
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-100 inline-block" />확정완료
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-red-100 inline-block" />상장일
              </span>
            </div>

            {/* 선택 ��짜 상세 */}
            {selectedDate && selectedEvents.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                <p className="text-[11px] font-semibold text-slate-500">
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>

                {/* 상장일 카드 */}
                {selectedEvents.filter(e => e.type === 'listing').map(({ item }) => (
                  <div key={`listing-${item.id}`} className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded shrink-0">상장일</span>
                        <span className="font-bold text-sm text-slate-900 truncate">{item.name}</span>
                      </div>
                      {item.confirmedPrice > 0 && (
                        <span className="shrink-0 text-[11px] font-semibold text-slate-700">{item.confirmedPrice.toLocaleString()}원</span>
                      )}
                    </div>
                    {item.competitionRatio && (
                      <div className="space-y-1">
                        <StatRow label="경쟁률" value={item.competitionRatio} />
                        {item.equalAlloc && <StatRow label="균등배정" value={`${fmt(item.equalAlloc)}주`} />}
                        {item.proportionalAlloc && <StatRow label="비례배정" value={`${fmt(item.proportionalAlloc)}주`} />}
                        {item.totalSubscribers && <StatRow label="총 청약자" value={`${fmt(item.totalSubscribers)}명`} />}
                        {item.totalSubscriptionQty && <StatRow label="총 청약수량" value={`${fmt(item.totalSubscriptionQty)}주`} />}
                      </div>
                    )}
                  </div>
                ))}

                {/* 청약 카드 */}
                {selectedEvents.filter(e => e.type === 'subscription').map(({ item }) => (
                  <div key={`sub-${item.id}`} className="rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">청약</span>
                        <span className="font-bold text-sm text-slate-900 truncate">{item.name}</span>
                      </div>
                      {item.competitionRatio && (
                        <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{item.competitionRatio}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      <span><span className="text-slate-400">청약 </span>{item.subscriptionStart.slice(5).replace('-', '/')} ~ {item.subscriptionEnd.slice(5).replace('-', '/')}</span>
                      {item.listingDate && <span><span className="text-slate-400">상장 </span><span className="font-semibold text-red-500">{item.listingDate.slice(5).replace('-', '/')}</span></span>}
                      {item.confirmedPrice > 0
                        ? <span><span className="text-slate-400">확정가 </span><span className="font-semibold text-slate-800">{item.confirmedPrice.toLocaleString()}원</span></span>
                        : item.priceMin > 0 && <span><span className="text-slate-400">희망가 </span><span className="font-semibold text-slate-800">{item.priceMin.toLocaleString()}{item.priceMin !== item.priceMax ? `~${item.priceMax.toLocaleString()}` : ''}원</span></span>
                      }
                    </div>
                    {item.brokers.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {item.brokers.map(b => (
                          <span key={b} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md">{b}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 다가오는 일정 목록 (날짜 미선택 시) */}
            {!selectedDate && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11px] text-slate-400 mb-2">다가오는 일정</p>
                <div className="space-y-1.5">
                  {[
                    ...items
                      .filter(i => i.subscriptionEnd >= today)
                      .map(i => ({ date: i.subscriptionStart, item: i, type: 'sub' as const })),
                    ...items
                      .filter(i => i.listingDate && i.listingDate >= today)
                      .map(i => ({ date: i.listingDate, item: i, type: 'listing' as const })),
                  ]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, 5)
                    .map(({ date, item, type }) => {
                      const isActive = type === 'sub' && item.subscriptionStart <= today && item.subscriptionEnd >= today
                      return (
                        <button
                          key={`${type}-${item.id}`}
                          onClick={() => {
                            const d = new Date(date)
                            setViewYear(d.getFullYear())
                            setViewMonth(d.getMonth())
                            setSelectedDate(date)
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 border border-slate-100 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {type === 'listing'
                              ? <span className="shrink-0 text-[9px] font-bold text-red-500 bg-red-50 border border-red-200 px-1 py-0.5 rounded">상장</span>
                              : <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-300'}`} />
                            }
                            <span className="text-xs font-semibold text-slate-800 truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.confirmedPrice > 0 && type !== 'listing' && (
                              <span className="text-[10px] text-slate-500">{item.confirmedPrice.toLocaleString()}원</span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {type === 'listing' ? date.slice(5).replace('-', '/') : `${item.subscriptionStart.slice(5).replace('-', '/')}~${item.subscriptionEnd.slice(5).replace('-', '/')}`}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  {items.filter(i => i.subscriptionEnd >= today || (i.listingDate && i.listingDate >= today)).length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-2">예정된 일정이 없습니다</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
