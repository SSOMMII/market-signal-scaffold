import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

/**
 * market_master에서 ETF/STOCK 목록을 동적으로 로드
 * symbol → name 맵 반환
 */
async function loadMetaFromDB(marketType: 'KR' | 'US'): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('market_master')
    .select('symbol, name')
    .eq('market_type', marketType)
    .in('asset_type', ['ETF', 'STOCK'])

  if (error || !data?.length) {
    console.error(`[WARN] market_master 로드 실패 (${marketType}):`, error)
    // fallback: 최소 하드코딩 목록
    if (marketType === 'KR') {
      return {
        '069500.KS': 'KODEX 200', '229200.KS': 'KODEX KOSDAQ150',
        '360750.KS': 'TIGER 미국S&P500', '305720.KS': 'KODEX 반도체',
        '005930.KS': '삼성전자', '000660.KS': 'SK하이닉스',
      }
    }
    return {
      'QQQ': 'Invesco QQQ Trust', 'SPY': 'SPDR S&P 500 ETF',
      'SOXL': 'Direxion Semi Bull 3X', 'TQQQ': 'ProShares UltraPro QQQ',
      'IWM': 'iShares Russell 2000', 'GLD': 'SPDR Gold Shares', 'TLT': 'iShares 20Y Treasury',
    }
  }

  return Object.fromEntries(data.map(r => [r.symbol, r.name]))
}

// 하이브리드 가중치
const TECH_WEIGHT = 0.4
const AI_WEIGHT   = 0.6

// Confidence threshold (LightGBM 신뢰도)
const CONFIDENCE_THRESHOLD_SELL = Number(process.env.LGBM_CONFIDENCE_THRESHOLD_SELL ?? '0.40')
const CONFIDENCE_THRESHOLD_BUY  = Number(process.env.LGBM_CONFIDENCE_THRESHOLD_BUY  ?? '0.60')

/**
 * 기술적 스코어 계산 — 범위: -4.5 ~ +4.5
 *
 * 지표별 배분 (합계 ±4.5):
 *   RSI(14)              ±1.50  — 4구간: 30/40/60/70 경계
 *   MACD 모멘텀          ±1.00  — 방향(±0.50) + 히스토그램 가속/감속(±0.50)
 *   SMA 이격도(50·120·200) ±1.00  — 이격률 연속값, cap: ±2%/±3%/±5%
 *   Stochastic K+D       ±0.75  — K ±0.50(4구간), D ±0.25(2구간)
 *   Bollinger %B         ±0.25  — 4구간: 0/15/85/100%
 *
 * @param row    최신 일봉 데이터
 * @param prev   전일 일봉 데이터 (MACD 모멘텀 계산용, 없으면 방향만 사용)
 */
function calcTechScore(row: Record<string, any>, prev?: Record<string, any> | null): number {
  let score = 0
  const {
    close, rsi, macd, signal_line,
    sma_50, sma_120, sma_200,
    stoch_k, stoch_d,
    bollinger_upper, bollinger_lower,
  } = row

  // ── RSI(14): ±1.5 — 4구간 ─────────────────────────────────────────
  if (rsi != null) {
    if      (rsi < 30) score += 1.50   // 강한 과매도
    else if (rsi < 40) score += 0.75   // 약한 과매도
    else if (rsi > 70) score -= 1.50   // 강한 과매수
    else if (rsi > 60) score -= 0.75   // 약한 과매수
    // 40~60: 중립 (0점)
  }

  // ── MACD 모멘텀: ±1.0 ────────────────────────────────────────────
  // · 방향(±0.5): MACD > Signal = 매수 방향
  // · 가속(±0.5): 히스토그램이 커지면 추세 강화, 작아지면 약화
  if (macd != null && signal_line != null) {
    const hist = macd - signal_line
    score += hist > 0 ? 0.50 : -0.50  // 방향

    if (prev?.macd != null && prev?.signal_line != null) {
      const prevHist = prev.macd - prev.signal_line
      // 같은 방향이고 히스토그램이 확대 중 → 추세 가속 (+0.5)
      // 같은 방향이지만 히스토그램이 축소 중 → 추세 약화 (+0.1)
      // 반대 방향 전환 직전 → 감속 신호 (-0.1 ~ -0.3)
      if (hist > 0) {
        score += hist > prevHist ? 0.50 : 0.10
      } else {
        score += hist < prevHist ? -0.50 : -0.10
      }
    }
  }

  // ── SMA 이격도: ±1.0 합계 ────────────────────────────────────────
  // 이격률(%) = (close - sma) / sma * 100
  // capPct 초과 시 max 점수로 고정 (레버리지 ETF 등 급등락 과적합 방지)
  const gapScore = (c: number, sma: number | null, weight: number, capPct: number) => {
    if (c == null || sma == null || sma === 0) return 0
    const gap = (c - sma) / sma * 100
    return Math.min(Math.max(gap / capPct, -1), 1) * weight
  }
  score += gapScore(close, sma_50,  0.40, 2)  // ±2% 이격 = 만점
  score += gapScore(close, sma_120, 0.30, 3)  // ±3% 이격 = 만점
  score += gapScore(close, sma_200, 0.30, 5)  // ±5% 이격 = 만점

  // ── Stochastic K+D: ±0.75 합계 ───────────────────────────────────
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

  // ── Bollinger %B: ±0.25 — 4구간 ──────────────────────────────────
  // %B = (close - lower) / (upper - lower)
  //   0 이하: 하단 이탈, 1 이상: 상단 이탈
  if (close != null && bollinger_upper != null && bollinger_lower != null) {
    const bw = bollinger_upper - bollinger_lower
    if (bw > 0) {
      const pctB = (close - bollinger_lower) / bw
      if      (pctB < 0.00) score += 0.25   // 하단 완전 이탈
      else if (pctB < 0.15) score += 0.13   // 하단 근접
      else if (pctB > 1.00) score -= 0.25   // 상단 완전 이탈
      else if (pctB > 0.85) score -= 0.13   // 상단 근접
    }
  }

  return Math.round(score * 100) / 100
}

/** 기술적 스코어(-4.5 ~ +4.5)를 0-100으로 정규화 */
function normalizeTechScore(score: number): number {
  return Math.round((score + 4.5) / 9.0 * 100)
}

/**
 * 하이브리드 스코어(0-100) → 액션 변환
 * AI 스코어 기준: 60 이상=매수, 40 이하=매도
 */
function hybridScoreToAction(hybridScore: number): '매수' | '매도' | '관망' {
  if (hybridScore >= 60) return '매수'
  if (hybridScore <= 40) return '매도'
  return '관망'
}

/**
 * Confidence 기반 액션 필터링
 * - 매수 신호: confidence < 0.60 → 신뢰도 부족, 관망으로 다운그레이드
 * - 매도 신호: confidence < 0.60 → 신뢰도 부족, 관망으로 다운그레이드
 * (두 경우 모두 대칭: 신뢰도 >= 0.60일 때만 강한 신호 유지)
 */
function applyConfidenceFilter(action: '매수' | '매도' | '관망', lgbm_prob: number | null): '매수' | '매도' | '관망' {
  if (lgbm_prob === null) return action  // AI 데이터 없으면 기존 액션 유지

  if (action === '매수' && lgbm_prob < CONFIDENCE_THRESHOLD_BUY) {
    return '관망'
  }
  if (action === '매도' && lgbm_prob < CONFIDENCE_THRESHOLD_SELL) {
    return '관망'
  }

  return action
}

/**
 * 하이브리드 스코어 + Confidence → 신호 강도 분류 (5분류)
 * - STRONG_BUY: score >= 75 + 높은 신뢰도 (또는 AI 신호 명확)
 * - BUY: score >= 60
 * - HOLD: 40 <= score < 60
 * - SELL: 20 <= score < 40
 * - STRONG_SELL: score < 20 + 높은 신뢰도
 */
function getSignalStrength(
  score: number,
  confidence: number | null,
  aiLabel: string | null
): '🚀 강한 매수' | '📈 매수' | '➡️ 관망' | '📉 매도' | '🔴 강한 매도' {
  // AI 신호가 명확하고 신뢰도가 높으면 강도 상향
  const hasHighConfidence = confidence !== null && confidence >= 0.60
  const hasAILabel = aiLabel && ['STRONG_BUY', 'STRONG_SELL'].includes(aiLabel)

  if (score >= 75 && (hasHighConfidence || hasAILabel)) {
    return '🚀 강한 매수'
  }
  if (score >= 60) {
    return '📈 매수'
  }
  if (score >= 40) {
    return '➡️ 관망'
  }
  if (score >= 20) {
    return '📉 매도'
  }
  if (hasHighConfidence || hasAILabel) {
    return '🔴 강한 매도'
  }
  return '📉 매도'
}

async function fetchSignals(meta: Record<string, string>) {
  const symbols = Object.keys(meta)

  // 1. market_master에서 id 조회
  const { data: masters, error: mErr } = await supabase
    .from('market_master')
    .select('id, symbol')
    .in('symbol', symbols)

  if (mErr) throw mErr
  if (!masters?.length) return []

  const idToSymbol: Record<number, string> = {}
  const ids: number[] = []
  for (const m of masters) {
    idToSymbol[m.id] = m.symbol
    ids.push(m.id)
  }

  // 2. 기술적 지표 조회 (최신 2행 per ticker)
  const { data: rows, error: rErr } = await supabase
    .from('daily_indicators')
    .select('market_master_id, as_of_date, close, rsi, macd, signal_line, sma_50, sma_120, sma_200, stoch_k, stoch_d, bollinger_upper, bollinger_lower')
    .in('market_master_id', ids)
    .order('as_of_date', { ascending: false })
    .limit(ids.length * 10)

  if (rErr) throw rErr

  // 3. AI 예측값 조회 (ticker별 calibration 방식별 최신 1행)
  // Calibration: Platt Scaling / ISO Regression / Beta Calibration
  const { data: aiRows, error: aiErr } = await supabase
    .from('ai_predictions')
    .select('ticker, date, signal_score, signal_label, lgbm_prob, breakdown, calibration_method')
    .in('ticker', symbols)
    .order('date', { ascending: false })
    .limit(symbols.length * 6)  // calibration 방식별 각각 조회

  if (aiErr) console.error('ai_predictions fetch error:', aiErr)

  // ticker별 calibration 방식별 최신 AI 예측 추출
  interface AIPredictor {
    signal_score: number
    signal_label: string
    lgbm_prob: number | null
    date: string
    calibration_method: string
  }
  
  const aiByTickerAndCalibration: Record<string, Record<string, AIPredictor>> = {}
  for (const ai of (aiRows ?? [])) {
    if (!aiByTickerAndCalibration[ai.ticker]) {
      aiByTickerAndCalibration[ai.ticker] = {}
    }
    // 각 calibration 방식별로 최신 1행만 유지
    const method = ai.calibration_method ?? 'platt'
    if (!aiByTickerAndCalibration[ai.ticker][method]) {
      aiByTickerAndCalibration[ai.ticker][method] = {
        signal_score: ai.signal_score,
        signal_label: ai.signal_label,
        lgbm_prob:    ai.lgbm_prob ?? null,
        date:         ai.date,
        calibration_method: method,
      }
    }
  }
  
  // 하위 호환성: aiByTicker에도 유지 (기본: Platt Scaling 사용)
  const aiByTicker: Record<string, AIPredictor> = {}
  for (const ticker in aiByTickerAndCalibration) {
    // 기본적으로 platt 사용, 없으면 iso, 그 다음 beta
    aiByTicker[ticker] = aiByTickerAndCalibration[ticker]['platt_scaling'] 
      || aiByTickerAndCalibration[ticker]['iso_regression'] 
      || aiByTickerAndCalibration[ticker]['beta_calibration']
      || Object.values(aiByTickerAndCalibration[ticker])[0]
  }

  // 4. ticker별 최신 2행 그룹화
  const grouped: Record<number, typeof rows> = {}
  for (const row of (rows ?? [])) {
    if (!grouped[row.market_master_id]) grouped[row.market_master_id] = []
    if (grouped[row.market_master_id].length < 2) grouped[row.market_master_id].push(row)
  }

  // 5. 하이브리드 스코어 계산 및 결과 조합 (A/B 테스트)
  const results = []
  for (const [idStr, pair] of Object.entries(grouped)) {
    const id     = Number(idStr)
    const symbol = idToSymbol[id]
    if (!symbol || !pair[0]) continue

    const latest    = pair[0]
    const prev      = pair[1]
    const techScore = calcTechScore(latest)
    const techNorm  = normalizeTechScore(techScore)

    // Calibration 방식별 예측 조회
    const aiMethods = aiByTickerAndCalibration[symbol] ?? {}
    const aiPlatt = aiMethods['platt_scaling']
    const aiIso = aiMethods['iso_regression']
    const aiBeta = aiMethods['beta_calibration']

    // 기본값: Platt Scaling 사용
    const ai = aiPlatt ?? aiIso ?? aiBeta
    
    let hybridScore: number
    let aiScore: number | null = null
    let aiLabel: string | null = null
    let confidence: number | null = null
    
    // Calibration별 정보
    let plattScore: number | null = null
    let plattLabel: string | null = null
    let plattConfidence: number | null = null
    
    let isoScore: number | null = null
    let isoLabel: string | null = null
    let isoConfidence: number | null = null
    
    let betaScore: number | null = null
    let betaLabel: string | null = null
    let betaConfidence: number | null = null

    if (aiPlatt) {
      plattScore      = aiPlatt.signal_score
      plattLabel      = aiPlatt.signal_label
      plattConfidence = aiPlatt.lgbm_prob
    }

    if (aiIso) {
      isoScore      = aiIso.signal_score
      isoLabel      = aiIso.signal_label
      isoConfidence = aiIso.lgbm_prob
    }

    if (aiBeta) {
      betaScore      = aiBeta.signal_score
      betaLabel      = aiBeta.signal_label
      betaConfidence = aiBeta.lgbm_prob
    }

    if (ai) {
      aiScore     = ai.signal_score
      aiLabel     = ai.signal_label
      confidence  = ai.lgbm_prob
      hybridScore = Math.round(TECH_WEIGHT * techNorm + AI_WEIGHT * ai.signal_score)
    } else {
      // AI 데이터 없으면 기술적 스코어만 사용
      hybridScore = techNorm
    }

    let action = hybridScoreToAction(hybridScore)
    // Confidence threshold 적용: 신뢰도가 낮으면 관망으로 다운그레이드
    action = applyConfidenceFilter(action, confidence)

    // 신호 강도 계산
    const signalStrength = getSignalStrength(hybridScore, confidence, aiLabel)

    let changePct = 0
    let changeStr = '-'
    if (prev?.close && latest.close) {
      changePct = (latest.close - prev.close) / prev.close * 100
      changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%'
    }

    // Calibration 별 응답 구조
    results.push({
      ticker:         symbol,
      name:           meta[symbol] ?? symbol,
      change:         changeStr,
      score:          hybridScore,
      techScore:      techNorm,
      aiScore,
      aiLabel,
      confidence,
      action,
      signalStrength,
      up:             changePct >= 0,
      hasAI:          !!ai,
      
      // Calibration 방식별 점수 (실험용)
      calibrations: {
        platt: plattScore !== null ? {
          score: plattScore,
          label: plattLabel,
          confidence: plattConfidence,
        } : null,
        iso: isoScore !== null ? {
          score: isoScore,
          label: isoLabel,
          confidence: isoConfidence,
        } : null,
        beta: betaScore !== null ? {
          score: betaScore,
          label: betaLabel,
          confidence: betaConfidence,
        } : null,
      },
    })
  }

  results.sort((a, b) => b.score - a.score)
  return results
}

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') ?? 'us'
    const meta = await loadMetaFromDB(market === 'kr' ? 'KR' : 'US')
    const data = await fetchSignals(meta)
    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
