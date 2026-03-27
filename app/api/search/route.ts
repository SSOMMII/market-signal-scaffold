/**
 * GET /api/search?q={query}
 * 한글·종목코드 → Supabase market_master 로컬 검색
 * 영문·티커     → Yahoo Finance 검색
 * 두 결과 병합 반환
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export type SearchResult = {
  symbol: string
  name: string
  market: 'KR' | 'US' | 'OTHER'
  exchange?: string
  type?: string
}

function hasKorean(s: string) { return /[가-힣]/.test(s) }
function isKrCode(s: string)  { return /^\d{4,6}$/.test(s.trim()) }

// ── Supabase 로컬 검색 (한글명·종목코드) ─────────────────────────────────
async function searchLocal(q: string): Promise<SearchResult[]> {
  try {
    const { data } = await supabase
      .from('market_master')
      .select('symbol, name, market_type, asset_type')
      .or(`name.ilike.%${q}%,symbol.ilike.%${q}%`)
      .order('market_type', { ascending: true })
      .limit(15)

    return (data ?? []).map(r => ({
      symbol:   r.symbol,
      name:     r.name,
      market:   r.market_type as 'KR' | 'US' | 'OTHER',
      exchange: r.market_type === 'KR' ? 'KRX' : 'US',
      type:     r.asset_type ?? 'EQUITY',
    }))
  } catch {
    return []
  }
}

// ── Yahoo Finance 검색 (영문·글로벌) ─────────────────────────────────────
async function searchYahoo(q: string): Promise<SearchResult[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return []
    const json = await res.json()
    if (json.finance?.error) return []

    return (json.quotes ?? [])
      .filter((q: Record<string, unknown>) =>
        q.isYahooFinance && ['EQUITY', 'ETF'].includes(String(q.quoteType ?? ''))
      )
      .map((q: Record<string, unknown>) => {
        const rawSym   = String(q.symbol ?? '')
        const sym      = rawSym.replace(/\.(KS|KQ|KPK)$/i, '')
        const exchange = String(q.exchange ?? '')
        const krEx     = ['KSC', 'KOE', 'KPK']
        const isKr     = krEx.includes(exchange) || /\.(KS|KQ)$/i.test(rawSym)
        return {
          symbol:   sym,
          name:     String(q.longname ?? q.shortname ?? sym),
          market:   (isKr ? 'KR' : 'US') as 'KR' | 'US',
          exchange,
          type:     String(q.quoteType ?? 'EQUITY'),
        }
      })
  } catch {
    return []
  }
}

// ── Route handler ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 1) return NextResponse.json({ results: [] })

  const isKr = hasKorean(q) || isKrCode(q)

  let results: SearchResult[]

  if (isKr) {
    // 한글 or 종목코드 → 로컬 우선, Yahoo는 숫자코드일 때만 보완
    const [local, yahoo] = await Promise.all([
      searchLocal(q),
      isKrCode(q) ? searchYahoo(q) : Promise.resolve([]),
    ])
    results = [...local, ...yahoo]
  } else {
    // 영문 → Yahoo 우선, 로컬도 병렬 (영문명 등록 종목 포함)
    const [yahoo, local] = await Promise.all([
      searchYahoo(q),
      searchLocal(q),
    ])
    results = [...yahoo, ...local]
  }

  // 심볼 기준 중복 제거
  const seen = new Set<string>()
  const deduped = results.filter(r => {
    if (!r.symbol || seen.has(r.symbol)) return false
    seen.add(r.symbol)
    return true
  }).slice(0, 20)

  return NextResponse.json({ results: deduped })
}
