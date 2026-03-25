import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and ANON key must be set in environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getMarketMasters() {
  const { data, error } = await supabase.from('market_master').select('*')
  if (error) throw error
  return data
}

export async function getDailyIndicators(marketMasterId: number, date?: string) {
  let query = supabase.from('daily_indicators').select('*').eq('market_master_id', marketMasterId)
  if (date) query = query.eq('as_of_date', date)
  const { data, error } = await query
  if (error) throw error
  return data
}
