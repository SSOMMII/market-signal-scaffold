/**
 * Supabase Admin Client (Service Role)
 * - cron route 등 서버 전용 쓰기 작업에 사용
 * - 절대 클라이언트(브라우저) 코드에서 import 금지
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set')

  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

/**
 * sentiment_cache를 부분 업데이트 (기존 컬럼 보존)
 * - 각 cron이 자신의 컬럼만 덮어쓰고 나머지는 유지
 */
export async function mergeSentimentCache(
  ticker: string,
  date: string,
  updates: {
    sentiment_news?: number | null
    sentiment_reddit?: number | null
    sentiment_combined?: number | null
  }
) {
  const client = getAdminClient()

  const { data: existing } = await client
    .from('sentiment_cache')
    .select('sentiment_news, sentiment_reddit, sentiment_combined')
    .eq('ticker', ticker)
    .eq('date', date)
    .maybeSingle()

  const merged = {
    ticker,
    date,
    sentiment_news: existing?.sentiment_news ?? null,
    sentiment_reddit: existing?.sentiment_reddit ?? null,
    sentiment_combined: existing?.sentiment_combined ?? null,
    ...updates,
  }

  const { error } = await client
    .from('sentiment_cache')
    .upsert(merged, { onConflict: 'ticker,date' })
  if (error) throw error
}
