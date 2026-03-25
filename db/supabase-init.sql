-- Supabase migration script for Global Market Bridge AI DB
-- 실행 방법:
-- 1) supabase 프로젝트 생성
-- 2) Supabase SQL editor 또는 supabase migration에 실행

-- ext uuid 필요한 경우 (Supabase 기본으로 활성화됨)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- 필수 스키마 생성
\i schema.sql

-- 기본 마스터 데이터 샘플 추가 (선택)
INSERT INTO market_master (symbol, name, market_type, asset_type, region, currency, sector, tags)
VALUES
 ('KOSPI','KOSPI Composite Index','KR','INDEX','KR','KRW','Index',ARRAY['KOSPI','INDEX']),
 ('KOSDAQ','KOSDAQ Composite Index','KR','INDEX','KR','KRW','Index',ARRAY['KOSDAQ','INDEX']),
 ('SPX','S&P 500','US','INDEX','US','USD','Index',ARRAY['S&P500','INDEX']),
 ('NDX','NASDAQ 100','US','INDEX','US','USD','Index',ARRAY['NASDAQ','INDEX']);

-- sample data should be refreshed through ETL jobs later.
