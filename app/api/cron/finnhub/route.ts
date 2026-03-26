/**
 * GET /api/cron/finnhub  [Phase 2 — FINNHUB_API_KEY 발급 후 활성화]
 * 주요 ETF 뉴스 감성 수집 → sentiment_cache 저장
 *
 * 스케줄: 매일 00:20 UTC (vercel.json)
 * 저장: sentiment_cache { ticker, sentiment_news: bullishPercent(0~1), sentiment_combined: 평균 }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFinnhubSentiment } from '@/lib/collectors/us/finnhub'
import { mergeSentimentCache } from '@/lib/supabaseAdmin'

// 수집 대상 ETF (signals route와 동일)
const TARGET_TICKERS = ['QQQ', 'SPY', 'SOXL', 'TQQQ', 'IWM', 'GLD', 'TLT']

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.FINNHUB_API_KEY) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'FINNHUB_API_KEY not set — Phase 2 미활성' },
      { status: 200 }
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const results: { ticker: string; bullish: number; status: string }[] = []

  for (const ticker of TARGET_TICKERS) {
    try {
      const sentiment = await getFinnhubSentiment(ticker)
      const bullish = sentiment.sentiment.bullishPercent // 0~1

      // 기존 reddit 감성이 있으면 combined = (news + reddit) / 2, 없으면 news 그대로
      await mergeSentimentCache(ticker, today, {
        sentiment_news: bullish,
        // combined는 mergeSentimentCache 내부에서 기존 reddit 값과 병합되므로
        // 여기서는 news 기반 combined만 우선 설정; reddit이 있으면 이후 덮어쓰지 않음
        sentiment_combined: bullish,
      })

      results.push({ ticker, bullish, status: 'ok' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error'
      results.push({ ticker, bullish: 0, status: msg })
    }
  }

  return NextResponse.json({ ok: true, date: today, results })
}
