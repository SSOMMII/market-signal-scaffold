/**
 * GET /api/geo-risk
 * 지정학적 리스크 분석
 * - Finnhub 일반 뉴스 + RSS 수집
 * - 키워드 룰 기반 섹터 영향 태깅
 *
 * TODO: OpenAI gpt-4o-mini 연동 시 applyGeoRules() → LLM 호출로 교체
 */

import { NextResponse } from 'next/server'
import { getFinnhubMarketNews } from '@/lib/collectors/us/finnhub'
import { fetchRssNews } from '@/lib/collectors/common/rssNews'
import { applyGeoRules, type GeoSignal } from '@/lib/collectors/common/geoRules'

export const revalidate = 3600 // 1시간 캐시

export async function GET() {
  try {
    // Finnhub + RSS 병렬 수집
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

    if (headlines.length === 0) {
      return NextResponse.json({ signals: [], totalHeadlines: 0 })
    }

    const signals: GeoSignal[] = applyGeoRules(headlines)

    return NextResponse.json({
      signals,
      totalHeadlines: headlines.length,
      sources: {
        finnhub: finnhubResult.status === 'fulfilled' ? finnhubResult.value.length : 0,
        rss: rssResult.status === 'fulfilled' ? rssResult.value.length : 0,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
