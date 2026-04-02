import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

/**
 * GET /api/foreign-flow?market=KRX
 * 외국인 순매수 수급 데이터 조회
 *
 * 우선순위:
 *   1) foreign_flow 테이블 (KIS cron이 수집한 실데이터)
 *   2) daily_indicators.foreign_net_flow (KIS cron upsert 시 함께 저장)
 *
 * 반환:
 *   { data: { net_buy: number; net_buy_str: string; as_of_date: string; source: string } | null }
 */
export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') ?? 'KRX'

  try {
    // 1차: foreign_flow 테이블
    const { data: ffRows, error: ffErr } = await supabase
      .from('foreign_flow')
      .select('as_of_date, net_buy, futures_position, program_trading')
      .eq('market', market)
      .neq('net_buy', 0)
      .order('as_of_date', { ascending: false })
      .limit(1)

    if (!ffErr && ffRows?.length) {
      const row = ffRows[0]
      return NextResponse.json({
        data: {
          net_buy:     row.net_buy,
          net_buy_str: formatNetBuy(row.net_buy),
          as_of_date:  row.as_of_date,
          source:      'foreign_flow',
        },
      })
    }

    // 2차: daily_indicators.foreign_net_flow (KOSPI 기준)
    const { data: master } = await supabase
      .from('market_master')
      .select('id')
      .eq('symbol', '^KS11')
      .maybeSingle()

    if (master) {
      const { data: diRows } = await supabase
        .from('daily_indicators')
        .select('as_of_date, foreign_net_flow')
        .eq('market_master_id', master.id)
        .not('foreign_net_flow', 'is', null)
        .order('as_of_date', { ascending: false })
        .limit(1)

      if (diRows?.length && diRows[0].foreign_net_flow != null) {
        const netBuy = diRows[0].foreign_net_flow
        return NextResponse.json({
          data: {
            net_buy:     netBuy,
            net_buy_str: formatNetBuy(netBuy),
            as_of_date:  diRows[0].as_of_date,
            source:      'daily_indicators',
          },
        })
      }
    }

    return NextResponse.json({ data: null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** 억원 단위 포맷 (예: +2,340억) */
function formatNetBuy(value: number): string {
  const eok = Math.round(value / 1e8)   // 원 → 억
  return (eok >= 0 ? '+' : '') + eok.toLocaleString('ko-KR') + '억'
}
