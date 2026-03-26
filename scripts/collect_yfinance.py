#!/usr/bin/env python3
"""
yfinance 기반 미국 ETF/주식/선물/환율 데이터 수집기
- Reuters API 대체
- API 키 없이 Yahoo Finance 기반으로 OHLCV, 배당, 섹터 정보 수집 가능
- 출력: JSON (Supabase daily_indicators 및 global_indicators 테이블 upsert용)

Usage:
    python collect_yfinance.py            # 최근 5일치
    python collect_yfinance.py 30d        # 최근 30일치
    python collect_yfinance.py 2025-01-01 2025-03-26  # 날짜 범위 지정
"""

import json
import sys
from datetime import date, timedelta

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("ERROR: yfinance, pandas 패키지가 필요합니다.", file=sys.stderr)
    print("설치: pip install yfinance pandas", file=sys.stderr)
    sys.exit(1)

# 수집 대상 종목 목록
TARGETS = {
    'ETF': ['QQQ', 'SPY', 'IWM', 'GLD', 'TLT', 'SOXL', 'TQQQ'],
    'INDEX': ['^GSPC', '^IXIC', '^DJI', '^VIX', '^KS11'],   # S&P500, 나스닥, 다우, VIX, KOSPI
    'FUTURES': ['NQ=F', 'ES=F', 'YM=F'],                      # 나스닥/S&P/다우 선물
    'FX': ['USDKRW=X', 'EURUSD=X', 'JPY=X'],                 # 원달러, 유로달러, 달러엔
    'COMMODITY': ['GC=F', 'CL=F'],                             # 금/WTI 원유 선물
}


def collect_ohlcv(period: str = '5d') -> list[dict]:
    """기간(period) 기반 수집 (예: '5d', '1mo', '3mo')"""
    results = []
    all_symbols = [s for group in TARGETS.values() for s in group]

    for symbol in all_symbols:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period=period, auto_adjust=True)

            for ts, row in hist.iterrows():
                results.append({
                    'symbol': symbol,
                    'date': str(ts.date()),
                    'open': _safe_float(row.get('Open')),
                    'high': _safe_float(row.get('High')),
                    'low': _safe_float(row.get('Low')),
                    'close': _safe_float(row.get('Close')),
                    'volume': _safe_int(row.get('Volume')),
                })
        except Exception as e:
            print(f"[WARN] {symbol}: {e}", file=sys.stderr)

    return results


def collect_by_date(start_date: str, end_date: str) -> list[dict]:
    """날짜 범위 기반 수집 (YYYY-MM-DD 형식)"""
    results = []
    all_symbols = [s for group in TARGETS.values() for s in group]

    for symbol in all_symbols:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=start_date, end=end_date, auto_adjust=True)

            for ts, row in hist.iterrows():
                results.append({
                    'symbol': symbol,
                    'date': str(ts.date()),
                    'open': _safe_float(row.get('Open')),
                    'high': _safe_float(row.get('High')),
                    'low': _safe_float(row.get('Low')),
                    'close': _safe_float(row.get('Close')),
                    'volume': _safe_int(row.get('Volume')),
                })
        except Exception as e:
            print(f"[WARN] {symbol}: {e}", file=sys.stderr)

    return results


def collect_global_snapshot() -> dict:
    """글로벌 핵심 지표 현재값 스냅샷 (global_indicators 테이블용)"""
    snapshot_targets = {
        'sp500': '^GSPC',
        'nasdaq': '^IXIC',
        'vix': '^VIX',
        'wti': 'CL=F',
        'gold': 'GC=F',
        'usd_krw': 'USDKRW=X',
    }

    snapshot = {}
    for key, symbol in snapshot_targets.items():
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period='1d')
            if not hist.empty:
                snapshot[key] = _safe_float(hist['Close'].iloc[-1])
        except Exception as e:
            print(f"[WARN] snapshot {key} ({symbol}): {e}", file=sys.stderr)
            snapshot[key] = None

    snapshot['as_of_timestamp'] = date.today().isoformat()
    return snapshot


def _safe_float(val) -> float | None:
    try:
        v = float(val)
        return round(v, 6) if not (v != v) else None  # NaN check
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> int | None:
    try:
        v = float(val)
        return int(v) if not (v != v) else None
    except (TypeError, ValueError):
        return None


if __name__ == '__main__':
    args = sys.argv[1:]

    if len(args) == 2:
        # 날짜 범위 지정: python collect_yfinance.py 2025-01-01 2025-03-26
        data = collect_by_date(args[0], args[1])
    elif len(args) == 1 and '-' in args[0] and len(args[0]) == 10:
        # 단일 날짜 (당일만)
        data = collect_by_date(args[0], args[0])
    else:
        # 기간 지정 또는 기본값
        period = args[0] if args else '5d'
        data = collect_ohlcv(period)

    output = {
        'collected_at': date.today().isoformat(),
        'count': len(data),
        'records': data,
        'global_snapshot': collect_global_snapshot(),
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))
