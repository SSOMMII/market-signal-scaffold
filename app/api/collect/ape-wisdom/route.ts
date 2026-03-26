/**
 * GET /api/collect/ape-wisdom
 * Reddit 커뮤니티 종목 언급량 수집 (ApeWisdom)
 *
 * Query params:
 *   symbol - 특정 종목 티커 (선택, 없으면 Top 랭킹 반환, 예: 'AAPL')
 *   filter - 'all-stocks' | 'wallstreetbets' | 'stocks' | 'all-crypto' | 'CryptoCurrency' (기본: 'all-stocks')
 *   page   - 페이지 번호 (기본: 1, symbol 없을 때만 적용)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTopMentions, getSymbolMentions, type ApeFilter } from '@/lib/collectors/us/apeWisdom'

const VALID_FILTERS: ApeFilter[] = ['all-stocks', 'wallstreetbets', 'stocks', 'all-crypto', 'CryptoCurrency']

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get('symbol')
  const filterParam = req.nextUrl.searchParams.get('filter') ?? 'all-stocks'
  const pageParam = req.nextUrl.searchParams.get('page') ?? '1'

  if (!VALID_FILTERS.includes(filterParam as ApeFilter)) {
    return NextResponse.json(
      { error: `filter must be one of: ${VALID_FILTERS.join(', ')}` },
      { status: 400 }
    )
  }

  const filter = filterParam as ApeFilter
  const page = Math.max(1, parseInt(pageParam, 10) || 1)

  try {
    const data = symbol
      ? await getSymbolMentions(symbol, filter)
      : await getTopMentions(filter, page)
    return NextResponse.json({ symbol: symbol ?? null, filter, page: symbol ? undefined : page, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
