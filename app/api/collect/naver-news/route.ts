/**
 * GET /api/collect/naver-news
 * 네이버 금융 뉴스 수집
 *
 * Query params:
 *   symbol - 종목코드 (선택, 없으면 메인 뉴스 반환, 예: '005930')
 */

import { NextRequest, NextResponse } from 'next/server'
import { getNaverMainNews, getNaverStockNews } from '@/lib/collectors/kr/naverNews'

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')

  try {
    const data = symbol ? await getNaverStockNews(symbol) : await getNaverMainNews()
    return NextResponse.json({ symbol: symbol ?? null, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
