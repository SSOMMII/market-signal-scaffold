/**
 * DART (전자공시시스템) API Collector
 * - 한국 기업 재무제표 데이터 수집
 * - PER, PBR, ROE 등 계산
 * Docs: https://opendart.fss.or.kr/
 */

const DART_BASE = 'https://opendart.fss.or.kr/api'

export async function dartGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.DART_API_KEY
  if (!apiKey) throw new Error('DART_API_KEY not set')

  const qs = new URLSearchParams({ ...params, crtfc_key: apiKey })
  const res = await fetch(`${DART_BASE}${path}?${qs}`)

  if (!res.ok) throw new Error(`DART API error ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export interface DartCompany {
  corp_code: string
  corp_name: string
  stock_code: string | null
  modify_date: string
}

export interface DartFinancialData {
  symbol: string
  year: number
  quarter: number
  revenue: number | null  // 매출액
  netIncome: number | null  // 당기순이익
  totalAssets: number | null  // 자산총계
  totalEquity: number | null  // 자본총계
  eps: number | null  // 주당순이익
  per: number | null
  pbr: number | null
  roe: number | null
}

/**
 * 기업 목록 조회
 */
export async function getDartCompanies(): Promise<DartCompany[]> {
  const data = await dartGet<{ list: DartCompany[] }>('/corpCode.xml')
  return data.list
}

/**
 * 재무제표 주요계정 조회
 * @param corpCode 기업코드
 * @param bsnsYear 사업연도
 * @param reprtCode 보고서코드 (11013=1분기, 11012=반기, 11014=3분기, 11011=사업보고서)
 */
export async function getDartFinancials(
  corpCode: string,
  bsnsYear: string,
  reprtCode: string = '11011'
): Promise<any> {
  return dartGet('/fnlttSinglAcnt.json', {
    corp_code: corpCode,
    bsns_year: bsnsYear,
    reprt_code: reprtCode,
  })
}

/**
 * 종목별 재무지표 계산 (PER, PBR, ROE)
 * @param symbol 티커 (예: '005930')
 */
export async function getDartFundamentals(symbol: string): Promise<DartFinancialData | null> {
  try {
    // 기업코드 찾기
    const companies = await getDartCompanies()
    const company = companies.find(c => c.stock_code === symbol)
    if (!company) return null

    // 최근 사업보고서 데이터
    const currentYear = new Date().getFullYear()
    const financials = await getDartFinancials(company.corp_code, String(currentYear))

    if (!financials.list || financials.list.length === 0) return null

    // 주요 계정 추출
    const accounts = financials.list
    const revenue = findAccountValue(accounts, '매출액') || findAccountValue(accounts, '영업수익')
    const netIncome = findAccountValue(accounts, '당기순이익')
    const totalAssets = findAccountValue(accounts, '자산총계')
    const totalEquity = findAccountValue(accounts, '자본총계')

    // EPS는 별도 계산 또는 API에서 가져오기
    const eps = netIncome && totalEquity ? netIncome / (totalEquity / 1000) : null  // 대략적 계산

    // PER, PBR, ROE 계산을 위해 현재가 필요하지만, 여기서는 null로 반환
    // 실제 계산은 analysis API에서 현재가와 함께 수행

    return {
      symbol,
      year: currentYear,
      quarter: 4,
      revenue,
      netIncome,
      totalAssets,
      totalEquity,
      eps,
      per: null,  // 현재가 필요
      pbr: null,  // 현재가 필요
      roe: null,  // 계산 필요
    }
  } catch (error) {
    console.error(`DART error for ${symbol}:`, error)
    return null
  }
}

function findAccountValue(accounts: any[], accountName: string): number | null {
  const account = accounts.find(acc =>
    acc.account_nm?.includes(accountName) &&
    acc.fs_div === 'CFS'  // 연결재무제표
  )
  return account ? Number(account.thstrm_amount?.replace(/,/g, '')) : null
}
