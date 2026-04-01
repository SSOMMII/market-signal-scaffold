import { NextRequest, NextResponse } from 'next/server'
import { supabase, getDailyIndicatorsBySymbol } from '@/lib/supabaseClient'

// ── 기술적 스코어 (signals/route.ts 와 동일 로직) ────────────────────
const TECH_WEIGHT = 0.4
const AI_WEIGHT   = 0.6

function calcTechScore(row: Record<string, any>): number {
  let score = 0
  const { close, rsi, macd, signal_line, sma_50, sma_120, sma_200, stoch_k, stoch_d, bollinger_upper, bollinger_lower } = row

  if (rsi != null) {
    if      (rsi < 30) score += 1.50
    else if (rsi < 40) score += 0.75
    else if (rsi > 70) score -= 1.50
    else if (rsi > 60) score -= 0.75
  }
  if (macd != null && signal_line != null) {
    const hist = macd - signal_line
    score += hist > 0 ? 0.50 : -0.50
  }
  const gapScore = (c: number, sma: number | null, weight: number, capPct: number) => {
    if (c == null || sma == null || sma === 0) return 0
    const gap = (c - sma) / sma * 100
    return Math.min(Math.max(gap / capPct, -1), 1) * weight
  }
  score += gapScore(close, sma_50,  0.40, 2)
  score += gapScore(close, sma_120, 0.30, 3)
  score += gapScore(close, sma_200, 0.30, 5)
  if (stoch_k != null) {
    if      (stoch_k < 20) score += 0.50
    else if (stoch_k < 40) score += 0.25
    else if (stoch_k > 80) score -= 0.50
    else if (stoch_k > 60) score -= 0.25
  }
  if (stoch_d != null) {
    if      (stoch_d < 20) score += 0.25
    else if (stoch_d > 80) score -= 0.25
  }
  if (close != null && bollinger_upper != null && bollinger_lower != null) {
    const bw = bollinger_upper - bollinger_lower
    if (bw > 0) {
      const pctB = (close - bollinger_lower) / bw
      if      (pctB < 0.00) score += 0.25
      else if (pctB < 0.15) score += 0.13
      else if (pctB > 1.00) score -= 0.25
      else if (pctB > 0.85) score -= 0.13
    }
  }
  return Math.round(score * 100) / 100
}

function normalizeTechScore(score: number): number {
  return Math.round((score + 4.5) / 9.0 * 100)
}

/** hybridScore(0-100) → 표시용 스코어(-4.0 ~ +4.0) */
function toDisplayScore(hybridScore: number): number {
  return Math.round((hybridScore - 50) / 12.5 * 10) / 10
}

function fmtPct(curr: number | null, prev: number | null): string {
  if (!curr || !prev || prev === 0) return '-'
  const chg = (curr - prev) / prev * 100
  return (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'
}

// ── 대표 지수 기술 지표 상세 빌더 ────────────────────────────────────
function buildIndicatorDetail(row: Record<string, any>) {
  const detail: {
    label: string; value: number; max: number
    badge: string; cls: string; desc: string; color: string
  }[] = []

  const { close, rsi, macd, signal_line, stoch_k, bollinger_upper, bollinger_lower } = row

  // RSI (14)
  if (rsi != null) {
    const r = Number(rsi)
    const badge = r >= 70 ? '과매수' : r <= 30 ? '과매도' : r >= 60 ? '주의' : '중립'
    const cls   = r >= 70 ? 'badge-sell' : r <= 30 ? 'badge-buy' : 'badge-hold'
    const color = r >= 70 ? 'bg-red-400' : r <= 30 ? 'bg-emerald-500' : 'bg-amber-400'
    const desc  = r >= 70
      ? `RSI ${r.toFixed(1)} — 과매수 구간. 단기 조정 주의.`
      : r <= 30
      ? `RSI ${r.toFixed(1)} — 과매도 구간 진입, 단기 반등 가능성.`
      : `RSI ${r.toFixed(1)} — 중립 구간(30~70). 과매수/과매도 신호 없음.`
    detail.push({ label: 'RSI (14)', value: Math.round(r * 10) / 10, max: 100, badge, cls, desc, color })
  }

  // MACD (방향 기반 0-30 정규화)
  if (macd != null && signal_line != null) {
    const hist   = Number(macd) - Number(signal_line)
    const isBull = hist >= 0
    // 진행 막대: 강세 면 상단부, 약세 면 하단부
    const value  = isBull ? 20 : 10
    const badge  = isBull ? '매수' : '매도'
    const cls    = isBull ? 'badge-up' : 'badge-sell'
    const color  = isBull ? 'bg-emerald-500' : 'bg-red-400'
    const histStr = (hist >= 0 ? '+' : '') + hist.toFixed(3)
    const desc   = isBull
      ? `MACD 선이 시그널선 위에 위치 (골든크로스). 단기 상승 모멘텀. 히스토그램 ${histStr}`
      : `MACD 선이 시그널선 아래 위치 (데드크로스). 하락 압력 지속. 히스토그램 ${histStr}`
    detail.push({ label: 'MACD', value, max: 30, badge, cls, desc, color })
  }

  // 스토캐스틱 %K
  if (stoch_k != null) {
    const k     = Number(stoch_k)
    const badge = k >= 80 ? '과매수' : k <= 20 ? '과매도' : k >= 60 ? '주의' : '중립'
    const cls   = k >= 80 ? 'badge-sell' : k <= 20 ? 'badge-buy' : 'badge-hold'
    const color = k >= 80 ? 'bg-red-400' : k <= 20 ? 'bg-emerald-500' : 'bg-amber-400'
    const desc  = k >= 80
      ? `스토캐스틱 %K ${k.toFixed(1)} — 과매수 구간 진입. 단기 조정 신호 감시 필요.`
      : k <= 20
      ? `스토캐스틱 %K ${k.toFixed(1)} — 과매도 구간. 반등 가능성.`
      : `스토캐스틱 %K ${k.toFixed(1)} — 중립 구간.`
    detail.push({ label: '스토캐스틱', value: Math.round(k * 10) / 10, max: 100, badge, cls, desc, color })
  }

  // 볼린저밴드 %B (0-100)
  if (close != null && bollinger_upper != null && bollinger_lower != null) {
    const bw = Number(bollinger_upper) - Number(bollinger_lower)
    if (bw > 0) {
      const pctB        = (Number(close) - Number(bollinger_lower)) / bw * 100
      const pctBClamped = Math.max(0, Math.min(100, Math.round(pctB)))
      const badge  = pctB >= 100 ? '강세' : pctB <= 0 ? '과매도' : pctB >= 85 ? '주의' : pctB <= 15 ? '저점' : '중립'
      const cls    = pctB >= 85 ? 'badge-sell' : pctB <= 15 ? 'badge-buy' : 'badge-hold'
      const color  = pctB >= 85 ? 'bg-red-400' : pctB <= 15 ? 'bg-emerald-500' : 'bg-amber-400'
      const desc   = pctB >= 100
        ? '가격이 상단 밴드 완전 이탈. 강한 상승 추세. 밴드 확장 중.'
        : pctB <= 0
        ? '가격이 하단 밴드 완전 이탈. 강한 하락 추세.'
        : pctB >= 85
        ? `%B ${pctB.toFixed(0)}% — 상단 밴드 근처. 과매수 구간 진입 임박.`
        : pctB <= 15
        ? `%B ${pctB.toFixed(0)}% — 하단 밴드 근처. 반등 가능성.`
        : '가격이 밴드 중단부 근처. 변동성 수렴 중. 방향성 돌파 대기.'
      detail.push({ label: '볼린저밴드', value: pctBClamped, max: 100, badge, cls, desc, color })
    }
  }

  return detail
}

// ── Route Handler ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const market   = req.nextUrl.searchParams.get('market') ?? 'kr'
    const isKr     = market === 'kr'
    const marketType = isKr ? 'KR' : 'US'

    // 1. ETF/STOCK 목록
    const { data: masters, error: mErr } = await supabase
      .from('market_master')
      .select('id, symbol, name, sector')
      .eq('market_type', marketType)
      .in('asset_type', ['ETF', 'STOCK'])

    if (mErr) throw mErr
    if (!masters?.length) {
      return NextResponse.json({ error: 'market_master 없음' }, { status: 500 })
    }

    const ids       = masters.map(m => m.id)
    const symbols   = masters.map(m => m.symbol)
    const idToMeta: Record<number, { symbol: string; name: string; sector: string | null }> = {}
    for (const m of masters) idToMeta[m.id] = { symbol: m.symbol, name: m.name, sector: m.sector ?? null }

    // 2. 기술 지표 (ticker별 최신 2행)
    const { data: diRows } = await supabase
      .from('daily_indicators')
      .select('market_master_id, as_of_date, close, volume, rsi, macd, signal_line, sma_50, sma_120, sma_200, stoch_k, stoch_d, bollinger_upper, bollinger_lower')
      .in('market_master_id', ids)
      .order('as_of_date', { ascending: false })
      .limit(ids.length * 2)

    const grouped: Record<number, any[]> = {}
    for (const row of (diRows ?? [])) {
      if (!grouped[row.market_master_id]) grouped[row.market_master_id] = []
      if (grouped[row.market_master_id].length < 2) grouped[row.market_master_id].push(row)
    }

    // 3. AI 예측 (ticker별 최신 1행)
    const { data: aiRows } = await supabase
      .from('ai_predictions')
      .select('ticker, signal_score, signal_label, lgbm_prob')
      .in('ticker', symbols)
      .order('date', { ascending: false })
      .limit(symbols.length * 3)

    const aiByTicker: Record<string, { signal_score: number; signal_label: string; lgbm_prob: number | null }> = {}
    for (const ai of (aiRows ?? [])) {
      if (!aiByTicker[ai.ticker]) {
        aiByTicker[ai.ticker] = {
          signal_score: ai.signal_score,
          signal_label: ai.signal_label,
          lgbm_prob:    ai.lgbm_prob ?? null,
        }
      }
    }

    // 4. ETF 시그널 목록 구성
    const etfDetailList: {
      ticker: string; name: string; price: string; change: string
      volume: string; signal: string; score: number; up: boolean
    }[] = []

    for (const [idStr, pair] of Object.entries(grouped)) {
      const id   = Number(idStr)
      const meta = idToMeta[id]
      if (!meta || !pair[0]) continue

      const latest    = pair[0]
      const prev      = pair[1]
      const techScore = calcTechScore(latest)
      const techNorm  = normalizeTechScore(techScore)
      const ai        = aiByTicker[meta.symbol]

      const hybridScore = ai
        ? Math.round(TECH_WEIGHT * techNorm + AI_WEIGHT * ai.signal_score)
        : techNorm

      const action: '매수' | '매도' | '관망' =
        hybridScore >= 60 ? '매수' : hybridScore <= 40 ? '매도' : '관망'

      let changePct = 0
      let changeStr = '-'
      if (prev?.close && latest.close) {
        changePct = (latest.close - prev.close) / prev.close * 100
        changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%'
      }

      const priceStr = isKr
        ? Math.round(latest.close ?? 0).toLocaleString('ko-KR')
        : `$${(latest.close ?? 0).toFixed(2)}`

      const vol = latest.volume
      const volumeStr = vol == null ? '-'
        : vol >= 1_000_000 ? (vol / 1_000_000).toFixed(1) + 'M'
        : vol >= 1_000     ? Math.round(vol / 1_000) + 'K'
        : String(Math.round(vol))

      etfDetailList.push({
        ticker:    meta.symbol.replace(/\.(KS|KQ)$/, ''),
        name:      meta.name,
        price:     priceStr,
        change:    changeStr,
        volume:    volumeStr,
        signal:    action,
        score:     toDisplayScore(hybridScore),
        up:        changePct >= 0,
      })
    }
    etfDetailList.sort((a, b) => b.score - a.score)

    // 4-b. 섹터별 집계 (signal_score 평균, 변동률 평균)
    const sectorAccum: Record<string, { scoreSum: number; changeSum: number; count: number }> = {}
    for (const [idStr, pair] of Object.entries(grouped)) {
      const id   = Number(idStr)
      const meta = idToMeta[id]
      if (!meta?.sector || !pair[0]) continue
      const latest  = pair[0]
      const prev    = pair[1]
      const ai      = aiByTicker[meta.symbol]
      const techScore = calcTechScore(latest)
      const techNorm  = normalizeTechScore(techScore)
      const hybridScore = ai
        ? Math.round(TECH_WEIGHT * techNorm + AI_WEIGHT * ai.signal_score)
        : techNorm
      let changePct = 0
      if (prev?.close && latest.close && prev.close !== 0) {
        changePct = (latest.close - prev.close) / prev.close * 100
      }
      const sec = meta.sector
      if (!sectorAccum[sec]) sectorAccum[sec] = { scoreSum: 0, changeSum: 0, count: 0 }
      sectorAccum[sec].scoreSum  += hybridScore
      sectorAccum[sec].changeSum += changePct
      sectorAccum[sec].count     += 1
    }
    const sectorData = Object.entries(sectorAccum)
      .map(([name, { scoreSum, changeSum, count }]) => {
        const score     = Math.round(scoreSum / count)
        const changePct = changeSum / count
        const changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%'
        return { name, score, change: changeStr, up: changePct >= 0 }
      })
      .sort((a, b) => b.score - a.score)

    // 5. 대표 지수 기술 지표 상세
    const repTicker = isKr ? '^KS11' : '^GSPC'
    const repRows   = await getDailyIndicatorsBySymbol(repTicker, 1)
    const indicatorDetail = repRows[0] ? buildIndicatorDetail(repRows[0]) : []

    // 6. 배너 통계 & 예측 수치
    let predictionPct   = 50
    let predictionTitle = ''
    let predictionSub   = ''
    let stats: { label: string; value: string }[] = []

    // 매수 비율로 예측 확률 계산
    if (etfDetailList.length > 0) {
      const bullCount  = etfDetailList.filter(e => e.signal === '매수').length
      predictionPct    = Math.round((bullCount / etfDetailList.length) * 100)
    }

    if (isKr) {
      const [ffResult, krwRows, nasdaqRows] = await Promise.all([
        supabase.from('foreign_flow')
          .select('net_buy')
          .eq('market', 'KRX')
          .order('as_of_date', { ascending: false })
          .limit(1),
        getDailyIndicatorsBySymbol('USDKRW=X', 1),
        getDailyIndicatorsBySymbol('^IXIC', 2),
      ])

      const ff    = ffResult.data?.[0]
      const usdKrw = krwRows[0]?.close

      let ffStr  = '-'
      let krwStr = '-'
      let ndxStr = '-'

      if (ff) {
        const eok = Math.round(ff.net_buy / 1e8)
        ffStr = (eok >= 0 ? '+' : '') + eok.toLocaleString('ko-KR') + '억'
      }
      if (usdKrw) {
        krwStr = Math.round(usdKrw).toLocaleString('ko-KR') + '원'
      }
      if (nasdaqRows[0]?.close && nasdaqRows[1]?.close) {
        ndxStr = fmtPct(nasdaqRows[0].close, nasdaqRows[1].close)
      }

      stats = [
        { label: '코스피 외인',  value: ffStr  },
        { label: '환율',          value: krwStr },
        { label: '나스닥 선물',   value: ndxStr },
      ]
      predictionTitle = `나스닥 상승 확률 ${predictionPct}%`
      predictionSub   = `코스피 외국인 순매수 ${ffStr} 유입. AI 하이브리드 시그널 기반 예측.\n환율 ${krwStr}, 나스닥 ${ndxStr} 기준으로 시장 환경을 분석했습니다.`
    } else {
      const [gspcRows, ixicRows] = await Promise.all([
        getDailyIndicatorsBySymbol('^GSPC', 2),
        getDailyIndicatorsBySymbol('^IXIC', 2),
      ])

      const spStr  = fmtPct(gspcRows[0]?.close ?? null, gspcRows[1]?.close ?? null)
      const ndxStr = fmtPct(ixicRows[0]?.close ?? null, ixicRows[1]?.close ?? null)

      stats = [
        { label: 'S&P 500', value: spStr  },
        { label: 'NASDAQ',  value: ndxStr },
      ]
      predictionTitle = `코스피 상승 확률 ${predictionPct}%`
      predictionSub   = `S&P 500 ${spStr}, 나스닥 ${ndxStr} 기준 AI 시그널 분석.\n기술주 및 글로벌 지수 흐름을 반영한 예측입니다.`
    }

    return NextResponse.json({
      data: {
        predictionTitle,
        predictionPct,
        predictionSub,
        stats,
        etfDetailList,
        indicatorDetail,
        sectorData,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
