/**
 * GET /api/collect/ecos
 * 한국은행 ECOS 경제 지표 수집
 *
 * Query params:
 *   type  - 'cpi' | 'base-rate' | 'exchange-rate' (필수)
 *   start - 시작일 (CPI: YYYYMM, 나머지: YYYYMMDD, 기본: 30일 전)
 *   end   - 종료일 (동일 형식, 기본: 오늘)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKrCpi, getKrBaseRate, getKrExchangeRate } from '@/lib/collectors/kr/ecos'

function formatDate(date: Date, monthly: boolean): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  if (monthly) return `${y}${m}`
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function defaultDateRange(monthly: boolean): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (monthly ? 365 : 30))
  return { start: formatDate(start, monthly), end: formatDate(end, monthly) }
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  if (!type || !['cpi', 'base-rate', 'exchange-rate'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be one of: cpi, base-rate, exchange-rate' },
      { status: 400 }
    )
  }

  const isMonthly = type === 'cpi'
  const defaults = defaultDateRange(isMonthly)
  const start = req.nextUrl.searchParams.get('start') ?? defaults.start
  const end = req.nextUrl.searchParams.get('end') ?? defaults.end

  try {
    let data
    if (type === 'cpi') {
      data = await getKrCpi(start, end)
    } else if (type === 'base-rate') {
      data = await getKrBaseRate(start, end)
    } else {
      data = await getKrExchangeRate(start, end)
    }
    return NextResponse.json({ type, start, end, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
