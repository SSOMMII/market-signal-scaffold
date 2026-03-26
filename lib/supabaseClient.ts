import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and ANON key must be set in environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── market_master ───────────────────────────────────────────────────
export async function getMarketMasters(marketType?: 'KR' | 'US' | 'GLOBAL') {
  let query = supabase.from('market_master').select('*')
  if (marketType) query = query.eq('market_type', marketType)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ── daily_indicators ────────────────────────────────────────────────
export async function getDailyIndicators(marketMasterId: number, date?: string) {
  let query = supabase
    .from('daily_indicators')
    .select('*')
    .eq('market_master_id', marketMasterId)
    .order('as_of_date', { ascending: false })
  if (date) query = query.eq('as_of_date', date)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function upsertDailyIndicator(row: {
  market_master_id: number
  as_of_date: string
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  rsi?: number
  macd?: number
  signal_line?: number
  sma_50?: number
  sma_120?: number
  sma_200?: number
  bollinger_upper?: number
  bollinger_middle?: number
  bollinger_lower?: number
  stoch_k?: number
  stoch_d?: number
  foreign_net_flow?: number
}) {
  const { error } = await supabase
    .from('daily_indicators')
    .upsert(row, { onConflict: 'market_master_id,as_of_date' })
  if (error) throw error
}

// ── global_indicators ───────────────────────────────────────────────
export async function getLatestGlobalIndicators() {
  const { data, error } = await supabase
    .from('global_indicators')
    .select('*')
    .order('as_of_timestamp', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error
  return data
}

export async function upsertGlobalIndicators(row: {
  as_of_timestamp: string
  sp500?: number
  nasdaq?: number
  vix?: number
  wti?: number
  gold?: number
  usd_krw?: number
}) {
  const { error } = await supabase
    .from('global_indicators')
    .upsert(row, { onConflict: 'as_of_timestamp' })
  if (error) throw error
}

// ── foreign_flow ────────────────────────────────────────────────────
export async function getForeignFlow(market: 'KRX' | 'US' | 'GLOBAL', date?: string) {
  let query = supabase
    .from('foreign_flow')
    .select('*')
    .eq('market', market)
    .order('as_of_date', { ascending: false })
  if (date) query = query.eq('as_of_date', date)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function upsertForeignFlow(row: {
  as_of_date: string
  market: 'KRX' | 'US' | 'GLOBAL'
  net_buy: number
  futures_position: number
  program_trading: number
}) {
  const { error } = await supabase
    .from('foreign_flow')
    .upsert(row, { onConflict: 'as_of_date,market' })
  if (error) throw error
}

// ── sentiment_cache ─────────────────────────────────────────────────
export async function getSentimentCache(ticker: string, date: string) {
  const { data, error } = await supabase
    .from('sentiment_cache')
    .select('*')
    .eq('ticker', ticker)
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertSentimentCache(row: {
  ticker: string
  date: string
  sentiment_news?: number
  sentiment_reddit?: number
  sentiment_combined?: number
}) {
  const { error } = await supabase
    .from('sentiment_cache')
    .upsert(row, { onConflict: 'ticker,date' })
  if (error) throw error
}

// ── ai_predictions ──────────────────────────────────────────────────
export async function getAiPrediction(ticker: string, date: string) {
  const { data, error } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('ticker', ticker)
    .eq('date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getAiPredictionHistory(ticker: string, limit = 30) {
  const { data, error } = await supabase
    .from('ai_predictions')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// ── market_summary (symbol 기반 daily_indicators 조회) ──────────────
export async function getDailyIndicatorsBySymbol(symbol: string, limit = 30) {
  const { data: master } = await supabase
    .from('market_master')
    .select('id')
    .eq('symbol', symbol)
    .maybeSingle()
  if (!master) return []
  const { data, error } = await supabase
    .from('daily_indicators')
    .select('as_of_date,open,high,low,close,volume,rsi,macd,signal_line,sma_50,sma_120,sma_200,bollinger_upper,bollinger_middle,bollinger_lower,stoch_k,stoch_d')
    .eq('market_master_id', master.id)
    .order('as_of_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getLatestGlobalIndicatorsHistory(limit = 2) {
  const { data, error } = await supabase
    .from('global_indicators')
    .select('*')
    .order('as_of_timestamp', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function upsertAiPrediction(row: {
  ticker: string
  date: string
  signal_score: number
  signal_label: string
  lgbm_prob?: number
  contributions?: object
  breakdown?: object
  summary_text?: string
}) {
  const { error } = await supabase
    .from('ai_predictions')
    .upsert(row, { onConflict: 'ticker,date' })
  if (error) throw error
}
