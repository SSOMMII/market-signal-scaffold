-- Migration: Calibration 방식 정보 추가
-- Platt / ISO Regression / Beta Calibration 구분

BEGIN;

-- 1) ai_predictions 테이블에 calibration_method 컬럼 추가
ALTER TABLE ai_predictions 
ADD COLUMN IF NOT EXISTS calibration_method TEXT DEFAULT 'platt' 
  CHECK (calibration_method IN ('platt', 'iso', 'beta', 'none'));

-- 2) 인덱스 추가 (calibration_method 기반 필터링)
CREATE INDEX IF NOT EXISTS idx_ai_predictions_calibration_method 
  ON ai_predictions(calibration_method);

-- 3) UNIQUE 제약 변경 (calibration_method 포함)
-- 기존 UNIQUE 제약 제거
ALTER TABLE ai_predictions 
DROP CONSTRAINT IF EXISTS ai_predictions_ticker_date_version_key;

-- 새로운 UNIQUE 제약 추가 (model_version + calibration_method 포함)
ALTER TABLE ai_predictions 
ADD CONSTRAINT ai_predictions_ticker_date_version_cal_key 
  UNIQUE (ticker, date, model_version, calibration_method);

-- 4) 복합 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_ai_predictions_ticker_date_version_cal 
  ON ai_predictions(ticker, date DESC, model_version, calibration_method);

COMMIT;
