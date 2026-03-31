'use client'
import { useEffect, useState } from 'react'

interface IpoItem {
  name: string          // 종목명
  code?: string         // 종목코드
  subscriptionStart: string  // 청약 시작일 (YYYY-MM-DD)
  subscriptionEnd: string    // 청약 종료일
  listingDate: string        // 상장 예정일
  priceMin: number           // 공모가 하단
  priceMax: number           // 공모가 상단
  brokers: string[]          // 주관사 (청약 가능 증권사)
  marketType: 'KOSPI' | 'KOSDAQ' | 'KONEX' | '-'
}

// DART API 연동 전 UI 확인용 목업 데이터
const MOCK_IPO: IpoItem[] = [
  {
    name: '(주)예시기업A',
    code: '123450',
    subscriptionStart: '2026-04-07',
    subscriptionEnd: '2026-04-08',
    listingDate: '2026-04-15',
    priceMin: 12000,
    priceMax: 14000,
    brokers: ['미래에셋', 'KB증권'],
    marketType: 'KOSDAQ',
  },
  {
    name: '(주)예시기업B',
    code: '234560',
    subscriptionStart: '2026-04-10',
    subscriptionEnd: '2026-04-11',
    listingDate: '2026-04-18',
    priceMin: 30000,
    priceMax: 35000,
    brokers: ['한국투자', '삼성증권', 'NH투자'],
    marketType: 'KOSPI',
  },
  {
    name: '(주)예시기업C',
    subscriptionStart: '2026-04-14',
    subscriptionEnd: '2026-04-15',
    listingDate: '2026-04-22',
    priceMin: 8000,
    priceMax: 9000,
    brokers: ['키움증권'],
    marketType: 'KOSDAQ',
  },
]

function getDday(dateStr: string): string {
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
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= new Date(start) && today <= new Date(end)
}

export function IpoPanel() {
  const [items, setItems] = useState<IpoItem[]>(MOCK_IPO)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // DART API 연동 시 아래 주석 해제
    // setLoading(true)
    // fetch('/api/ipo')
    //   .then(r => r.json())
    //   .then(({ data }) => { if (data?.length) setItems(data) })
    //   .catch(() => {})
    //   .finally(() => setLoading(false))
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
            <p className="text-xs text-slate-400">청약 일정 · 증권사별 안내</p>
          </div>
        </div>
        <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
          DART 연동 예정
        </span>
      </div>

      {/* 목록 */}
      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-center text-xs text-slate-400 py-4">불러오는 중...</p>
        )}
        {!loading && items.map((ipo, i) => {
          const open = isSubscriptionOpen(ipo.subscriptionStart, ipo.subscriptionEnd)
          const dday = getDday(ipo.subscriptionStart)
          return (
            <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
              {/* 종목명 + 시장 + D-day */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{ipo.name}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    ipo.marketType === 'KOSPI' ? 'bg-blue-50 text-blue-600'
                    : ipo.marketType === 'KOSDAQ' ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-500'
                  }`}>
                    {ipo.marketType}
                  </span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  open ? 'bg-emerald-100 text-emerald-700'
                  : dday.startsWith('D-') ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-500'
                }`}>
                  {open ? '청약중' : dday}
                </span>
              </div>

              {/* 청약기간 / 상장일 */}
              <div className="flex gap-4 text-[11px] text-slate-500">
                <span>
                  <span className="text-slate-400">청약 </span>
                  {ipo.subscriptionStart.slice(5)} ~ {ipo.subscriptionEnd.slice(5)}
                </span>
                <span>
                  <span className="text-slate-400">상장 </span>
                  {ipo.listingDate.slice(5)}
                </span>
              </div>

              {/* 공모가 / 주관사 */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600">
                  <span className="text-slate-400">공모가 </span>
                  <span className="font-semibold text-slate-800">
                    {ipo.priceMin.toLocaleString()}~{ipo.priceMax.toLocaleString()}원
                  </span>
                </span>
                <div className="flex gap-1 flex-wrap justify-end max-w-[55%]">
                  {ipo.brokers.map(b => (
                    <span key={b} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {/* DART API 연동 안내 */}
        <p className="text-center text-[10px] text-slate-300 pt-1">
          DART OpenAPI 연동 시 실시간 공모주 일정으로 자동 업데이트됩니다
        </p>
      </div>
    </div>
  )
}
