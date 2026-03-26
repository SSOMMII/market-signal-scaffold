/**
 * GET /api/cron/ecos  [Phase 3 — ECOS_API_KEY 발급 후 활성화]
 * 한국은행 거시경제 지표 수집 → global_indicators(환율) 업데이트
 *
 * 스케줄: 평일 07:30 UTC (한국시간 16:30)
 * 저장:
 *   - 원달러 환율 → global_indicators.usd_krw (오늘 스냅샷 업데이트)
 *   - 기준금리, CPI → 콘솔 로그 (macro_indicators 테이블 미구현 — 추후 확장)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getKrExchangeRate, getKrBaseRate, getKrCpi } from '@/lib/collectors/kr/ecos'
import { getAdminClient } from '@/lib/supabaseAdmin'

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function todayKST(): { yyyymmdd: string; yyyymm: string } {
  // UTC+9 기준 오늘 날짜
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const iso = kst.toISOString()
  const yyyymmdd = iso.slice(0, 10).replace(/-/g, '')
  const yyyymm = yyyymmdd.slice(0, 6)
  return { yyyymmdd, yyyymm }
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ECOS_API_KEY) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'ECOS_API_KEY not set — Phase 3 미활성' },
      { status: 200 }
    )
  }

  const { yyyymmdd, yyyymm } = todayKST()
  const adminClient = getAdminClient()
  const summary: Record<string, unknown> = {}

  // 1) 원달러 환율 → global_indicators 업데이트
  try {
    const fxRows = await getKrExchangeRate(yyyymmdd, yyyymmdd)
    if (fxRows.length > 0) {
      const usdKrw = parseFloat(fxRows[0].DATA_VALUE)
      summary.usd_krw = usdKrw

      // 기존 최신 스냅샷에 usd_krw 덮어쓰기
      const { data: latest } = await adminClient
        .from('global_indicators')
        .select('id, as_of_timestamp')
        .order('as_of_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest) {
        await adminClient
          .from('global_indicators')
          .update({ usd_krw: usdKrw })
          .eq('id', latest.id)
        summary.usd_krw_updated = latest.as_of_timestamp
      }
    }
  } catch (err) {
    summary.usd_krw_error = err instanceof Error ? err.message : 'error'
  }

  // 2) 기준금리 (오늘 포함 최근 3일 — 발표일 기준으로 조회)
  try {
    const past3 = new Date(Date.now() + 9 * 60 * 60 * 1000)
    past3.setDate(past3.getDate() - 3)
    const past3str = past3.toISOString().slice(0, 10).replace(/-/g, '')
    const rateRows = await getKrBaseRate(past3str, yyyymmdd)
    const latest = rateRows[rateRows.length - 1]
    if (latest) {
      summary.base_rate = { value: latest.DATA_VALUE, time: latest.TIME }
    }
  } catch (err) {
    summary.base_rate_error = err instanceof Error ? err.message : 'error'
  }

  // 3) CPI (이번 달 + 전달)
  try {
    const prevMonth = new Date(Date.now() + 9 * 60 * 60 * 1000)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevYm = prevMonth.toISOString().slice(0, 7).replace(/-/g, '')
    const cpiRows = await getKrCpi(prevYm, yyyymm)
    const latest = cpiRows[cpiRows.length - 1]
    if (latest) {
      summary.cpi = { value: latest.DATA_VALUE, time: latest.TIME }
    }
  } catch (err) {
    summary.cpi_error = err instanceof Error ? err.message : 'error'
  }

  return NextResponse.json({ ok: true, date: yyyymmdd, summary })
}
