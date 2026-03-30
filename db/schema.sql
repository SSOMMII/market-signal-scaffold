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

-- 3) User alerts/preferences
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

-- 7) foreign_flow / signal_weights / etf_mapping / signal_history 추가 (2026-03-26)
CREATE TABLE IF NOT EXISTS foreign_flow (
  id serial PRIMARY KEY,
  as_of_date date NOT NULL,
  market text NOT NULL CHECK (market IN ('KRX', 'US', 'GLOBAL')),
  net_buy numeric(24,4) NOT NULL,
  futures_position numeric(24,4) NOT NULL,
  program_trading numeric(24,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (as_of_date, market)
);

CREATE TABLE IF NOT EXISTS signal_weights (
  id serial PRIMARY KEY,
  factor text NOT NULL UNIQUE,
  weight numeric(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS etf_mapping (
  id serial PRIMARY KEY,
  etf_code text NOT NULL UNIQUE,
  related_index text NOT NULL,
  sensitivity numeric(5,4) NOT NULL CHECK (sensitivity >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_history (
  id serial PRIMARY KEY,
  etf_code text NOT NULL,
  as_of_date date NOT NULL,
  signal text NOT NULL CHECK (signal IN ('STRONG BUY', 'BUY', 'HOLD', 'SELL', 'STRONG SELL')),
  predicted_score numeric(6,2),
  actual_return numeric(8,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etf_code, as_of_date)
);

-- 8) 감성 분석 캐시 (AI Pipeline Design M3)
CREATE TABLE IF NOT EXISTS sentiment_cache (
  id                 BIGSERIAL PRIMARY KEY,
  ticker             TEXT        NOT NULL,
  date               DATE        NOT NULL,
  sentiment_news     FLOAT,
  sentiment_reddit   FLOAT,
  sentiment_combined FLOAT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- 9) AI 예측 결과 (AI Pipeline Design M5~M6)
CREATE TABLE IF NOT EXISTS ai_predictions (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT        NOT NULL,
  date            DATE        NOT NULL,
  signal_score    INT         NOT NULL,  -- 0~100
  signal_label    TEXT        NOT NULL CHECK (signal_label IN ('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL')),
  lgbm_prob       FLOAT,
  contributions   JSONB,                 -- top_contributors 배열
  breakdown       JSONB,                 -- 카테고리별 기여 수치
  summary_text    TEXT,
  entry_price     NUMERIC(18, 6),        -- Retention context: 신호 발생 시점의 가격
  entry_date      DATE,                  -- Retention context: 진입 날짜
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- 10) index 최적화
CREATE INDEX IF NOT EXISTS idx_daily_indicators_market_date ON daily_indicators(market_master_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_global_indicators_ts ON global_indicators(as_of_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id);
