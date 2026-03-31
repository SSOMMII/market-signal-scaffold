'use client'

import { useEffect, useRef, useState } from 'react'
import type { GeoSignal } from '@/lib/collectors/common/geoRules'

type ApiResponse = {
  signals: GeoSignal[]
  totalHeadlines: number
  updatedAt: string
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000 // 30분

const TYPE_ICON: Record<GeoSignal['type'], string> = {
  war:       '⚔️',
  trade:     '📦',
  monetary:  '🏦',
  energy:    '⛽',
  china:     '🇨🇳',
  sanctions: '🚫',
  recession: '📉',
}

const SEVERITY_STYLE: Record<GeoSignal['severity'], string> = {
  high:   'bg-red-50 border-red-200',
  medium: 'bg-amber-50 border-amber-200',
  low:    'bg-slate-50 border-slate-200',
}

const SEVERITY_DOT: Record<GeoSignal['severity'], string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-slate-400',
}

const SEVERITY_LABEL: Record<GeoSignal['severity'], string> = {
  high:   '고위험',
  medium: '주의',
  low:    '모니터링',
}

const DIR_STYLE = {
  up:      'text-emerald-600 bg-emerald-50',
  down:    'text-red-500 bg-red-50',
  neutral: 'text-slate-500 bg-slate-100',
}

const DIR_ARROW = {
  up:      '↑',
  down:    '↓',
  neutral: '→',
}

export function GeoRiskPanel() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    fetch('/api/geo-risk')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); setRefreshing(false) })
      .catch(() => { setLoading(false); setRefreshing(false) })
  }

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">지정학적 리스크</h3>
            <p className="text-xs text-slate-400">국제 이슈 → 시장 영향 분석</p>
          </div>
        </div>
        <span className="text-[10px] text-slate-400">
          {refreshing ? (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              갱신 중...
            </span>
          ) : data ? `뉴스 ${data.totalHeadlines}건 분석` : ''}
        </span>
      </div>

      {/* 본문 */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (!data?.signals?.length) && (
          <p className="text-sm text-slate-400 text-center py-6">
            현재 감지된 지정학적 리스크 없음
          </p>
        )}

        {!loading && data?.signals?.map(signal => (
          <div
            key={signal.ruleId}
            className={`rounded-xl border p-3 cursor-pointer transition-all ${SEVERITY_STYLE[signal.severity]}`}
            onClick={() => setExpanded(expanded === signal.ruleId ? null : signal.ruleId)}
          >
            {/* 이슈 요약 행 */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base">{TYPE_ICON[signal.type]}</span>
                <span className="font-semibold text-sm text-slate-800 truncate">{signal.label}</span>
                <span className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_DOT[signal.severity]}`} />
                  {SEVERITY_LABEL[signal.severity]}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">뉴스 {signal.newsCount}건</span>
            </div>

            {/* 섹터 태그 */}
            <div className="mt-2 flex flex-wrap gap-1">
              {signal.sectors.slice(0, 4).map(s => (
                <span
                  key={s.name}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${DIR_STYLE[s.direction]}`}
                >
                  {DIR_ARROW[s.direction]} {s.name}
                </span>
              ))}
            </div>

            {/* 펼침: 근거 + 키워드 */}
            {expanded === signal.ruleId && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                <p className="text-xs text-slate-600 leading-relaxed">{signal.reason}</p>
                <div className="flex flex-wrap gap-1">
                  {signal.matchedKeywords.map(kw => (
                    <span key={kw} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 푸터 */}
      {data?.updatedAt && (
        <div className="px-4 pb-3 text-[10px] text-slate-300 text-right">
          룰 기반 분석 · {new Date(data.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 기준
        </div>
      )}
    </div>
  )
}
