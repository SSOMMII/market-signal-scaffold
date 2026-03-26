/**
 * GET /api/collect/kis
 * 한국투자증권 KIS API - 국내 주식 데이터 수집
 *
 * Query params:
 *   type   - 'price' | 'investor-flow' | 'ohlcv' (필수)
 *   symbol - 종목코드 (필수, 예: '005930')
 *   start  - 시작일 YYYYMMDD (ohlcv 전용, 기본: 30일 전)
 *   end    - 종료일 YYYYMMDD (ohlcv 전용, 기본: 오늘)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKisStockPrice, getKisInvestorFlow, getKisDailyOhlcv } from '@/lib/collectors/kr/kis'

function yyyymmdd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')
  const symbol = req.nextUrl.searchParams.get('symbol')

  if (!type || !['price', 'investor-flow', 'ohlcv'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be one of: price, investor-flow, ohlcv' },
      { status: 400 }
    )
  }
  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  }

  try {
    let data
    if (type === 'price') {
      data = await getKisStockPrice(symbol)
    } else if (type === 'investor-flow') {
      data = await getKisInvestorFlow(symbol)
    } else {
      const today = new Date()
      const past = new Date()
      past.setDate(past.getDate() - 30)
      const start = req.nextUrl.searchParams.get('start') ?? yyyymmdd(past)
      const end = req.nextUrl.searchParams.get('end') ?? yyyymmdd(today)
      data = await getKisDailyOhlcv(symbol, start, end)
    }
    return NextResponse.json({ type, symbol, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
