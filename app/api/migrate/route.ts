import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

export async function GET() {
  try {
    // Migration: add calibration_method column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE ai_predictions
        ADD COLUMN IF NOT EXISTS calibration_method TEXT DEFAULT 'platt'
        CHECK (calibration_method IN ('platt', 'iso', 'beta', 'none'))
      `
    })

    if (alterError) {
      console.error('Migration error:', alterError)
      return NextResponse.json({ error: alterError.message }, { status: 500 })
    }

    // Create index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_ai_predictions_calibration_method
        ON ai_predictions(calibration_method)
      `
    })

    if (indexError) {
      console.error('Index creation error:', indexError)
      // Don't fail on index error, might already exist
    }

    return NextResponse.json({ success: true, message: 'Migration applied successfully' })
  } catch (error) {
    console.error('Migration failed:', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}