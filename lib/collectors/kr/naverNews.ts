/**
 * 네이버 금융 뉴스 크롤러 (BeautifulSoup 대체 - Node.js cheerio 사용)
 * - 네이버 증권 메인뉴스 헤드라인 수집
 * - 종목별 관련 뉴스 수집
 * 주의: 적절한 요청 주기를 유지할 것 (과도한 크롤링 금지)
 */

import * as cheerio from 'cheerio'

const NAVER_FINANCE_BASE = 'https://finance.naver.com'

const CRAWL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://finance.naver.com/',
}

export interface NaverNewsItem {
  title: string
  url: string
  source: string
  publishedAt: string | null
}

/**
 * 네이버 증권 메인 뉴스 헤드라인 수집
 */
export async function getNaverMainNews(): Promise<NaverNewsItem[]> {
  const res = await fetch(`${NAVER_FINANCE_BASE}/news/mainnews.naver`, {
    headers: CRAWL_HEADERS,
  })
  if (!res.ok) throw new Error(`Naver news fetch error ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NaverNewsItem[] = []

  // 메인 뉴스 리스트 파싱
  $('ul.newsList > li').each((_, el) => {
    const titleEl = $(el).find('a.articleSubject, .articleSubject a, dd.articleSubject a').first()
    const title = titleEl.text().trim()
    const href = titleEl.attr('href') ?? ''
    const source = $(el).find('.press').text().trim()
    const publishedAt = $(el).find('.wdate').text().trim() || null

    if (title) {
      items.push({
        title,
        url: href.startsWith('http') ? href : `${NAVER_FINANCE_BASE}${href}`,
        source,
        publishedAt,
      })
    }
  })

  return items
}

/**
 * 특정 종목 관련 뉴스 수집
 * @param symbol 종목코드 (예: '005930' = 삼성전자)
 */
export async function getNaverStockNews(symbol: string): Promise<NaverNewsItem[]> {
  const res = await fetch(
    `${NAVER_FINANCE_BASE}/item/news.naver?code=${symbol}`,
    { headers: CRAWL_HEADERS }
  )
  if (!res.ok) throw new Error(`Naver stock news fetch error ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)
  const items: NaverNewsItem[] = []

  $('table.type5 tbody tr').each((_, el) => {
    const titleEl = $(el).find('td:first-child a')
    const title = titleEl.text().trim()
    const href = titleEl.attr('href') ?? ''
    const source = $(el).find('td:nth-child(3)').text().trim()
    const publishedAt = $(el).find('td:last-child').text().trim() || null

    if (title) {
      items.push({
        title,
        url: href.startsWith('http') ? href : `${NAVER_FINANCE_BASE}${href}`,
        source,
        publishedAt,
      })
    }
  })

  return items
}
