/**
 * GET /api/cron/fear-greed  [Phase 1 — API Key 불필요]
 * Fear & Greed 지수 수집 → sentiment_cache 저장
 *
 * 스케줄: 매일 00:05 UTC (vercel.json)
 * 저장: sentiment_cache { ticker: 'FEAR_GREED', sentiment_combined: 0~1 }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTodayFearGreed } from '@/lib/collectors/common/fearGreed'
import { mergeSentimentCache } from '@/lib/supabaseAdmin'

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // 로컬 개발 환경: 비활성화
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  try {
    const entry = await getTodayFearGreed()
    const score = parseInt(entry.value, 10)

    await mergeSentimentCache('FEAR_GREED', today, {
      sentiment_combined: score / 100, // 0~100 → 0~1 정규화
    })

    return NextResponse.json({
      ok: true,
      date: today,
      value: score,
      classification: entry.value_classification,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[cron/fear-greed]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
