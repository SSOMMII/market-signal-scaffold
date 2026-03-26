/**
 * 한국은행 ECOS (Economic Statistics System) API Collector
 * - 소비자물가지수 (CPI)
 * - 한국은행 기준금리
 * - 원달러 환율
 * 발급: https://ecos.bok.or.kr/ → 개발자 서비스 → API Key 신청
 */

const ECOS_BASE = 'https://ecos.bok.or.kr/api'

/** ECOS 통계 조회 주기 */
type EcosPeriod = 'A' | 'Q' | 'M' | 'D'

interface EcosRow {
  STAT_CODE: string
  STAT_NAME: string
  ITEM_CODE1: string
  ITEM_NAME1: string
  DATA_VALUE: string
  TIME: string
}

async function fetchEcos(
  statCode: string,
  period: EcosPeriod,
  startDate: string,
  endDate: string,
  itemCode1 = ' ',
  itemCode2 = ' ',
  itemCode3 = ' ',
  itemCode4 = ' '
): Promise<EcosRow[]> {
  const apiKey = process.env.ECOS_API_KEY
  if (!apiKey) throw new Error('ECOS_API_KEY not set')

  const url = [
    ECOS_BASE,
    'StatisticSearch',
    apiKey,
    'json',
    'kr',
    '1',
    '1000',
    statCode,
    period,
    startDate,
    endDate,
    itemCode1,
    itemCode2,
    itemCode3,
    itemCode4,
  ].join('/')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`ECOS API error ${res.status}`)

  const json = await res.json()
  if (json.RESULT?.CODE) throw new Error(`ECOS error: ${json.RESULT.MESSAGE}`)

  return json.StatisticSearch?.row ?? []
}

/**
 * 소비자물가지수 (CPI) - 월별
 * statCode: 021Y126
 * @param startYM YYYYMM 형식
 * @param endYM   YYYYMM 형식
 */
export async function getKrCpi(startYM: string, endYM: string) {
  return fetchEcos('021Y126', 'M', startYM, endYM)
}

/**
 * 한국은행 기준금리 - 일별
 * statCode: 722Y001
 * @param startDate YYYYMMDD
 * @param endDate   YYYYMMDD
 */
export async function getKrBaseRate(startDate: string, endDate: string) {
  return fetchEcos('722Y001', 'D', startDate, endDate)
}

/**
 * 원달러 환율 (매매기준율) - 일별
 * statCode: 731Y001, itemCode1: 0000001
 * @param startDate YYYYMMDD
 * @param endDate   YYYYMMDD
 */
export async function getKrExchangeRate(startDate: string, endDate: string) {
  return fetchEcos('731Y001', 'D', startDate, endDate, '0000001')
}
