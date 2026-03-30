/**
 * GET /api/cron/update-returns
 * signal_history.actual_return 자동 업데이트
 *
 * 동작 원리:
 *   - 예측일(as_of_date)로부터 5거래일 후 close 가격을 daily_indicators에서 조회
 *   - actual_return = (T+5 close - T close) / T close * 100 (%)
 *   - actual_return이 null인 signal_history 행만 대상
 *
 * 스케줄: 매일 장 마감 후 (KST 16:30 = UTC 07:30)
 *   vercel.json: { "path": "/api/cron/update-returns", "schedule": "30 7 * * 1-5" }
 */

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'

// 5거래일(캘린더 약 7일) 후 날짜 계산 — 실제 거래일 보장은 DB 데이터에 위임
function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const updated: string[] = []
  const skipped: string[] = []

  // actual_return이 아직 없는 예측 이력 조회
  const { data: pending, error: fetchErr } = await supabase
    .from('signal_history')
    .select('etf_code, as_of_date, predicted_score')
    .is('actual_return', null)
    .order('as_of_date', { ascending: true })
    .limit(200)

  if (fetchErr) {
    console.error('[update-returns] signal_history 조회 오류:', fetchErr)
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }

  for (const row of pending ?? []) {
    const predDate   = row.as_of_date as string
    const targetDate = addCalendarDays(predDate, 7) // ~5거래일

    // 예측 당일 close
    const { data: predDay } = await supabase
      .from('daily_indicators')
      .select('close')
      .eq('as_of_date', predDate)
      .in(
        'market_master_id',
        supabase
          .from('market_master')
          .select('id')
          .eq('symbol', row.etf_code)
      )
      .maybeSingle()

    // T+7캘린더 이내 가장 가까운 거래일 close (데이터가 있는 최신일)
    const { data: targetDay } = await supabase
      .from('daily_indicators')
      .select('close, as_of_date')
      .gte('as_of_date', addCalendarDays(predDate, 5))
      .lte('as_of_date', targetDate)
      .in(
        'market_master_id',
        supabase
          .from('market_master')
          .select('id')
          .eq('symbol', row.etf_code)
      )
      .order('as_of_date', { ascending: false })
      .maybeSingle()

    if (!predDay?.close || !targetDay?.close) {
      skipped.push(`${row.etf_code}@${predDate} (데이터 미확보)`)
      continue
    }

    const actualReturn = ((targetDay.close - predDay.close) / predDay.close) * 100

    const { error: updateErr } = await supabase
      .from('signal_history')
      .update({ actual_return: Math.round(actualReturn * 10000) / 10000 })
      .eq('etf_code', row.etf_code)
      .eq('as_of_date', predDate)

    if (updateErr) {
      skipped.push(`${row.etf_code}@${predDate} (업데이트 실패: ${updateErr.message})`)
    } else {
      updated.push(`${row.etf_code}@${predDate} → ${actualReturn.toFixed(2)}%`)
    }
  }

  console.log(`[update-returns] 완료: ${updated.length}건 업데이트, ${skipped.length}건 스킵`)
  return NextResponse.json({ updated, skipped })
}
