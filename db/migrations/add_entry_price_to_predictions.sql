-- Migration: Add entry price and retention tracking to ai_predictions
-- Purpose: Track price at signal generation for return_entry calculations
-- Date: 2026-03-28

-- 1. Add entry_price column to ai_predictions
ALTER TABLE ai_predictions
ADD COLUMN IF NOT EXISTS entry_price NUMERIC(18, 6),
ADD COLUMN IF NOT EXISTS entry_date DATE;

-- 2. Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_predictions_entry_date 
ON ai_predictions(ticker, entry_date);

CREATE INDEX IF NOT EXISTS idx_ai_predictions_ticker_entry 
ON ai_predictions(ticker, date, entry_date) 
WHERE entry_price IS NOT NULL;

-- 3. Update existing records: use close price on signal date as entry_price
-- This provides historical baseline for backtesting
UPDATE ai_predictions ap
SET entry_price = di.close,
    entry_date = di.as_of_date
FROM daily_indicators di
JOIN market_master mm ON di.market_master_id = mm.id
WHERE mm.symbol = ap.ticker
  AND di.as_of_date = ap.date
  AND ap.entry_price IS NULL;

-- 4. Comment explaining retention context
COMMENT ON COLUMN ai_predictions.entry_price IS 
  'Price at which signal was generated (for return_entry calculation)';
COMMENT ON COLUMN ai_predictions.entry_date IS 
  'Date when signal was generated (tracking entry context)';
