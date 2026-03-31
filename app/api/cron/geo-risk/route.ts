/**
 * GET /api/cron/geo-risk
 * 지정학적 리스크 뉴스 주기적 수집 및 캐시 갱신
 * 스케줄: 매 2시간 (vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFinnhubMarketNews } from '@/lib/collectors/us/finnhub'
import { fetchRssNews } from '@/lib/collectors/common/rssNews'
import { applyGeoRules } from '@/lib/collectors/common/geoRules'

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [finnhubResult, rssResult] = await Promise.allSettled([
      getFinnhubMarketNews('general'),
      fetchRssNews(),
    ])

    const headlines: string[] = []
    if (finnhubResult.status === 'fulfilled') {
      finnhubResult.value.forEach(n => headlines.push(n.headline))
    }
    if (rssResult.status === 'fulfilled') {
      rssResult.value.forEach(n => headlines.push(n.title))
    }

    const signals = applyGeoRules(headlines)

    return NextResponse.json({
      ok: true,
      signals: signals.length,
      headlines: headlines.length,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
