/**
 * GET /api/cron/fred
 * FRED (Federal Reserve Economic Data) 거시경제 지표 수집
 *
 * 스케줄: 매일 01:00 UTC (미국 장 마감 후 데이터 갱신 시간대)
 * 저장:
 *   - DEXKOUS (USD/KRW 환율) → global_indicators.usd_krw (오늘 스냅샷 업데이트)
 *   - FEDFUNDS, DGS10, DGS2 → 응답에 포함 (macro_indicators 테이블 추후 확장 시 저장 예정)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

const FRED_SERIES = {
  DEXKOUS:  'USD/KRW 환율',
  FEDFUNDS: '미국 연방기준금리 (%)',
  DGS10:    '미국 10년 국채금리 (%)',
  DGS2:     '미국 2년 국채금리 (%)',
  T10Y2Y:   '장단기 금리차 (10Y-2Y, %)',
}

function verifyCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

async function fetchFredLatest(seriesId: string, apiKey: string): Promise<number | null> {
  const today = new Date().toISOString().split('T')[0]
  const past = new Date()
  past.setDate(past.getDate() - 10)
  const pastStr = past.toISOString().split('T')[0]

  const qs = new URLSearchParams({
    series_id: seriesId,
    observation_start: pastStr,
    observation_end: today,
    api_key: apiKey,
    file_type: 'json',
    sort_order: 'desc',
    limit: '1',
  })

  const res = await fetch(`${FRED_BASE}?${qs}`)
  if (!res.ok) throw new Error(`FRED API error ${res.status}: ${seriesId}`)

  const data = await res.json()
  const obs = data.observations?.[0]
  if (!obs || obs.value === '.') return null
  return parseFloat(obs.value)
}

export async function GET(req: NextRequest) {
  if (!verifyCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'FRED_API_KEY not set' },
      { status: 200 }
    )
  }

  const summary: Record<string, unknown> = {}

  // 1) 각 시리즈 최신값 수집
  for (const [seriesId, description] of Object.entries(FRED_SERIES)) {
    try {
      const value = await fetchFredLatest(seriesId, apiKey)
      summary[seriesId] = { value, description }
    } catch (err) {
      summary[seriesId] = { error: err instanceof Error ? err.message : 'error' }
    }
  }

  // 2) DEXKOUS → global_indicators.usd_krw 업데이트
  const dexkous = (summary.DEXKOUS as any)?.value
  if (dexkous != null) {
    try {
      const adminClient = getAdminClient()
      const { data: latest } = await adminClient
        .from('global_indicators')
        .select('id, as_of_timestamp')
        .order('as_of_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latest) {
        await adminClient
          .from('global_indicators')
          .update({ usd_krw: dexkous })
          .eq('id', latest.id)
        summary.usd_krw_updated = latest.as_of_timestamp
      }
    } catch (err) {
      summary.usd_krw_error = err instanceof Error ? err.message : 'error'
    }
  }

  return NextResponse.json({ ok: true, summary })
}
