/**
 * 한국투자증권 KIS Developers API Collector
 * - OAuth2 토큰 발급 및 캐싱
 * - 국내 주식 현재가 시세 조회
 * - 외국인/기관 투자자 순매수 수급 데이터 조회
 * Docs: https://apiportal.koreainvestment.com/
 */

const KIS_BASE = 'https://openapi.koreainvestment.com:9443'

interface KisToken {
  access_token: string
  expires_at: number
}

// 모듈 레벨 토큰 캐시 (서버 메모리)
let cachedToken: KisToken | null = null

async function getKisToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token
  }

  const appkey = process.env.KIS_APP_KEY
  const appsecret = process.env.KIS_APP_SECRET
  if (!appkey || !appsecret) throw new Error('KIS_APP_KEY / KIS_APP_SECRET not set')

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey, appsecret }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`KIS token error ${res.status}: ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    // expires_in(초) 기준으로 60초 여유를 두고 만료 처리
    expires_at: Date.now() + (Number(data.expires_in) - 60) * 1000,
  }

  return cachedToken.access_token
}

function kisHeaders(token: string, trId: string) {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    appkey: process.env.KIS_APP_KEY!,
    appsecret: process.env.KIS_APP_SECRET!,
    tr_id: trId,
  }
}

/**
 * 국내 주식 현재가 시세 조회
 * @param symbol 종목코드 (예: '005930' = 삼성전자)
 */
export async function getKisStockPrice(symbol: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_INPUT_ISCD: symbol,
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`,
    { headers: kisHeaders(token, 'FHKST01010100') }
  )

  if (!res.ok) throw new Error(`KIS stock price error ${res.status}`)
  return res.json()
}

/**
 * 국내 주식 투자자별 매매 동향 (외국인/기관/개인 순매수)
 * @param symbol 종목코드
 */
export async function getKisInvestorFlow(symbol: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_INPUT_ISCD: symbol,
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor?${params}`,
    { headers: kisHeaders(token, 'FHKST01010900') }
  )

  if (!res.ok) throw new Error(`KIS investor flow error ${res.status}`)
  return res.json()
}

/**
 * 국내 주식 기간별 시세 (일봉 OHLCV)
 * @param symbol 종목코드
 * @param startDate YYYYMMDD
 * @param endDate YYYYMMDD
 */
export async function getKisDailyOhlcv(symbol: string, startDate: string, endDate: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'J',
    FID_INPUT_ISCD: symbol,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: 'D',
    FID_ORG_ADJ_PRC: '1',
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`,
    { headers: kisHeaders(token, 'FHKST03010100') }
  )

  if (!res.ok) throw new Error(`KIS daily OHLCV error ${res.status}`)
  return res.json()
}

/**
 * ETF 현재가 시세 조회
 * 주식과 다르게 FID_COND_MRKT_DIV_CODE = 'E' 사용
 * @param symbol ETF 코드 (예: '069500' = KODEX 200)
 */
export async function getKisEtfPrice(symbol: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'E',
    FID_INPUT_ISCD: symbol,
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?${params}`,
    { headers: kisHeaders(token, 'FHPST01010000') }
  )

  if (!res.ok) throw new Error(`KIS ETF price error ${res.status}`)
  return res.json()
}

/**
 * ETF 일봉 OHLCV 조회
 * @param symbol ETF 코드 (6자리, .KS 제외)
 * @param startDate YYYYMMDD
 * @param endDate YYYYMMDD
 */
export async function getKisEtfDailyOhlcv(symbol: string, startDate: string, endDate: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'E',
    FID_INPUT_ISCD: symbol,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
    FID_PERIOD_DIV_CODE: 'D',
    FID_ORG_ADJ_PRC: '1',
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params}`,
    { headers: kisHeaders(token, 'FHPST01710000') }
  )

  if (!res.ok) throw new Error(`KIS ETF OHLCV error ${res.status}`)
  return res.json()
}

/**
 * ETF 투자자별 매매 동향 (외국인/기관/개인 순매수)
 * @param symbol ETF 코드 (6자리)
 */
export async function getKisEtfInvestorFlow(symbol: string) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: 'E',
    FID_INPUT_ISCD: symbol,
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor?${params}`,
    { headers: kisHeaders(token, 'FHPST01010900') }
  )

  if (!res.ok) throw new Error(`KIS ETF investor flow error ${res.status}`)
  return res.json()
}

/**
 * 국내 시장 전체 투자자별 매매 동향 (외국인/기관/개인 순매수)
 * 코스피 또는 코스닥 시장 전체 기준 외국인 순매수 거래대금(원) 반환
 * @param market 'J' = 코스피, 'Q' = 코스닥
 * @param startDate YYYYMMDD
 * @param endDate YYYYMMDD
 */
export async function getKisMarketInvestorFlow(
  market: 'J' | 'Q',
  startDate: string,
  endDate: string,
) {
  const token = await getKisToken()
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: market,
    FID_INPUT_DATE_1: startDate,
    FID_INPUT_DATE_2: endDate,
  })

  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor-trend-total?${params}`,
    { headers: kisHeaders(token, 'FHKST03030100') },
  )

  if (!res.ok) throw new Error(`KIS market investor flow error ${res.status}`)
  return res.json()
}

/**
 * market_master의 KR ETF 목록 전체에 대해 KIS 현재가 일괄 조회
 * @param symbols .KS 포함 심볼 배열 (예: ['069500.KS', '229200.KS'])
 * @returns symbol → 현재가/수급 데이터 맵
 */
export async function getKisEtfPriceBatch(symbols: string[]): Promise<Record<string, any>> {
  const results: Record<string, any> = {}

  // 병렬 요청 (KIS API rate limit 고려해 5개씩 배치)
  const BATCH_SIZE = 5
  const DELAY_MS = 200

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (sym) => {
        const code = sym.replace('.KS', '')
        try {
          const data = await getKisEtfPrice(code)
          results[sym] = data
        } catch (e) {
          console.error(`[KIS] ${sym} 조회 실패:`, e)
          results[sym] = null
        }
      })
    )
    if (i + BATCH_SIZE < symbols.length) {
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }

  return results
}
