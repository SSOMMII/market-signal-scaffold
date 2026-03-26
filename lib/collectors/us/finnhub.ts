/**
 * Finnhub API Collector (Seeking Alpha / Reddit 대체)
 * - 주식 현재가 Quote
 * - 뉴스 감성(Sentiment) 분석
 * - 시장 전체 뉴스 수집
 * 발급: https://finnhub.io/ → 무료 플랜 (일 호출 제한 내 사용)
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1'

async function finnhubGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('FINNHUB_API_KEY not set')

  const qs = new URLSearchParams({ ...params, token: apiKey })
  const res = await fetch(`${FINNHUB_BASE}${path}?${qs}`)

  if (!res.ok) throw new Error(`Finnhub API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export interface FinnhubQuote {
  c: number   // 현재가 (current)
  d: number   // 변동 (change)
  dp: number  // 변동률 % (change percent)
  h: number   // 고가
  l: number   // 저가
  o: number   // 시가
  pc: number  // 전일 종가
  t: number   // timestamp
}

/**
 * 주식 현재가 Quote
 * @param symbol 티커 (예: 'AAPL', 'QQQ', 'SPY')
 */
export async function getFinnhubQuote(symbol: string): Promise<FinnhubQuote> {
  return finnhubGet<FinnhubQuote>('/quote', { symbol })
}

export interface FinnhubSentiment {
  buzz: { articlesInLastWeek: number; weeklyAverage: number; buzz: number }
  companyNewsScore: number
  sectorAverageBullishPercent: number
  sectorAverageNewsScore: number
  sentiment: { bearishPercent: number; bullishPercent: number }
  symbol: string
}

/**
 * 종목별 뉴스 감성 분석 (Bullish/Bearish 비율)
 * @param symbol 티커
 */
export async function getFinnhubSentiment(symbol: string): Promise<FinnhubSentiment> {
  return finnhubGet<FinnhubSentiment>('/news-sentiment', { symbol })
}

export interface FinnhubNewsItem {
  category: string
  datetime: number
  headline: string
  id: number
  image: string
  related: string
  source: string
  summary: string
  url: string
}

/**
 * 시장 전체 뉴스 수집
 * @param category 'general' | 'forex' | 'crypto' | 'merger'
 * @param minId 최소 뉴스 ID (페이지네이션)
 */
export async function getFinnhubMarketNews(
  category: 'general' | 'forex' | 'crypto' | 'merger' = 'general',
  minId = 0
): Promise<FinnhubNewsItem[]> {
  return finnhubGet<FinnhubNewsItem[]>('/news', {
    category,
    ...(minId > 0 ? { minId: String(minId) } : {}),
  })
}

export interface FinnhubCandle {
  c: number[]  // close prices
  h: number[]  // high
  l: number[]  // low
  o: number[]  // open
  s: string    // status
  t: number[]  // timestamps
  v: number[]  // volume
}

/**
 * 주식 OHLCV 캔들 데이터 (일봉)
 * @param symbol 티커
 * @param from Unix timestamp (초)
 * @param to   Unix timestamp (초)
 */
export async function getFinnhubCandles(
  symbol: string,
  from: number,
  to: number
): Promise<FinnhubCandle> {
  return finnhubGet<FinnhubCandle>('/stock/candle', {
    symbol,
    resolution: 'D',
    from: String(from),
    to: String(to),
  })
}
