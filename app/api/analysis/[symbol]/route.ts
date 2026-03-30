import { NextResponse } from 'next/server'
import { supabase, getDailyIndicatorsBySymbol } from '@/lib/supabaseClient'
import { getTodayFearGreed } from '@/lib/collectors/common/fearGreed'
import { getSymbolMentions } from '@/lib/collectors/us/apeWisdom'
import { getFinnhubBasicFinancials } from '@/lib/collectors/us/finnhub'

// ── Rule-based AI score from real technical indicators ────────────────────────
// RSI: 과매도(+) / 과매수(-), MACD: 골든크로스(+) / 데드크로스(-), SMA: 가격 위치
function calcAiScore(
  rsi: number | null,
  macd: number | null,
  signalLine: number | null,
  close: number | null,
  sma50: number | null
): number {
  let score = 0

  if (rsi !== null) {
    if (rsi < 30) score += 2.0
    else if (rsi < 45) score += 0.5
    else if (rsi > 70) score -= 2.0
    else if (rsi > 55) score -= 0.5
  }

  if (macd !== null && signalLine !== null) {
    score += macd > signalLine ? 1.5 : -1.5
  }

  if (close !== null && sma50 !== null && sma50 > 0) {
    score += close > sma50 ? 1.0 : -1.0
  }

  return Math.round(Math.max(-4.5, Math.min(4.5, score)) * 10) / 10
}

// 데이터 보유 항목 수에 따라 신뢰도 계산
function calcReliability(hasRsi: boolean, hasMacd: boolean, hasSma: boolean, dataPoints: number): number {
  let r = 45
  if (hasRsi) r += 15
  if (hasMacd) r += 15
  if (hasSma) r += 10
  if (dataPoints >= 5) r += 10
  return Math.min(95, r)
}

// 실제 지표값 기반 주요 이슈 텍스트 생성
function buildWeeklyIssues(
  rsi: number | null,
  macd: number | null,
  signalLine: number | null,
  close: number | null,
  sma50: number | null,
  name: string
): string[] {
  const issues: string[] = []

  if (rsi !== null) {
    if (rsi < 30) issues.push(`RSI ${Math.round(rsi)} → 과매도 구간 진입, 단기 반등 가능성`)
    else if (rsi > 70) issues.push(`RSI ${Math.round(rsi)} → 과매수 구간, 단기 조정 주의`)
    else if (rsi < 45) issues.push(`RSI ${Math.round(rsi)} → 약세 중립, 추가 하락 모니터링`)
    else if (rsi > 55) issues.push(`RSI ${Math.round(rsi)} → 강세 중립, 상승 모멘텀 유지`)
    else issues.push(`RSI ${Math.round(rsi)} → 완전 중립 구간`)
  }

  if (macd !== null && signalLine !== null) {
    const diff = macd - signalLine
    if (diff > 0) issues.push(`MACD 시그널 상회 (+${diff.toFixed(3)}) → 상승 모멘텀`)
    else issues.push(`MACD 시그널 하회 (${diff.toFixed(3)}) → 하락 압력 지속`)
  }

  if (close !== null && sma50 !== null && sma50 > 0) {
    const pct = ((close - sma50) / sma50 * 100).toFixed(1)
    if (close > sma50) issues.push(`현재가 SMA50 대비 +${pct}% 상회 → 중기 상승 추세`)
    else issues.push(`현재가 SMA50 대비 ${pct}% 하회 → 중기 하락 추세 주의`)
  }

  if (issues.length === 0) {
    issues.push(`${name} 기술 지표 데이터 수집 중입니다`)
  }

  return issues.slice(0, 3)
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase()

  try {
    // 1. market_master 조회
    const { data: masterRows, error: masterError } = await supabase
      .from('market_master')
      .select('id, symbol, name, market_type')
      .eq('symbol', symbol)
      .limit(1)

    if (masterError) throw masterError
    const master = masterRows?.[0] ?? null
    if (!master) {
      return NextResponse.json({ error: 'Symbol not found' }, { status: 404 })
    }

    // 2. 최근 기술 지표 (최대 5일)
    const indicators = await getDailyIndicatorsBySymbol(symbol, 5)
    const latest = indicators[0] ?? null

    const rsi        = latest?.rsi         != null ? Number(latest.rsi)         : null
    const macd       = latest?.macd        != null ? Number(latest.macd)        : null
    const signalLine = latest?.signal_line != null ? Number(latest.signal_line) : null
    const close      = latest?.close       != null ? Number(latest.close)       : null
    const sma50      = latest?.sma_50      != null ? Number(latest.sma_50)      : null

    // 3. Fear & Greed (시장 전체, Alternative.me 무료)
    let fearGreed = 50
    try {
      const fg = await getTodayFearGreed()
      fearGreed = parseInt(fg.value, 10)
    } catch {
      // 네트워크 오류 시 50(중립)으로 폴백
    }

    // 4. Reddit 언급량 (미국 종목만, ApeWisdom 무료)
    let redditMentions = 0
    if (master.market_type === 'US') {
      try {
        const ape = await getSymbolMentions(symbol)
        redditMentions = ape.results?.[0]?.mentions ?? 0
      } catch {
        // 데이터 없음
      }
    }

    // 4-b. 재무지표 (미국 종목: Finnhub / 한국 종목: fundamental_data 기반 계산)
    type Fundamentals = {
      per: number | null
      pbr: number | null
      roe: number | null
      eps: number | null
      revenueGrowth: number | null
      debtRatio: number | null
      dividendYield: number | null
    }
    let fundamentals: Fundamentals = {
      per: null, pbr: null, roe: null, eps: null,
      revenueGrowth: null, debtRatio: null, dividendYield: null,
    }
    if (master.market_type === 'US') {
      try {
        const fin = await getFinnhubBasicFinancials(symbol)
        const m = fin.metric ?? {}
        fundamentals = {
          per:           m.peBasicExclExtraTTM       ?? null,
          pbr:           m.pbAnnual                  ?? null,
          roe:           m.roeRfy                    ?? null,
          eps:           m.epsNormalizedAnnual        ?? null,
          revenueGrowth: m.revenueGrowthTTMYoy       ?? null,
          debtRatio:     m.totalDebt_totalEquityAnnual ?? null,
          dividendYield: m.dividendYieldIndicatedAnnual ?? null,
        }
      } catch {
        // Finnhub 실패 시 null 유지
      }
    } else if (master.market_type === 'KR') {
      try {
        // fundamental_data에서 최근 데이터 조회
        const { data: fundRows } = await supabase
          .from('fundamental_data')
          .select('*')
          .eq('symbol', symbol)
          .order('year', { ascending: false })
          .order('quarter', { ascending: false })
          .limit(1)

        if (fundRows && fundRows.length > 0) {
          const fund = fundRows[0]
          const currentPrice = close  // daily_indicators에서 가져온 현재가

          fundamentals.eps = fund.eps ? Number(fund.eps) : null

          // PER = 현재가 / EPS
          if (currentPrice && fund.eps && fund.eps > 0) {
            fundamentals.per = currentPrice / fund.eps
          }

          // PBR = 현재가 / BPS (BPS = 자본총계 / 발행주식수)
          // 발행주식수 정보가 없으므로 BPS 계산 생략

          // ROE = 당기순이익 / 자본총계
          if (fund.net_income && fund.total_equity && fund.total_equity > 0) {
            fundamentals.roe = (fund.net_income / fund.total_equity) * 100
          }

          // 부채비율 = 총부채 / 자본총계
          if (fund.total_assets && fund.total_equity && fund.total_equity > 0) {
            const totalDebt = fund.total_assets - fund.total_equity
            fundamentals.debtRatio = (totalDebt / fund.total_equity) * 100
          }
        }
      } catch {
        // fundamental_data 조회 실패 시 null 유지
      }
    }

    // 5. ai_predictions에서 summary_text + lgbm 신호 조회
    let summaryText: string | null = null
    let lgbmSignal: string | null = null
    let lgbmScore: number | null = null
    try {
      const { data: predRows } = await supabase
        .from('ai_predictions')
        .select('summary_text, signal_label, signal_score')
        .eq('ticker', symbol)
        .order('date', { ascending: false })
        .limit(1)
      if (predRows && predRows.length > 0) {
        summaryText = predRows[0].summary_text ?? null
        lgbmSignal  = predRows[0].signal_label ?? null
        lgbmScore   = predRows[0].signal_score ?? null
      }
    } catch {
      // ai_predictions 없어도 계속 진행
    }

    // 6. AI Score 계산
    const aiScore    = calcAiScore(rsi, macd, signalLine, close, sma50)
    const signal     = aiScore >= 1.5 ? '매수' : aiScore <= -1.5 ? '매도' : '관망'
    const reliability = calcReliability(
      rsi !== null,
      macd !== null,
      sma50 !== null,
      indicators.length
    )

    const technicals = [
      {
        label: 'RSI (14)',
        value: rsi !== null ? String(Math.round(rsi)) : 'N/A',
        badge: rsi === null ? '데이터없음' : rsi >= 70 ? '과매수' : rsi <= 30 ? '과매도' : '중립',
        up: rsi === null ? null : rsi <= 30 ? true : rsi >= 70 ? false : null,
      },
      {
        label: 'MACD',
        value: macd !== null && signalLine !== null
          ? (macd - signalLine >= 0
              ? `+${(macd - signalLine).toFixed(2)}`
              : (macd - signalLine).toFixed(2))
          : 'N/A',
        badge: macd === null || signalLine === null ? '데이터없음' : macd > signalLine ? '매수' : '매도',
        up: macd === null || signalLine === null ? null : macd > signalLine,
      },
      {
        label: 'SMA 50',
        value: close !== null && sma50 !== null ? (close > sma50 ? '상회' : '하회') : 'N/A',
        badge: close === null || sma50 === null ? '데이터없음' : close > sma50 ? '상승' : '하락',
        up: close === null || sma50 === null ? null : close > sma50,
      },
    ]

    return NextResponse.json({
      symbol: master.symbol,
      name: master.name,
      market: master.market_type,
      aiScore,
      signal,
      reliability,
      fearGreed,
      redditMentions,
      weeklyIssues: buildWeeklyIssues(rsi, macd, signalLine, close, sma50, master.name),
      technicals,
      summaryText,
      lgbmSignal,
      lgbmScore,
      fundamentals,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message
      : typeof err === 'object' && err !== null && 'message' in err ? String((err as Record<string, unknown>).message)
      : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
