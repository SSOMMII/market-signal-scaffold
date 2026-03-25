-- DB schema for Global Market Bridge AI
-- from PRD Global Market Bridge AI (v1.0)

-- 1) Market master information
CREATE TABLE IF NOT EXISTS market_master (
  id serial PRIMARY KEY,
  symbol text NOT NULL,
  name text NOT NULL,
  market_type text NOT NULL CHECK (market_type IN ('KR', 'US', 'GLOBAL')),
  asset_type text NOT NULL CHECK (asset_type IN ('STOCK', 'ETF', 'FUTURE', 'INDEX', 'FX')),
  region text,
  currency text,
  sector text,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Daily indicators (가격 + 기술적 지표) 
CREATE TABLE IF NOT EXISTS daily_indicators (
  id serial PRIMARY KEY,
  market_master_id integer NOT NULL REFERENCES market_master(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  open numeric(18, 6),
  high numeric(18, 6),
  low numeric(18, 6),
  close numeric(18, 6),
  volume numeric(24, 4),
  rsi numeric(6, 2),
  macd numeric(8, 4),
  signal_line numeric(8, 4),
  sma_50 numeric(18, 6),
  sma_120 numeric(18, 6),
  sma_200 numeric(18, 6),
  bollinger_upper numeric(18, 6),
  bollinger_middle numeric(18, 6),
  bollinger_lower numeric(18, 6),
  stoch_k numeric(6, 2),
  stoch_d numeric(6, 2),
  foreign_net_flow numeric(24, 4),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_master_id, as_of_date)
);

-- 3) AI signals output
CREATE TABLE IF NOT EXISTS ai_signals (
  id serial PRIMARY KEY,
  market_master_id integer NOT NULL REFERENCES market_master(id) ON DELETE CASCADE,
  as_of_date date NOT NULL,
  source text NOT NULL CHECK (source IN ('NIGHT', 'DAY', 'AUTO', 'BACKTEST')),
  tech_score numeric(5,2) NOT NULL,
  global_score numeric(5,2) NOT NULL,
  futures_score numeric(5,2) NOT NULL,
  fx_score numeric(5,2) NOT NULL,
  supply_score numeric(5,2) NOT NULL,
  total_score numeric(6,2) GENERATED ALWAYS AS ((tech_score*0.3 + global_score*0.3 + futures_score*0.2 + fx_score*0.1 + supply_score*0.1)) STORED,
  signal text NOT NULL CHECK (signal IN ('STRONG BUY','BUY','HOLD','SELL','STRONG SELL')),
  confidence numeric(5,2) NOT NULL,
  commentary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (market_master_id, as_of_date, source)
);

-- 4) User alerts/preferences
CREATE TABLE IF NOT EXISTS user_alerts (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL,
  market_master_id integer REFERENCES market_master(id) ON DELETE SET NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('PRICE', 'TECH_SIGNAL', 'AI_SIGNAL', 'NEWS', 'DAILY_SUMMARY')),
  condition jsonb NOT NULL,
  channel text NOT NULL CHECK (channel IN ('EMAIL', 'PUSH', 'SMS', 'WEBHOOK')),
  enabled boolean NOT NULL DEFAULT TRUE,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Global indicators for dashboard
CREATE TABLE IF NOT EXISTS global_indicators (
  id serial PRIMARY KEY,
  as_of_timestamp timestamptz NOT NULL,
  sp500 numeric(18,6),
  nasdaq numeric(18,6),
  vix numeric(18,6),
  wti numeric(18,6),
  gold numeric(18,6),
  usd_krw numeric(18,6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (as_of_timestamp)
);

-- 6) 사용자 테이블 기본 (추가 설계)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  display_name text,
  locale text DEFAULT 'ko-KR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7) index 최적화
CREATE INDEX IF NOT EXISTS idx_daily_indicators_market_date ON daily_indicators(market_master_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_ai_signals_market_date ON ai_signals(market_master_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_global_indicators_ts ON global_indicators(as_of_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id);
