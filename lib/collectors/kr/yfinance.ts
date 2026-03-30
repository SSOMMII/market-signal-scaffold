/**
 * yfinance Collector for Korean stocks
 * - PER, PBR, ROE 등 재무지표 수집
 * - Yahoo Finance 기반 (API 키 불필요)
 *
 * NOTE: 이 TS 모듈은 현재 리포지토리에서 직접 호출되는 경로가 없습니다.
 *       Python 스크립트(`scripts/collect_yfinance.py`)에서 데이터를 수집합니다.
 *       이 페이지는 TypeScript 컴파일 오류 방지를 위해 최소 형태로 유지합니다.
 */

export interface YFinanceFundamentals {
  per: number | null  // Price-to-Earnings Ratio
  pbr: number | null  // Price-to-Book Ratio
  roe: number | null  // Return on Equity (%)
  eps: number | null  // Earnings Per Share
  dividendYield: number | null  // 배당수익률 (%)
  marketCap: number | null  // 시가총액
}

/**
 * 한국 종목 재무지표 조회 (yfinance 기반)
 * @param symbol 티커 (예: '005930.KS' for 삼성전자)
 */
export async function getYFinanceFundamentals(symbol: string): Promise<YFinanceFundamentals> {
  console.warn(`getYFinanceFundamentals is not implemented in TS for ${symbol}. Returning nulls.`)

  // Python 스크립트 기반 수집 대신, 여기서는 null로 fallback 처리합니다.
  return {
    per: null,
    pbr: null,
    roe: null,
    eps: null,
    dividendYield: null,
    marketCap: null,
  }
}