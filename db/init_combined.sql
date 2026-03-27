-- ============================================================
-- Global Market Bridge AI — Supabase SQL Editor용 통합 초기화
-- 사용법: 이 파일 전체를 Supabase SQL Editor에 붙여넣고 실행
-- ============================================================

-- 1) Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- 2) Tables (schema.sql 내용)
-- ============================================================

-- market_master: 종목/ETF/인덱스 마스터
CREATE TABLE IF NOT EXISTS market_master (
  id serial PRIMARY KEY,
  symbol text NOT NULL UNIQUE,
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

-- daily_indicators: OHLCV + 기술적 지표
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

-- ai_signals: AI 예측 신호 출력
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

-- user_alerts: 사용자 알림 설정
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

-- global_indicators: 글로벌 시장 스냅샷
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

-- users: 사용자 테이블
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  display_name text,
  locale text DEFAULT 'ko-KR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- foreign_flow: 외국인 순매수
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

-- signal_weights: AI 점수 가중치
CREATE TABLE IF NOT EXISTS signal_weights (
  id serial PRIMARY KEY,
  factor text NOT NULL UNIQUE,
  weight numeric(5,4) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- etf_mapping: ETF-인덱스 매핑
CREATE TABLE IF NOT EXISTS etf_mapping (
  id serial PRIMARY KEY,
  etf_code text NOT NULL UNIQUE,
  related_index text NOT NULL,
  sensitivity numeric(5,4) NOT NULL CHECK (sensitivity >= 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- signal_history: 예측 정확도 추적
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

-- sentiment_cache: 감성 분석 캐시 (AI Pipeline M3)
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

-- ai_predictions: AI 예측 결과 (AI Pipeline M5~M6)
CREATE TABLE IF NOT EXISTS ai_predictions (
  id              BIGSERIAL PRIMARY KEY,
  ticker          TEXT        NOT NULL,
  date            DATE        NOT NULL,
  signal_score    INT         NOT NULL,  -- 0~100
  signal_label    TEXT        NOT NULL CHECK (signal_label IN ('STRONG_BUY','BUY','HOLD','SELL','STRONG_SELL')),
  lgbm_prob       FLOAT,
  contributions   JSONB,
  breakdown       JSONB,
  summary_text    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- ============================================================
-- 3) Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_indicators_market_date ON daily_indicators(market_master_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_ai_signals_market_date ON ai_signals(market_master_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_global_indicators_ts ON global_indicators(as_of_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_user ON user_alerts(user_id);

-- ============================================================
-- 4) 기본 마스터 데이터 샘플
-- ============================================================
INSERT INTO market_master (symbol, name, market_type, asset_type, region, currency, sector, tags)
VALUES
  ('KOSPI',  'KOSPI Composite Index', 'KR',     'INDEX', 'KR', 'KRW', 'Index', ARRAY['KOSPI','INDEX']),
  ('KOSDAQ', 'KOSDAQ Composite Index','KR',     'INDEX', 'KR', 'KRW', 'Index', ARRAY['KOSDAQ','INDEX']),
  ('SPX',    'S&P 500',               'US',     'INDEX', 'US', 'USD', 'Index', ARRAY['S&P500','INDEX']),
  ('NDX',    'NASDAQ 100',            'US',     'INDEX', 'US', 'USD', 'Index', ARRAY['NASDAQ','INDEX'])
ON CONFLICT DO NOTHING;
