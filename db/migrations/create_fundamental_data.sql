-- Create fundamental_data table for Korean company financials
CREATE TABLE IF NOT EXISTS fundamental_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL, -- 1,2,3,4
    revenue BIGINT, -- 매출액
    net_income BIGINT, -- 당기순이익
    total_assets BIGINT, -- 자산총계
    total_equity BIGINT, -- 자본총계
    eps DECIMAL(10,2), -- 주당순이익
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, year, quarter)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_fundamental_data_symbol ON fundamental_data(symbol);
CREATE INDEX IF NOT EXISTS idx_fundamental_data_year_quarter ON fundamental_data(year, quarter);