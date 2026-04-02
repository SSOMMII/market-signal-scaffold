import { NextResponse } from 'next/server'
import https from 'https'
import crypto from 'crypto'

export const runtime = 'nodejs' // https/crypto는 Node.js 전용 — Edge Runtime 방지

const URL_38_LIST = 'https://www.38.co.kr/html/fund/index.htm?o=k'
const URL_38_DETAIL = (id: string) => `https://www.38.co.kr/html/fund/index.htm?o=v&no=${id}&l=&page=1`

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.38.co.kr/',
}

// 38.co.kr는 구식 DH 키 사용 → @SECLEVEL=1 로 낮춰야 연결 가능
const SSL_AGENT = new https.Agent({
  ciphers: 'DEFAULT:@SECLEVEL=1',
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
})

export interface IpoItem {
  id: string
  name: string
  subscriptionStart: string  // YYYY-MM-DD
  subscriptionEnd: string    // YYYY-MM-DD
  listingDate: string        // YYYY-MM-DD (상장일, 매도 기준일)
  confirmedPrice: number     // 확정가 (0 = 미확정)
  priceMin: number
  priceMax: number
  competitionRatio: string   // 경쟁률
  equalAlloc: string         // 균등배정
  proportionalAlloc: string  // 비례배정
  totalSubscribers: string   // 총 청약자수
  totalSubscriptionQty: string // 총 청약수량
  brokers: string[]
}

// ── HTML 유틸 ───────────────────────────────────────────────────────────

function fetchEucKr(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: SSL_AGENT, headers: FETCH_HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`38.co.kr HTTP ${res.statusCode}`))
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(new TextDecoder('euc-kr').decode(Buffer.concat(chunks))))
      res.on('error', reject)
    })
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('38.co.kr 요청 타임아웃')) })
    req.on('error', reject)
  })
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function parsePrice(text: string): number {
  const n = Number(text.replace(/[,원\s\-]/g, ''))
  return isNaN(n) ? 0 : n
}

function parsePriceRange(text: string): { min: number; max: number } {
  const cleaned = text.replace(/[,원\s]/g, '')
  const parts = cleaned.split('~')
  if (parts.length === 2) return { min: parsePrice(parts[0]), max: parsePrice(parts[1]) }
  const p = parsePrice(text)
  return { min: p, max: p }
}

// "2026.05.11~05.12" → ["2026-05-11", "2026-05-12"]
function parsePeriod(text: string): [string, string] {
  text = text.trim()
  const tilde = text.indexOf('~')
  if (tilde === -1) return ['', '']
  const startParts = text.slice(0, tilde).trim().split('.')
  if (startParts.length < 3) return ['', '']
  const year = startParts[0]
  const startMM = startParts[1].padStart(2, '0')
  const startDD = startParts[2].padStart(2, '0')
  const endRaw = text.slice(tilde + 1).trim()
  const endParts = endRaw.split('.')
  let endMM: string, endDD: string
  if (endParts.length === 3) {
    endMM = endParts[1].padStart(2, '0'); endDD = endParts[2].padStart(2, '0')
  } else if (endParts.length === 2) {
    endMM = endParts[0].padStart(2, '0'); endDD = endParts[1].padStart(2, '0')
  } else return ['', '']
  return [`${year}-${startMM}-${startDD}`, `${year}-${endMM}-${endDD}`]
}

// "2026.04.02" → "2026-04-02"
function parseSingleDate(text: string): string {
  const m = text.trim().match(/(\d{4})\.(\d{2})\.(\d{2})/)
  if (!m) return ''
  return `${m[1]}-${m[2]}-${m[3]}`
}

function extractCells(rowHtml: string): string[] {
  const cells: string[] = []
  const re = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let m
  while ((m = re.exec(rowHtml)) !== null) cells.push(m[1])
  return cells
}

// 라벨 텍스트 뒤에 오는 첫 번째 <td> 값 추출
function parseAfterLabel(html: string, label: string): string {
  const idx = html.indexOf(label)
  if (idx < 0) return ''
  const snippet = html.slice(idx, idx + 600)
  const m = snippet.match(/<td[^>]*>([\s\S]*?)<\/td>/i)
  if (!m) return ''
  // 특수문자(●◆■) 및 괄호 내 퍼센트 제거
  return stripTags(m[1]).replace(/[●◆■★☆▶◀]/g, '').replace(/\([\d.]+%\)/g, '').trim()
}

// ── 목록 파싱 ───────────────────────────────────────────────────────────

function parseIpoList(html: string): Pick<IpoItem, 'id' | 'name' | 'subscriptionStart' | 'subscriptionEnd' | 'confirmedPrice' | 'priceMin' | 'priceMax' | 'competitionRatio' | 'brokers'>[] {
  const items = []
  const rowRe = /<tr bgcolor='#(?:FFFFFF|F8F8F8)'>([\s\S]*?)<\/tr>/gi
  let match

  while ((match = rowRe.exec(html)) !== null) {
    const cells = extractCells(match[1])
    if (cells.length < 6) continue

    const nameMatch = cells[0].match(/no=(\d+)[^"]*"[^>]*>(?:<[^>]+>)*([^<]+)/)
    if (!nameMatch) continue

    const [subscriptionStart, subscriptionEnd] = parsePeriod(stripTags(cells[1]))
    if (!subscriptionStart) continue

    const confirmedText = stripTags(cells[2]).replace(/[,\s]/g, '')
    const confirmedPrice = confirmedText === '-' ? 0 : parsePrice(confirmedText)
    const { min: priceMin, max: priceMax } = parsePriceRange(stripTags(cells[3]))
    const competitionRatio = stripTags(cells[4]).trim()
    const brokers = stripTags(cells[5]).split(',').map(s => s.trim()).filter(Boolean)

    items.push({
      id: nameMatch[1],
      name: nameMatch[2].trim(),
      subscriptionStart,
      subscriptionEnd,
      confirmedPrice,
      priceMin,
      priceMax,
      competitionRatio,
      brokers,
    })
  }
  return items
}

// ── 상세 파싱 ───────────────────────────────────────────────────────────

function parseIpoDetail(html: string): {
  listingDate: string
  equalAlloc: string
  proportionalAlloc: string
  totalSubscribers: string
  totalSubscriptionQty: string
  competitionRatio: string
} {
  return {
    listingDate: parseSingleDate(parseAfterLabel(html, '상장일')),
    equalAlloc: parseAfterLabel(html, '균등배정').replace(/,/g, '').split(/\s/)[0] ?? '',
    proportionalAlloc: parseAfterLabel(html, '비례배정').replace(/,/g, '').split(/\s/)[0] ?? '',
    totalSubscribers: parseAfterLabel(html, '총청약자수').replace(/[,명]/g, ''),
    totalSubscriptionQty: parseAfterLabel(html, '총청약수량').replace(/,/g, ''),
    competitionRatio: parseAfterLabel(html, '청약경합률') || parseAfterLabel(html, '경합률'),
  }
}

// ── API 핸들러 ─────────────────────────────────────────────────────────

export async function GET() {
  try {
    const listHtml = await fetchEucKr(URL_38_LIST)
    const listItems = parseIpoList(listHtml)

    // 상세 페이지 조회 - 4개씩 청크로 나눠 병렬 처리 (과도한 동시 요청 방지)
    const CHUNK = 4
    const details: { id: string; listingDate: string; equalAlloc: string; proportionalAlloc: string; totalSubscribers: string; totalSubscriptionQty: string; competitionRatio: string }[] = []
    for (let i = 0; i < listItems.length; i += CHUNK) {
      const chunk = listItems.slice(i, i + CHUNK)
      const chunkResults = await Promise.all(
        chunk.map(item =>
          fetchEucKr(URL_38_DETAIL(item.id))
            .then(html => ({ id: item.id, ...parseIpoDetail(html) }))
            .catch(() => ({ id: item.id, listingDate: '', equalAlloc: '', proportionalAlloc: '', totalSubscribers: '', totalSubscriptionQty: '', competitionRatio: '' }))
        )
      )
      details.push(...chunkResults)
    }
    const detailMap = new Map(details.map(d => [d.id, d]))

    const data: IpoItem[] = listItems.map(item => {
      const detail = detailMap.get(item.id)
      return {
        ...item,
        listingDate: detail?.listingDate ?? '',
        equalAlloc: detail?.equalAlloc ?? '',
        proportionalAlloc: detail?.proportionalAlloc ?? '',
        totalSubscribers: detail?.totalSubscribers ?? '',
        totalSubscriptionQty: detail?.totalSubscriptionQty ?? '',
        // 상세 페이지 경쟁률이 더 정확 (목록보다 소수점 포함)
        competitionRatio: detail?.competitionRatio || item.competitionRatio,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
