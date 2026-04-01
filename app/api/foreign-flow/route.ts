import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

/**
 * GET /api/foreign-flow?market=KRX
 * 외국인 순매수 수급 데이터 조회
 *
 * 우선순위:
 *   1) foreign_flow 테이블 (KIS cron이 수집한 실데이터)
 *   2) daily_indicators.foreign_net_flow
 *   3) KIS API 실시간 직접 조회 (KODEX200 ETF proxy)
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

    // 3차: KIS API 실시간 직접 조회 (KODEX200 ETF proxy)
    if (process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET) {
      try {
        const { getKisEtfInvestorFlow, getKisInvestorFlow } = await import('@/lib/collectors/kr/kis')
        // ETF 투자자 동향 우선 시도, 실패 시 주식(KODEX200 종목코드 J시장) 시도
        let raw: any = null
        try { raw = await getKisEtfInvestorFlow('069500') } catch { /* 미지원 시 무시 */ }
        let netBuy = parseKisInvestorNetBuy(raw)
        if (netBuy === null) {
          try { raw = await getKisInvestorFlow('069500') } catch { /* 미지원 시 무시 */ }
          netBuy = parseKisInvestorNetBuy(raw)
        }
        if (netBuy !== null) {
          const today = new Date().toISOString().split('T')[0]
          return NextResponse.json({
            data: {
              net_buy:     netBuy,
              net_buy_str: formatNetBuy(netBuy),
              as_of_date:  today,
              source:      'kis_live',
            },
          })
        }
      } catch { /* KIS API 실패 시 무시 */ }
    }

    return NextResponse.json({ data: null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

/** KIS investor flow API 응답에서 외국인 순매수 거래대금을 유연하게 파싱 */
function parseKisInvestorNetBuy(raw: any): number | null {
  if (!raw) return null
  // KIS API 응답 구조가 버전/계정마다 다를 수 있어 여러 경로 시도
  const candidates = [
    raw?.output1?.[0]?.frgn_ntby_tr_pbmn,
    raw?.output1?.[0]?.frgn_ntby_qty,
    raw?.output?.[0]?.frgn_ntby_tr_pbmn,
    raw?.output?.[0]?.frgn_ntby_qty,
    raw?.output2?.[0]?.frgn_ntby_tr_pbmn,
    raw?.output2?.frgn_ntby_tr_pbmn,
    raw?.output?.frgn_ntby_tr_pbmn,
  ]
  for (const c of candidates) {
    if (c != null && c !== '') {
      const n = parseFloat(String(c))
      if (!isNaN(n)) return n
    }
  }
  return null
}

/** 억원 단위 포맷 (예: +2,340억) */
function formatNetBuy(value: number): string {
  const eok = Math.round(value / 1e8)   // 원 → 억
  return (eok >= 0 ? '+' : '') + eok.toLocaleString('ko-KR') + '억'
}
