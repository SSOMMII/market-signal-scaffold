import { NextResponse } from 'next/server'
import { getLatestGlobalIndicatorsHistory, getDailyIndicatorsBySymbol } from '@/lib/supabaseClient'

function pctChange(curr: number | null, prev: number | null) {
  if (!curr || !prev) return null
  return ((curr - prev) / prev) * 100
}

export async function GET() {
  try {
    // 현재 절대값: global_indicators 최신 스냅샷
    const snapRows = await getLatestGlobalIndicatorsHistory(1)
    const snap = snapRows[0]
    if (!snap) return NextResponse.json({ data: null })

    // 일별 등락률: daily_indicators 30일치에서 최근 2일 종가 추출
    const [gspc, ixic, vixRows, cl, gc, krw] = await Promise.all([
      getDailyIndicatorsBySymbol('^GSPC',    2),
      getDailyIndicatorsBySymbol('^IXIC',    2),
      getDailyIndicatorsBySymbol('^VIX',     2),
      getDailyIndicatorsBySymbol('CL=F',     2),
      getDailyIndicatorsBySymbol('GC=F',     2),
      getDailyIndicatorsBySymbol('USDKRW=X', 2),
    ])

    const chg = (rows: { close: number | null }[]) =>
      pctChange(rows[0]?.close ?? null, rows[1]?.close ?? null)

    return NextResponse.json({
      data: {
        sp500:   { value: snap.sp500,   change: chg(gspc)    },
        nasdaq:  { value: snap.nasdaq,  change: chg(ixic)    },
        vix:     { value: snap.vix,     change: chg(vixRows) },
        wti:     { value: snap.wti,     change: chg(cl)      },
        gold:    { value: snap.gold,    change: chg(gc)      },
        usd_krw: { value: snap.usd_krw, change: chg(krw)     },
        as_of:   snap.as_of_timestamp,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
