import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// 미국 ETF
const US_ETF_META: Record<string, string> = {
  'QQQ':  'Invesco QQQ Trust',
  'SPY':  'SPDR S&P 500 ETF',
  'SOXL': 'Direxion Semi Bull 3X',
  'TQQQ': 'ProShares UltraPro QQQ',
  'IWM':  'iShares Russell 2000',
  'GLD':  'SPDR Gold Shares',
  'TLT':  'iShares 20Y Treasury',
}

// 국내 주식 (KIS API 수집 대상)
const KR_STOCK_META: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035420': 'NAVER',
  '035720': '카카오',
  '005380': '현대차',
}

/**
 * RSI / MACD / SMA / Stochastic 기반 AI Score 계산
 * 범위: -4.5 ~ +4.5
 */
function calcScore(row: Record<string, any>): number {
  let score = 0
  const { close, rsi, macd, signal_line, sma_50, sma_200, stoch_k } = row

  if (rsi != null) {
    if      (rsi < 30) score += 1.5
    else if (rsi < 45) score += 0.5
    else if (rsi > 70) score -= 1.5
    else if (rsi > 55) score -= 0.5
  }

  if (macd != null && signal_line != null) {
    score += macd > signal_line ? 1.0 : -1.0
  }

  if (close != null && sma_50 != null) {
    score += close > sma_50 ? 0.5 : -0.5
  }

  if (close != null && sma_200 != null) {
    score += close > sma_200 ? 0.5 : -0.5
  }

  if (stoch_k != null) {
    if      (stoch_k < 20) score += 1.0
    else if (stoch_k > 80) score -= 1.0
  }

  return Math.round(score * 10) / 10
}

function scoreToAction(score: number): '매수' | '매도' | '관망' {
  if (score >= 1.5) return '매수'
  if (score <= -1.0) return '매도'
  return '관망'
}

async function fetchSignals(meta: Record<string, string>) {
  const symbols = Object.keys(meta)

  const { data: masters, error: mErr } = await supabase
    .from('market_master')
    .select('id, symbol')
    .in('symbol', symbols)

  if (mErr) throw mErr
  if (!masters?.length) return []

  const idToSymbol: Record<number, string> = {}
  const ids: number[] = []
  for (const m of masters) {
    idToSymbol[m.id] = m.symbol
    ids.push(m.id)
  }

  const { data: rows, error: rErr } = await supabase
    .from('daily_indicators')
    .select('market_master_id, as_of_date, close, rsi, macd, signal_line, sma_50, sma_200, stoch_k')
    .in('market_master_id', ids)
    .order('as_of_date', { ascending: false })
    .limit(ids.length * 3)

  if (rErr) throw rErr

  const grouped: Record<number, typeof rows> = {}
  for (const row of (rows ?? [])) {
    if (!grouped[row.market_master_id]) grouped[row.market_master_id] = []
    if (grouped[row.market_master_id].length < 2) grouped[row.market_master_id].push(row)
  }

  const results = []
  for (const [idStr, pair] of Object.entries(grouped)) {
    const id = Number(idStr)
    const symbol = idToSymbol[id]
    if (!symbol || !pair[0]) continue

    const latest = pair[0]
    const prev   = pair[1]
    const score  = calcScore(latest)
    const action = scoreToAction(score)

    let changePct = 0
    let changeStr = '-'
    if (prev?.close && latest.close) {
      changePct = (latest.close - prev.close) / prev.close * 100
      changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%'
    }

    results.push({
      ticker: symbol,
      name: meta[symbol] ?? symbol,
      change: changeStr,
      score: (score >= 0 ? '+' : '') + score.toFixed(1),
      action,
      up: changePct >= 0,
    })
  }

  results.sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
  return results
}

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') ?? 'us'
    const meta = market === 'kr' ? KR_STOCK_META : US_ETF_META
    const data = await fetchSignals(meta)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
