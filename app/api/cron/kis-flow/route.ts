/**
 * GET /api/cron/kis-flow
 * 주요 종목 기준 외국인/기관/개인 순매수 수급 수집 → foreign_flow 테이블 upsert
 *
 * 스케줄: 평일 07:10 UTC (한국시간 16:10 — KRX 장마감 후)
 * - inquire-investor (FHKST01010900) 종목별 output1[0] 합산 방식
 * - net_buy        = 외국인 순매수 거래대금(원) 합계
 * - futures_position = 기관 순매수 거래대금(원) 합계
 * - program_trading  = 개인 순매수 거래대금(원) 합계
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKisInvestorFlow } from '@/lib/collectors/kr/kis'
import { getAdminClient } from '@/lib/supabaseAdmin'

// 수급 집계 대상 종목 (KOSPI 대형주)
const KR_SYMBOLS = ['005930', '000660', '035420', '035720', '005380']

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

  try {
    let totalFrgn = 0      // 외국인 순매수 거래대금 합계
    let totalOrgn = 0      // 기관 순매수 거래대금 합계
    let totalIndvdl = 0    // 개인 순매수 거래대금 합계
    let asOfDate: string | null = null
    let successCount = 0
    const symbolResults: Record<string, string> = {}

    for (const symbol of KR_SYMBOLS) {
      try {
        const raw = await getKisInvestorFlow(symbol)
        // output1: 당일 포함 최근 영업일 배열, [0] = 당일
        const row = raw?.output1?.[0]

        if (!row) {
          symbolResults[symbol] = 'no data'
          continue
        }

        const frgnAmt   = parseFloat(row.frgn_ntby_tr_pbmn   ?? '0') || 0
        const orgnAmt   = parseFloat(row.orgn_ntby_tr_pbmn   ?? '0') || 0
        const indvdlAmt = parseFloat(row.indvdl_ntby_tr_pbmn ?? '0') || 0

        totalFrgn   += frgnAmt
        totalOrgn   += orgnAmt
        totalIndvdl += indvdlAmt
        successCount++
        symbolResults[symbol] = 'ok'

        // 첫 번째 성공 종목의 영업일 기준으로 날짜 결정
        if (!asOfDate && row.stck_bsop_date) {
          const d = row.stck_bsop_date as string
          asOfDate = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
        }
      } catch (e: any) {
        symbolResults[symbol] = e?.message ?? 'error'
      }
    }

    if (successCount === 0) {
      return NextResponse.json({
        ok: false,
        reason: 'No investor flow data from any symbol',
        symbolResults,
      })
    }

    // 응답 날짜 fallback: 오늘 날짜
    if (!asOfDate) {
      const t = new Date()
      asOfDate = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    }

    const adminClient = getAdminClient()
    const { error } = await adminClient
      .from('foreign_flow')
      .upsert(
        {
          as_of_date:      asOfDate,
          market:          'KRX',
          net_buy:         totalFrgn,
          futures_position: totalOrgn,
          program_trading:  totalIndvdl,
        },
        { onConflict: 'as_of_date,market' },
      )

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok:                   true,
      as_of_date:           asOfDate,
      foreign_net_buy:      totalFrgn,
      institutional_net_buy: totalOrgn,
      individual_net_buy:   totalIndvdl,
      stocks_processed:     successCount,
      symbolResults,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
