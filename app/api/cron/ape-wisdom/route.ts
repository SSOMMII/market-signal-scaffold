/**
 * GET /api/cron/ape-wisdom  [Phase 1 — API Key 불필요]
 * Reddit 종목 언급량 수집 → sentiment_cache 저장
 *
 * 스케줄: 매일 00:10 UTC (vercel.json)
 * 저장: sentiment_cache { ticker, sentiment_reddit: 0~1 (최고 언급량 대비 정규화) }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTopMentions } from '@/lib/collectors/us/apeWisdom'
import { mergeSentimentCache } from '@/lib/supabaseAdmin'

const TOP_N = 25

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const response = await getTopMentions('all-stocks')
    const results = response.results.slice(0, TOP_N)

    if (results.length === 0) {
      return NextResponse.json({ ok: true, date: today, saved: 0 })
    }

    const maxMentions = results[0].mentions || 1

    // 병렬 upsert
    await Promise.all(
      results.map((r) =>
        mergeSentimentCache(r.ticker, today, {
          sentiment_reddit: r.mentions / maxMentions,
        })
      )
    )

    return NextResponse.json({
      ok: true,
      date: today,
      saved: results.length,
      top3: results.slice(0, 3).map((r) => ({
        ticker: r.ticker,
        mentions: r.mentions,
        rank: r.rank,
      })),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/ape-wisdom]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
