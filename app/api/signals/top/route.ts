import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// 미국 ETF
const US_ETF_META: Record<string, string> = {
  'QQQ':  'Invesco QQQ Trust',
  'SPY':  'SPDR S&P 500 ETF',
  'SOXL': 'Direxion Semi Bull 3X',
  'TQQQ': 'ProShares UltraPro QQQ',
  'IWM':  'iShares Russell 2000',
  'GLD':  'SPDR Gold Shares',
  'TLT':  'iShares 20Y Treasury',
}

// 국내 ETF (KODEX/TIGER 대표 ETF)
const KR_ETF_META: Record<string, string> = {
  '069500.KS': 'KODEX 200',
  '229200.KS': 'KODEX KOSDAQ150',
  '360750.KS': 'TIGER 미국 S&P500',
  '305720.KS': 'KODEX 반도체',
  '114800.KS': 'TIGER 200선물인버스2X',
}

// 국내 주식 (KIS API 수집 대상)
const KR_STOCK_META: Record<string, string> = {
  '005930': '삼성전자',
  '000660': 'SK하이닉스',
  '035420': 'NAVER',
  '035720': '카카오',
  '005380': '현대차',
}

const KR_META: Record<string, string> = {
  ...KR_STOCK_META,
  ...KR_ETF_META,
}

// 하이브리드 가중치
const TECH_WEIGHT = 0.4
const AI_WEIGHT   = 0.6

// Confidence threshold (LightGBM 신뢰도)
const CONFIDENCE_THRESHOLD_SELL = 0.40
const CONFIDENCE_THRESHOLD_BUY = 0.60

/** 기술적 스코어(-4.5 ~ +4.5)를 0-100으로 정규화 */
function normalizeTechScore(score: number): number {
  return Math.round((score + 4.5) / 9.0 * 100)
}

/**
 * RSI / MACD / SMA / Stochastic 기반 기술적 스코어 계산
 */
function calcTechScore(row: Record<string, any>): number {
  let score = 0
  const { close, rsi, macd, signal_line, sma_50, sma_200, stoch_k } = row

  if (rsi != null) {
    if      (rsi < 30) score += 1.5
    else if (rsi < 45) score += 0.5
    else if (rsi > 70) score -= 1.5
    else if (rsi > 55) score -= 0.5
  }

  if (macd != null && signal_line != null) {
    score += macd > signal_line ? 1.0 : -1.0
  }

  if (close != null && sma_50 != null) {
    score += close > sma_50 ? 0.5 : -0.5
  }

  if (close != null && sma_200 != null) {
    score += close > sma_200 ? 0.5 : -0.5
  }

  if (stoch_k != null) {
    if      (stoch_k < 20) score += 1.0
    else if (stoch_k > 80) score -= 1.0
  }

  return Math.round(score * 10) / 10
}

/**
 * 하이브리드 스코어(0-100) → 액션 변환
 */
function hybridScoreToAction(hybridScore: number): '매수' | '매도' | '관망' {
  if (hybridScore >= 60) return '매수'
  if (hybridScore <= 40) return '매도'
  return '관망'
}

/**
 * Confidence 기반 액션 필터링
 */
function applyConfidenceFilter(action: '매수' | '매도' | '관망', lgbm_prob: number | null): '매수' | '매도' | '관망' {
  if (lgbm_prob === null) return action

  // 신뢰도 0.60 이상일 때만 강한 신호 유지
  if ((action === '매수' || action === '매도') && lgbm_prob < 0.60) {
    return '관망'
  }
  
  return action
}

/**
 * 하이브리드 스코어 + Confidence → 신호 강도 분류 (5분류)
 */
function getSignalStrength(
  score: number,
  confidence: number | null,
  aiLabel: string | null
): '🚀 강한 매수' | '📈 매수' | '➡️ 관망' | '📉 매도' | '🔴 강한 매도' {
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

  // 2. 기술적 지표 조회
  const { data: rows, error: rErr } = await supabase
    .from('daily_indicators')
    .select('market_master_id, as_of_date, close, rsi, macd, signal_line, sma_50, sma_200, stoch_k')
    .in('market_master_id', ids)
    .order('as_of_date', { ascending: false })
    .limit(ids.length * 10)

  if (rErr) throw rErr

  // 3. AI 예측값 조회 (ticker별 calibration 방식별 최신 1행)
  const { data: aiRows, error: aiErr } = await supabase
    .from('ai_predictions')
    .select('ticker, date, signal_score, signal_label, lgbm_prob, breakdown, calibration_method')
    .in('ticker', symbols)
    .order('date', { ascending: false })
    .limit(symbols.length * 6)

  if (aiErr) console.error('ai_predictions fetch error:', aiErr)

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
  
  const aiByTicker: Record<string, AIPredictor> = {}
  for (const ticker in aiByTickerAndCalibration) {
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

  // 5. 하이브리드 스코어 계산 및 결과 조합
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
      hybridScore = techNorm
    }

    let action = hybridScoreToAction(hybridScore)
    action = applyConfidenceFilter(action, confidence)

    // 신호 강도 계산
    const signalStrength = getSignalStrength(hybridScore, confidence, aiLabel)

    let changePct = 0
    let changeStr = '-'
    if (prev?.close && latest.close) {
      changePct = (latest.close - prev.close) / prev.close * 100
      changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%'
    }

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
      
      // Calibration 방식별 점수
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

/**
 * /api/signals/top?market=us&limit=5
 * 상위 N개 종목 반환 (점수 기준 정렬)
 */
export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') ?? 'us'
    const limitStr = req.nextUrl.searchParams.get('limit') ?? '10'
    const limit = Math.min(Math.max(Number(limitStr), 1), 50) // 1~50 범위

    const meta = market === 'kr' ? KR_META : US_ETF_META
    const allSignals = await fetchSignals(meta)
    
    // 상위 limit개 반환
    const topSignals = allSignals.slice(0, limit)

    return NextResponse.json({
      market,
      total: allSignals.length,
      limit,
      count: topSignals.length,
      data: topSignals,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
