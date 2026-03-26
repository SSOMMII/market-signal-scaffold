/**
 * GET /api/collect/fear-greed
 * Fear & Greed 지수 수집
 *
 * Query params:
 *   limit  - 조회 일 수 (기본 1, 최대 30)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFearGreedIndex } from '@/lib/collectors/common/fearGreed'

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 30) : 1

  if (isNaN(limit)) {
    return NextResponse.json({ error: 'limit must be a number' }, { status: 400 })
  }

  try {
    const data = await getFearGreedIndex(limit)
    return NextResponse.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
