#!/usr/bin/env python3
"""
FRED (Federal Reserve Economic Data) 거시경제 지표 수집기
- pandas_datareader 사용 (미국 연준 공식 데이터)
- 연방기준금리, 실업률, GDP, CPI, 국채금리, 원달러 환율 등
- API Key: https://fred.stlouisfed.org/docs/api/api_key.html (무료 발급)
- 출력: JSON

Usage:
    python collect_fred.py                              # 최근 90일
    python collect_fred.py 2025-01-01 2025-03-26       # 날짜 범위
"""

import json
import os
import sys
from datetime import date, timedelta

try:
    import pandas_datareader as pdr
    import pandas as pd
except ImportError:
    print("ERROR: pandas_datareader, pandas 패키지가 필요합니다.", file=sys.stderr)
    print("설치: pip install pandas_datareader pandas", file=sys.stderr)
    sys.exit(1)

# FRED Series ID → 설명
FRED_SERIES = {
    # 미국 통화/금리
    'FEDFUNDS':   '미국 연방기준금리 (%)',
    'DGS10':      '미국 10년 국채금리 (%)',
    'DGS2':       '미국 2년 국채금리 (%)',
    'T10Y2Y':     '장단기 금리차 (10Y-2Y, %)',

    # 경제 실물
    'UNRATE':     '미국 실업률 (%)',
    'PAYEMS':     '비농업부문 고용자수 (천명)',
    'GDP':        '미국 실질 GDP (십억달러, 분기)',

    # 물가
    'CPIAUCSL':   '미국 CPI 소비자물가지수 (계절조정)',
    'PCEPI':      '미국 PCE 개인소비지출물가지수',

    # 환율
    'DEXKOUS':    '원달러 환율 (KRW/USD)',
    'DEXJPUS':    '엔달러 환율 (JPY/USD)',
    'DEXUSEU':    '달러유로 환율 (USD/EUR)',
}

# FRED API Key (선택 - 없어도 동작하나 속도 제한 있음)
FRED_API_KEY = os.environ.get('FRED_API_KEY', '')


def collect_fred(start_date: str, end_date: str) -> dict:
    results = {}

    if FRED_API_KEY:
        pdr.fred.FredReader.api_key = FRED_API_KEY

    for series_id, description in FRED_SERIES.items():
        try:
            df = pdr.get_data_fred(series_id, start=start_date, end=end_date)
            df = df.dropna()

            results[series_id] = {
                'description': description,
                'unit': _infer_unit(series_id),
                'data': [
                    {
                        'date': str(idx.date()),
                        'value': round(float(v), 6),
                    }
                    for idx, v in df[series_id].items()
                ],
            }
            print(f"[OK] {series_id}: {len(results[series_id]['data'])}건", file=sys.stderr)

        except Exception as e:
            print(f"[WARN] {series_id}: {e}", file=sys.stderr)
            results[series_id] = {
                'description': description,
                'data': [],
                'error': str(e),
            }

    return results


def _infer_unit(series_id: str) -> str:
    if series_id in ('FEDFUNDS', 'DGS10', 'DGS2', 'T10Y2Y', 'UNRATE'):
        return 'percent'
    if series_id == 'GDP':
        return 'billion_usd'
    if series_id == 'PAYEMS':
        return 'thousands'
    if series_id.startswith('DEX'):
        return 'exchange_rate'
    return 'index'


if __name__ == '__main__':
    args = sys.argv[1:]

    if len(args) >= 2:
        start_date, end_date = args[0], args[1]
    else:
        end_date = date.today().isoformat()
        start_date = (date.today() - timedelta(days=90)).isoformat()

    print(f"[INFO] FRED 수집: {start_date} ~ {end_date}", file=sys.stderr)

    data = collect_fred(start_date, end_date)

    output = {
        'collected_at': date.today().isoformat(),
        'period': {'start': start_date, 'end': end_date},
        'series': data,
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))
