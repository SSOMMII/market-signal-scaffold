/**
 * GET /api/cron/kis  [Phase 3 — KIS_APP_KEY + KIS_APP_SECRET 발급 후 활성화]
 * 주요 국내 주식 시세 수집 → daily_indicators 저장
 *
 * 스케줄: 평일 07:00 UTC (한국시간 16:00 — KRX 장마감 후)
 * 저장: daily_indicators { close, open, high, low, volume }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKisStockPrice } from '@/lib/collectors/kr/kis'
import { getAdminClient } from '@/lib/supabaseAdmin'

// 수집 대상 국내 종목코드
const TARGET_SYMBOLS = [
  '005930', // 삼성전자
  '000660', // SK하이닉스
  '035420', // NAVER
  '035720', // 카카오
  '005380', // 현대차
]

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
      { ok: false, skipped: true, reason: 'KIS_APP_KEY/KIS_APP_SECRET not set — Phase 3 미활성' },
      { status: 200 }
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const adminClient = getAdminClient()
  const results: { symbol: string; status: string; close?: number }[] = []

  for (const symbol of TARGET_SYMBOLS) {
    try {
      const raw = await getKisStockPrice(symbol)
      const output = raw?.output

      if (!output) {
        results.push({ symbol, status: 'no output' })
        continue
      }

      const close = parseFloat(output.stck_prpr)   // 현재가
      const open = parseFloat(output.stck_oprc)    // 시가
      const high = parseFloat(output.stck_hgpr)    // 고가
      const low = parseFloat(output.stck_lwpr)     // 저가
      const volume = parseFloat(output.acml_vol)   // 누적거래량

      // market_master에서 id 조회
      const { data: master } = await adminClient
        .from('market_master')
        .select('id')
        .eq('symbol', symbol)
        .maybeSingle()

      if (!master) {
        results.push({ symbol, status: 'market_master not found' })
        continue
      }

      const { error } = await adminClient
        .from('daily_indicators')
        .upsert(
          { market_master_id: master.id, as_of_date: today, close, open, high, low, volume },
          { onConflict: 'market_master_id,as_of_date' }
        )

      if (error) throw error
      results.push({ symbol, status: 'ok', close })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error'
      results.push({ symbol, status: msg })
    }
  }

  return NextResponse.json({ ok: true, date: today, results })
}
