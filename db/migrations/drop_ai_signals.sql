-- ============================================================
-- Migration: ai_signals 테이블 삭제
-- 이유: ai_predictions(LightGBM)으로 역할 통합, ai_signals는 미사용
-- 실행: Supabase SQL Editor에 붙여넣고 실행
-- 주의: 되돌릴 수 없음. 실행 전 데이터 확인 권장:
--   SELECT COUNT(*) FROM ai_signals;
-- ============================================================

DROP INDEX  IF EXISTS idx_ai_signals_market_date;
DROP TABLE  IF EXISTS ai_signals CASCADE;
