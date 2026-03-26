/**
 * Alternative.me Fear & Greed Index Collector
 * - 암호화폐 및 주식 시장 전반의 공포/탐욕 지수
 * - API Key 불필요, 무제한 무료
 * - VIX 보조 지표로 활용
 * Docs: https://alternative.me/crypto/fear-and-greed-index/
 */

const FEAR_GREED_URL = 'https://api.alternative.me/fng/'

export interface FearGreedEntry {
  value: string                 // 0~100 점수
  value_classification:         // 감성 분류
    | 'Extreme Fear'
    | 'Fear'
    | 'Neutral'
    | 'Greed'
    | 'Extreme Greed'
  timestamp: string             // Unix timestamp
  time_until_update?: string
}

export interface FearGreedResponse {
  name: string
  data: FearGreedEntry[]
  metadata: { error: string | null }
}

/**
 * 공포/탐욕 지수 조회
 * @param limit 조회 일 수 (기본 1 = 오늘만)
 */
export async function getFearGreedIndex(limit = 1): Promise<FearGreedResponse> {
  const res = await fetch(`${FEAR_GREED_URL}?limit=${limit}&format=json`)
  if (!res.ok) throw new Error(`Fear & Greed API error ${res.status}`)
  return res.json()
}

/**
 * 오늘의 공포/탐욕 지수 단일 값
 */
export async function getTodayFearGreed(): Promise<FearGreedEntry> {
  const response = await getFearGreedIndex(1)
  const entry = response.data?.[0]
  if (!entry) throw new Error('Fear & Greed index data unavailable')
  return entry
}
