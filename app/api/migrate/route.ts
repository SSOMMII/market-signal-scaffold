import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'

const MIGRATION_SQL = `
-- Run in Supabase SQL Editor:

ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS calibration_method TEXT DEFAULT 'platt'
  CHECK (calibration_method IN ('platt', 'iso', 'beta', 'none'));

CREATE INDEX IF NOT EXISTS idx_ai_predictions_calibration_method
  ON ai_predictions(calibration_method);

ALTER TABLE ai_predictions
DROP CONSTRAINT IF EXISTS ai_predictions_ticker_date_version_key;

ALTER TABLE ai_predictions
ADD CONSTRAINT ai_predictions_ticker_date_version_cal_key
  UNIQUE (ticker, date, model_version, calibration_method);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_ticker_date_version_cal
  ON ai_predictions(ticker, date DESC, model_version, calibration_method);
`.trim()

export async function GET() {
  try {
    const admin = getAdminClient()

    // calibration_method 컬럼 존재 여부 확인
    const { error } = await admin
      .from('ai_predictions')
      .select('calibration_method')
      .limit(1)

    if (!error) {
      return NextResponse.json({
        success: true,
        message: 'Migration already applied — calibration_method column exists',
      })
    }

    // 컬럼 없음 → 수동 실행 안내
    return NextResponse.json(
      {
        success: false,
        message:
          'calibration_method column not found. Please run the SQL below in Supabase SQL Editor.',
        sql: MIGRATION_SQL,
      },
      { status: 412 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
