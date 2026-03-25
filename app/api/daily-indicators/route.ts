import { NextResponse } from 'next/server'
import { getDailyIndicators } from '@/lib/supabaseClient'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const marketMasterId = url.searchParams.get('marketMasterId')
  const date = url.searchParams.get('date') || undefined

  if (!marketMasterId) {
    return NextResponse.json({ error: 'marketMasterId is required' }, { status: 400 })
  }

  const idNum = Number(marketMasterId)
  if (Number.isNaN(idNum) || idNum <= 0) {
    return NextResponse.json({ error: 'marketMasterId must be a positive number' }, { status: 400 })
  }

  try {
    const data = await getDailyIndicators(idNum, date)
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
