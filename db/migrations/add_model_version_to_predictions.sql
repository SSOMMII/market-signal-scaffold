-- Migration: A/B 테스트를 위한 모델 버전 컬럼 추가
-- Model A (원본): calibration 없음
-- Model B (Calibrated): Platt Scaling 적용

BEGIN;

-- 1) ai_predictions 테이블에 model_version 컬럼 추가 (기본값: 'A')
ALTER TABLE ai_predictions 
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'A' CHECK (model_version IN ('A', 'B'));

-- 2) UNIQUE 제약 변경 (model_version 포함)
-- 기존 UNIQUE 제약 제거
ALTER TABLE ai_predictions 
DROP CONSTRAINT IF EXISTS ai_predictions_ticker_date_key;

-- 새로운 UNIQUE 제약 추가 (model_version 포함)
ALTER TABLE ai_predictions 
ADD CONSTRAINT ai_predictions_ticker_date_version_key UNIQUE (ticker, date, model_version);

-- 3) 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_ai_predictions_ticker_date_version 
  ON ai_predictions(ticker, date DESC, model_version);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_model_version 
  ON ai_predictions(model_version);

COMMIT;
