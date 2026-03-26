/**
 * ApeWisdom API Collector (Reddit 직접 크롤링 대체)
 * - Reddit 커뮤니티(wallstreetbets 등)의 종목 언급량 및 감성 수집
 * - API Key 불필요, 무료
 * Docs: https://apewisdom.io/
 */

const APEWISDOM_BASE = 'https://apewisdom.io/api/v1.0'

export type ApeFilter =
  | 'all-stocks'
  | 'wallstreetbets'
  | 'stocks'
  | 'all-crypto'
  | 'CryptoCurrency'

export interface ApeWisdomResult {
  ticker: string
  name: string
  mentions: number
  upvotes: number
  mentions_24h_ago: number
  rank: number
  rank_24h_ago: number
}

export interface ApeWisdomResponse {
  filter: string
  page: number
  results: ApeWisdomResult[]
}

/**
 * 커뮤니티별 종목 언급량 Top 랭킹
 * @param filter 서브레딧 필터
 * @param page   페이지 (기본 1)
 */
export async function getTopMentions(
  filter: ApeFilter = 'all-stocks',
  page = 1
): Promise<ApeWisdomResponse> {
  const res = await fetch(`${APEWISDOM_BASE}/filter/${filter}?page=${page}`)
  if (!res.ok) throw new Error(`ApeWisdom API error ${res.status}`)
  return res.json()
}

/**
 * 특정 종목의 커뮤니티 언급량 조회
 * @param symbol 티커 (예: 'AAPL', 'QQQ')
 * @param filter 서브레딧 필터
 */
export async function getSymbolMentions(
  symbol: string,
  filter: ApeFilter = 'all-stocks'
): Promise<ApeWisdomResponse> {
  const res = await fetch(`${APEWISDOM_BASE}/filter/${filter}/for/${symbol.toUpperCase()}`)
  if (!res.ok) throw new Error(`ApeWisdom symbol error ${res.status} for ${symbol}`)
  return res.json()
}
