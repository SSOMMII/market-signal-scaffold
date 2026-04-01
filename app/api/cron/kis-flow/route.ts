/**
 * GET /api/cron/kis-flow
 * KRX 시장 전체 외국인 순매수 수급 수집 → foreign_flow 테이블 upsert
 *
 * 스케줄: 평일 07:10 UTC (한국시간 16:10 — KRX 장마감 후)
 * - 코스피(J) + 코스닥(Q) 외국인 순매수 거래대금을 합산해 KRX 기준으로 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKisMarketInvestorFlow } from '@/lib/collectors/kr/kis'
import { getAdminClient } from '@/lib/supabaseAdmin'

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
      { status: 200 },
    )
  }

  const today = new Date()
  const todayStr = yyyymmdd(today)

  try {
    // 코스피 + 코스닥 외국인 순매수 거래대금(원) 조회
    const [kospiRaw, kosdaqRaw] = await Promise.all([
      getKisMarketInvestorFlow('J', todayStr, todayStr),
      getKisMarketInvestorFlow('Q', todayStr, todayStr),
    ])

    const kospiRow = kospiRaw?.output1?.[0]
    const kosdaqRow = kosdaqRaw?.output1?.[0]

    // frgn_ntby_tr_pbmn: 외국인 순매수 거래대금 (원)
    const kospiNetBuy = kospiRow?.frgn_ntby_tr_pbmn != null
      ? parseFloat(kospiRow.frgn_ntby_tr_pbmn)
      : null
    const kosdaqNetBuy = kosdaqRow?.frgn_ntby_tr_pbmn != null
      ? parseFloat(kosdaqRow.frgn_ntby_tr_pbmn)
      : null

    if (kospiNetBuy === null && kosdaqNetBuy === null) {
      return NextResponse.json({
        ok: false,
        reason: 'KIS returned no foreign flow data',
        kospiRaw,
        kosdaqRaw,
      })
    }

    const netBuy = (kospiNetBuy ?? 0) + (kosdaqNetBuy ?? 0)
    const asOfDate = kospiRow?.stck_bsop_date ?? todayStr

    // YYYYMMDD → YYYY-MM-DD
    const asOfDateFormatted = `${asOfDate.slice(0, 4)}-${asOfDate.slice(4, 6)}-${asOfDate.slice(6, 8)}`

    const adminClient = getAdminClient()
    const { error } = await adminClient
      .from('foreign_flow')
      .upsert(
        {
          as_of_date: asOfDateFormatted,
          market: 'KRX',
          net_buy: netBuy,
          futures_position: 0,
          program_trading: 0,
        },
        { onConflict: 'as_of_date,market' },
      )

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      as_of_date: asOfDateFormatted,
      net_buy: netBuy,
      kospi: kospiNetBuy,
      kosdaq: kosdaqNetBuy,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
