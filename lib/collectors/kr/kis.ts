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
