import { NextResponse } from 'next/server'
import { getMarketMasters } from '@/lib/supabaseClient'

export async function GET() {
  try {
    const data = await getMarketMasters()
    return NextResponse.json({ data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}
