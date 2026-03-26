/**
 * GET /api/collect/finnhub
 * Finnhub API - 미국 주식 Quote / 감성분석 / 뉴스 / 캔들 수집
 *
 * Query params:
 *   type     - 'quote' | 'sentiment' | 'news' | 'candles' (필수)
 *   symbol   - 티커 (quote/sentiment/candles 필수, 예: 'SPY')
 *   category - 'general' | 'forex' | 'crypto' | 'merger' (news 전용, 기본: 'general')
 *   from     - Unix timestamp 초 (candles 전용, 기본: 30일 전)
 *   to       - Unix timestamp 초 (candles 전용, 기본: 현재)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getFinnhubQuote,
  getFinnhubSentiment,
  getFinnhubMarketNews,
  getFinnhubCandles,
} from '@/lib/collectors/us/finnhub'

type NewsCategory = 'general' | 'forex' | 'crypto' | 'merger'
const NEWS_CATEGORIES: NewsCategory[] = ['general', 'forex', 'crypto', 'merger']

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type')

  if (!type || !['quote', 'sentiment', 'news', 'candles'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be one of: quote, sentiment, news, candles' },
      { status: 400 }
    )
  }

  try {
    if (type === 'quote') {
      const symbol = req.nextUrl.searchParams.get('symbol')
      if (!symbol) return NextResponse.json({ error: 'symbol is required for quote' }, { status: 400 })
      const data = await getFinnhubQuote(symbol)
      return NextResponse.json({ type, symbol, data })
    }

    if (type === 'sentiment') {
      const symbol = req.nextUrl.searchParams.get('symbol')
      if (!symbol) return NextResponse.json({ error: 'symbol is required for sentiment' }, { status: 400 })
      const data = await getFinnhubSentiment(symbol)
      return NextResponse.json({ type, symbol, data })
    }

    if (type === 'news') {
      const categoryParam = req.nextUrl.searchParams.get('category') ?? 'general'
      if (!NEWS_CATEGORIES.includes(categoryParam as NewsCategory)) {
        return NextResponse.json(
          { error: `category must be one of: ${NEWS_CATEGORIES.join(', ')}` },
          { status: 400 }
        )
      }
      const data = await getFinnhubMarketNews(categoryParam as NewsCategory)
      return NextResponse.json({ type, category: categoryParam, data })
    }

    // candles
    const symbol = req.nextUrl.searchParams.get('symbol')
    if (!symbol) return NextResponse.json({ error: 'symbol is required for candles' }, { status: 400 })

    const nowSec = Math.floor(Date.now() / 1000)
    const toParam = req.nextUrl.searchParams.get('to')
    const fromParam = req.nextUrl.searchParams.get('from')
    const to = toParam ? parseInt(toParam, 10) : nowSec
    const from = fromParam ? parseInt(fromParam, 10) : nowSec - 30 * 24 * 60 * 60

    const data = await getFinnhubCandles(symbol, from, to)
    return NextResponse.json({ type, symbol, from, to, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
