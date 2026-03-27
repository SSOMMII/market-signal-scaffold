/**
 * GET /api/cron/kis
 * 국내 주요 주식 OHLCV 수집 + 기술적 지표 계산 → daily_indicators 저장
 *
 * 스케줄: 평일 07:00 UTC (한국시간 16:00 — KRX 장마감 후)
 * 120일치 OHLCV 기반으로 RSI/MACD/SMA/볼린저/스토캐스틱 계산 후 upsert
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKisDailyOhlcv } from '@/lib/collectors/kr/kis'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { calcRSI, calcMACD, calcSMA, calcBollinger, calcStochastic } from '@/lib/indicators'

const KR_STOCKS: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035420': 'NAVER',
  '035720': '카카오',
  '005380': '현대차',
}

function yyyymmdd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.KIS_APP_KEY || !process.env.KIS_APP_SECRET) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'KIS_APP_KEY/KIS_APP_SECRET not set' },
      { status: 200 }
    )
  }

  const today = new Date()
  const past = new Date()
  past.setDate(past.getDate() - 180) // 180일치 → SMA50/MACD/BB/Stoch 모두 계산 가능
  const startDate = yyyymmdd(past)
  const endDate = yyyymmdd(today)

  const adminClient = getAdminClient()
  const results: { symbol: string; status: string; close?: number }[] = []

  for (const [symbol, name] of Object.entries(KR_STOCKS)) {
    try {
      // 1) KIS에서 180일치 일봉 OHLCV 조회
      const raw = await getKisDailyOhlcv(symbol, startDate, endDate)
      const items: any[] = raw?.output2 ?? []

      if (!items.length) {
        results.push({ symbol, status: 'no ohlcv data' })
        continue
      }

      // KIS는 최신순 반환 → 오래된 순으로 뒤집기
      const sorted = [...items].reverse()
      const closes  = sorted.map((r: any) => parseFloat(r.stck_clpr)).filter(Boolean)
      const opens   = sorted.map((r: any) => parseFloat(r.stck_oprc)).filter(Boolean)
      const highs   = sorted.map((r: any) => parseFloat(r.stck_hgpr)).filter(Boolean)
      const lows    = sorted.map((r: any) => parseFloat(r.stck_lwpr)).filter(Boolean)
      const volumes = sorted.map((r: any) => parseFloat(r.acml_vol)).filter(Boolean)

      const lastItem = sorted[sorted.length - 1]
      const rawDate = lastItem.stck_bsop_date as string // YYYYMMDD
      const asOfDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`

      const close  = closes[closes.length - 1]
      const open   = opens[opens.length - 1]
      const high   = highs[highs.length - 1]
      const low    = lows[lows.length - 1]
      const volume = volumes[volumes.length - 1]

      // 2) 기술적 지표 계산
      const rsi = calcRSI(closes)
      const { macd, signal: signal_line } = calcMACD(closes)
      const sma_50  = calcSMA(closes, 50)
      const sma_120 = calcSMA(closes, 120)
      const sma_200 = calcSMA(closes, 200)
      const { upper: bollinger_upper, middle: bollinger_middle, lower: bollinger_lower } = calcBollinger(closes)
      const { k: stoch_k, d: stoch_d } = calcStochastic(highs, lows, closes)

      // 3) market_master 조회 (없으면 자동 생성)
      let masterId: number
      const { data: existing } = await adminClient
        .from('market_master')
        .select('id')
        .eq('symbol', symbol)
        .maybeSingle()

      if (existing) {
        masterId = existing.id
      } else {
        const { data: inserted, error: iErr } = await adminClient
          .from('market_master')
          .insert({ symbol, name, market_type: 'KR', asset_type: 'STOCK', region: 'KR', currency: 'KRW' })
          .select('id')
          .single()
        if (iErr || !inserted) {
          results.push({ symbol, status: `market_master insert failed: ${iErr?.message}` })
          continue
        }
        masterId = inserted.id
      }

      // 4) daily_indicators upsert (OHLCV + 지표)
      const { error } = await adminClient
        .from('daily_indicators')
        .upsert(
          {
            market_master_id: masterId,
            as_of_date: asOfDate,
            close, open, high, low, volume,
            rsi, macd, signal_line,
            sma_50, sma_120, sma_200,
            bollinger_upper, bollinger_middle, bollinger_lower,
            stoch_k, stoch_d,
          },
          { onConflict: 'market_master_id,as_of_date' }
        )

      if (error) throw error
      results.push({ symbol, status: 'ok', close })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error'
      results.push({ symbol, status: msg })
    }
  }

  return NextResponse.json({ ok: true, date: endDate, results })
}
