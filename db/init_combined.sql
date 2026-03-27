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
-- 4) 마스터 데이터 (인덱스 + 전종목)
-- ============================================================
INSERT INTO market_master (symbol, name, market_type, asset_type, currency) VALUES

-- 인덱스
('KOSPI',  'KOSPI Composite Index',  'KR', 'INDEX', 'KRW'),
('KOSDAQ', 'KOSDAQ Composite Index', 'KR', 'INDEX', 'KRW'),
('^KS11',  'KOSPI Index',            'KR', 'INDEX', 'KRW'),
('SPX',    'S&P 500',                'US', 'INDEX', 'USD'),
('NDX',    'NASDAQ 100',             'US', 'INDEX', 'USD'),

-- 국내 대형주 (KOSPI)
('005930', '삼성전자',            'KR', 'STOCK', 'KRW'),
('005935', '삼성전자우',          'KR', 'STOCK', 'KRW'),
('000660', 'SK하이닉스',          'KR', 'STOCK', 'KRW'),
('035420', 'NAVER',               'KR', 'STOCK', 'KRW'),
('035720', '카카오',              'KR', 'STOCK', 'KRW'),
('005380', '현대차',              'KR', 'STOCK', 'KRW'),
('000270', '기아',                'KR', 'STOCK', 'KRW'),
('005490', 'POSCO홀딩스',         'KR', 'STOCK', 'KRW'),
('051910', 'LG화학',              'KR', 'STOCK', 'KRW'),
('006400', '삼성SDI',             'KR', 'STOCK', 'KRW'),
('373220', 'LG에너지솔루션',      'KR', 'STOCK', 'KRW'),
('207940', '삼성바이오로직스',    'KR', 'STOCK', 'KRW'),
('068270', '셀트리온',            'KR', 'STOCK', 'KRW'),
('128940', '한미약품',            'KR', 'STOCK', 'KRW'),
('012330', '현대모비스',          'KR', 'STOCK', 'KRW'),
('028260', '삼성물산',            'KR', 'STOCK', 'KRW'),
('018260', '삼성에스디에스',      'KR', 'STOCK', 'KRW'),
('009150', '삼성전기',            'KR', 'STOCK', 'KRW'),
('000810', '삼성화재',            'KR', 'STOCK', 'KRW'),
('032830', '삼성생명',            'KR', 'STOCK', 'KRW'),
('003550', 'LG',                  'KR', 'STOCK', 'KRW'),
('066570', 'LG전자',              'KR', 'STOCK', 'KRW'),
('032640', 'LG유플러스',          'KR', 'STOCK', 'KRW'),
('034730', 'SK',                  'KR', 'STOCK', 'KRW'),
('096770', 'SK이노베이션',        'KR', 'STOCK', 'KRW'),
('017670', 'SK텔레콤',            'KR', 'STOCK', 'KRW'),
('030200', 'KT',                  'KR', 'STOCK', 'KRW'),
('055550', '신한지주',            'KR', 'STOCK', 'KRW'),
('105560', 'KB금융',              'KR', 'STOCK', 'KRW'),
('086790', '하나금융지주',        'KR', 'STOCK', 'KRW'),
('316140', '우리금융지주',        'KR', 'STOCK', 'KRW'),
('024110', '기업은행',            'KR', 'STOCK', 'KRW'),
('015760', '한국전력',            'KR', 'STOCK', 'KRW'),
('010950', 'S-Oil',               'KR', 'STOCK', 'KRW'),
('033780', 'KT&G',                'KR', 'STOCK', 'KRW'),
('004020', '현대제철',            'KR', 'STOCK', 'KRW'),
('011200', 'HMM',                 'KR', 'STOCK', 'KRW'),
('009540', 'HD한국조선해양',      'KR', 'STOCK', 'KRW'),
('329180', 'HD현대중공업',        'KR', 'STOCK', 'KRW'),
('267250', 'HD현대',              'KR', 'STOCK', 'KRW'),
('042660', '한화오션',            'KR', 'STOCK', 'KRW'),
('010140', '삼성중공업',          'KR', 'STOCK', 'KRW'),
('003490', '대한항공',            'KR', 'STOCK', 'KRW'),
('020560', '아시아나항공',        'KR', 'STOCK', 'KRW'),
('047050', '포스코인터내셔널',    'KR', 'STOCK', 'KRW'),
('161390', '한국타이어앤테크놀로지', 'KR', 'STOCK', 'KRW'),
('000120', 'CJ대한통운',          'KR', 'STOCK', 'KRW'),
('097950', 'CJ제일제당',          'KR', 'STOCK', 'KRW'),
('271560', '오리온',              'KR', 'STOCK', 'KRW'),
('000080', '하이트진로',          'KR', 'STOCK', 'KRW'),
('021240', '코웨이',              'KR', 'STOCK', 'KRW'),
('010060', 'OCI홀딩스',           'KR', 'STOCK', 'KRW'),

-- 국내 IT/플랫폼/엔터
('377300', '카카오페이',          'KR', 'STOCK', 'KRW'),
('323410', '카카오뱅크',          'KR', 'STOCK', 'KRW'),
('352820', '하이브',              'KR', 'STOCK', 'KRW'),
('041510', '에스엠',              'KR', 'STOCK', 'KRW'),
('035900', 'JYP엔터테인먼트',     'KR', 'STOCK', 'KRW'),
('122870', '와이지엔터테인먼트',  'KR', 'STOCK', 'KRW'),
('036570', '엔씨소프트',          'KR', 'STOCK', 'KRW'),
('251270', '넷마블',              'KR', 'STOCK', 'KRW'),
('263750', '펄어비스',            'KR', 'STOCK', 'KRW'),
('112040', '위메이드',            'KR', 'STOCK', 'KRW'),

-- 국내 2차전지/신에너지
('247540', '에코프로비엠',        'KR', 'STOCK', 'KRW'),
('086520', '에코프로',            'KR', 'STOCK', 'KRW'),
('402340', '씨에스윈드',          'KR', 'STOCK', 'KRW'),
('011790', 'SKC',                 'KR', 'STOCK', 'KRW'),
('006260', 'LS',                  'KR', 'STOCK', 'KRW'),

-- 미국 빅테크
('AAPL',  'Apple Inc.',                 'US', 'STOCK', 'USD'),
('MSFT',  'Microsoft Corporation',      'US', 'STOCK', 'USD'),
('NVDA',  'NVIDIA Corporation',         'US', 'STOCK', 'USD'),
('GOOGL', 'Alphabet Inc. (Class A)',    'US', 'STOCK', 'USD'),
('GOOG',  'Alphabet Inc. (Class C)',    'US', 'STOCK', 'USD'),
('AMZN',  'Amazon.com Inc.',            'US', 'STOCK', 'USD'),
('META',  'Meta Platforms Inc.',        'US', 'STOCK', 'USD'),
('TSLA',  'Tesla Inc.',                 'US', 'STOCK', 'USD'),
('AVGO',  'Broadcom Inc.',              'US', 'STOCK', 'USD'),
('AMD',   'Advanced Micro Devices',     'US', 'STOCK', 'USD'),
('INTC',  'Intel Corporation',          'US', 'STOCK', 'USD'),
('QCOM',  'Qualcomm Inc.',              'US', 'STOCK', 'USD'),
('ORCL',  'Oracle Corporation',         'US', 'STOCK', 'USD'),
('CRM',   'Salesforce Inc.',            'US', 'STOCK', 'USD'),
('ADBE',  'Adobe Inc.',                 'US', 'STOCK', 'USD'),
('NOW',   'ServiceNow Inc.',            'US', 'STOCK', 'USD'),
('PLTR',  'Palantir Technologies',      'US', 'STOCK', 'USD'),

-- 미국 금융
('JPM',   'JPMorgan Chase & Co.',       'US', 'STOCK', 'USD'),
('BAC',   'Bank of America',            'US', 'STOCK', 'USD'),
('WFC',   'Wells Fargo & Co.',          'US', 'STOCK', 'USD'),
('GS',    'Goldman Sachs Group',        'US', 'STOCK', 'USD'),
('MS',    'Morgan Stanley',             'US', 'STOCK', 'USD'),
('V',     'Visa Inc.',                  'US', 'STOCK', 'USD'),
('MA',    'Mastercard Inc.',            'US', 'STOCK', 'USD'),
('PYPL',  'PayPal Holdings',            'US', 'STOCK', 'USD'),

-- 미국 헬스케어/소비재/에너지
('UNH',   'UnitedHealth Group',         'US', 'STOCK', 'USD'),
('JNJ',   'Johnson & Johnson',          'US', 'STOCK', 'USD'),
('LLY',   'Eli Lilly and Company',      'US', 'STOCK', 'USD'),
('PFE',   'Pfizer Inc.',                'US', 'STOCK', 'USD'),
('WMT',   'Walmart Inc.',               'US', 'STOCK', 'USD'),
('COST',  'Costco Wholesale',           'US', 'STOCK', 'USD'),
('HD',    'Home Depot Inc.',            'US', 'STOCK', 'USD'),
('PG',    'Procter & Gamble Co.',       'US', 'STOCK', 'USD'),
('KO',    'Coca-Cola Company',          'US', 'STOCK', 'USD'),
('PEP',   'PepsiCo Inc.',               'US', 'STOCK', 'USD'),
('XOM',   'Exxon Mobil Corporation',    'US', 'STOCK', 'USD'),
('CVX',   'Chevron Corporation',        'US', 'STOCK', 'USD'),

-- 미국 미디어/기타
('NFLX',  'Netflix Inc.',               'US', 'STOCK', 'USD'),
('DIS',   'Walt Disney Co.',            'US', 'STOCK', 'USD'),
('UBER',  'Uber Technologies',          'US', 'STOCK', 'USD'),
('ABNB',  'Airbnb Inc.',                'US', 'STOCK', 'USD'),
('SPOT',  'Spotify Technology',         'US', 'STOCK', 'USD'),
('TSM',   'Taiwan Semiconductor',       'US', 'STOCK', 'USD'),
('ASML',  'ASML Holding N.V.',          'US', 'STOCK', 'USD'),
('BABA',  'Alibaba Group',              'US', 'STOCK', 'USD'),

-- 미국 ETF
('SPY',   'SPDR S&P 500 ETF',          'US', 'ETF', 'USD'),
('QQQ',   'Invesco QQQ Trust',          'US', 'ETF', 'USD'),
('IWM',   'iShares Russell 2000 ETF',  'US', 'ETF', 'USD'),
('VTI',   'Vanguard Total Stock Market','US', 'ETF', 'USD'),
('VOO',   'Vanguard S&P 500 ETF',      'US', 'ETF', 'USD'),
('GLD',   'SPDR Gold Shares',          'US', 'ETF', 'USD'),
('TLT',   'iShares 20+ Year Treasury', 'US', 'ETF', 'USD'),
('ARKK',  'ARK Innovation ETF',        'US', 'ETF', 'USD'),
('SOXL',  'Direxion Semicon Bull 3X',  'US', 'ETF', 'USD')

ON CONFLICT (symbol) DO UPDATE SET
  name       = EXCLUDED.name,
  updated_at = now();
