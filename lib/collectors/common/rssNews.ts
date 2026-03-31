/**
 * 지정학적 이슈 RSS 뉴스 수집기
 * Google News RSS (무료, API 키 불필요)
 * BBC World RSS (무료, 공개)
 */

export interface RssNewsItem {
  title: string
  source: string
  pubDate: string | null
}

const RSS_SOURCES = [
  {
    name: 'Google News (지정학)',
    url: 'https://news.google.com/rss/search?q=war+conflict+tariff+geopolitical+sanction+trump&hl=en-US&gl=US&ceid=US:en',
  },
  {
    name: 'BBC World',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
  },
]

function parseRssXml(xml: string, sourceName: string): RssNewsItem[] {
  const items: RssNewsItem[] = []
  const itemRegex = /<item[\s\S]*?<\/item>/gi
  const titleRegex = /<title[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title[^>]*>([\s\S]*?)<\/title>/i
  const pubDateRegex = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i

  const rawItems = xml.match(itemRegex) ?? []
  for (const raw of rawItems) {
    const titleMatch = raw.match(titleRegex)
    const title = (titleMatch?.[1] ?? titleMatch?.[2] ?? '').trim()
    if (!title) continue

    const pubDateMatch = raw.match(pubDateRegex)
    const pubDate = pubDateMatch?.[1]?.trim() ?? null

    items.push({ title, source: sourceName, pubDate })
  }
  return items
}

export async function fetchRssNews(): Promise<RssNewsItem[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map(async ({ name, url }) => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketSignal/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`)
      const xml = await res.text()
      return parseRssXml(xml, name)
    })
  )

  const items: RssNewsItem[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') items.push(...r.value)
  }
  return items
}
