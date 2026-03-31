#!/usr/bin/env python3
"""
yfinance 기반 미국 ETF/주식/선물/환율 데이터 수집기
- Reuters API 대체
- API 키 없이 Yahoo Finance 기반으로 OHLCV, 배당, 섹터 정보 수집 가능
- 출력: JSON (Supabase daily_indicators 및 global_indicators 테이블 upsert용)
- 한국 지수(^KS11, ^KQ11) OHLC: pykrx 우선 사용 (yfinance는 OHLC null 반환)

Usage:
    python collect_yfinance.py            # 최근 5일치
    python collect_yfinance.py 30d        # 최근 30일치
    python collect_yfinance.py 2025-01-01 2025-03-26  # 날짜 범위 지정
"""

import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# .env.local 자동 로드
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _, _v = _line.partition("=")
            os.environ.setdefault(_k.strip(), _v.strip())

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("ERROR: yfinance, pandas 패키지가 필요합니다.", file=sys.stderr)
    print("설치: pip install yfinance pandas", file=sys.stderr)
    sys.exit(1)

try:
    import ta as _ta
    _HAS_TA = True
except ImportError:
    _HAS_TA = False
    print("[WARN] ta 미설치 → 기술적 지표 계산 생략. 설치: pip install ta", file=sys.stderr)

# pykrx: 한국 지수 OHLC 전용 (yfinance는 ^KS11/^KQ11 OHLC를 null로 반환)
try:
    from pykrx import stock as _pykrx
    _HAS_PYKRX = True
except ImportError:
    _HAS_PYKRX = False
    print("[WARN] pykrx 미설치 → 한국 지수 OHLC 수집 생략. 설치: pip install pykrx", file=sys.stderr)

# pykrx 지수 코드 매핑 (yfinance 심볼 → pykrx 코드)
_PYKRX_INDEX_MAP = {
    '^KS11': '1001',   # KOSPI
    '^KQ11': '2001',   # KOSDAQ
}

# 고정 수집 대상 (지수/선물/환율 — DB 관리 대상 아님)
_FIXED_TARGETS = [
    '^GSPC', '^IXIC', '^DJI', '^VIX', '^KS11', '^KQ11',  # INDEX
    'NQ=F', 'ES=F', 'YM=F',                               # FUTURES
    'USDKRW=X', 'EURUSD=X', 'JPY=X',                      # FX
    'GC=F', 'CL=F',                                        # COMMODITY
]

# ETF/STOCK 기본값 (DB 로드 실패 시 fallback)
_FALLBACK_ETF_STOCK = [
    'QQQ', 'SPY', 'IWM', 'GLD', 'TLT', 'SOXL', 'TQQQ',
    '069500.KS', '229200.KS', '360750.KS', '305720.KS', '114800.KS',
    '005930.KS', '000660.KS', '035420.KS', '035720.KS', '005380.KS',
]


def _normalize_kr_symbol(symbol: str) -> str:
    """6자리 KR 종목코드에 .KS 접미사 추가 (yfinance 형식)"""
    if symbol.isdigit() and len(symbol) == 6:
        return symbol + '.KS'
    return symbol


def _load_etf_stock_from_db() -> list[str]:
    """Supabase market_master에서 ETF/STOCK 심볼 목록 로드. 실패 시 fallback 반환."""
    try:
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise EnvironmentError("Supabase 환경변수 없음")
        client = create_client(url, key)
        res = (
            client.table("market_master")
            .select("symbol")
            .in_("asset_type", ["ETF", "STOCK"])
            .execute()
        )
        symbols = [_normalize_kr_symbol(r["symbol"]) for r in (res.data or [])]
        if symbols:
            print(f"[DB] market_master에서 {len(symbols)}개 종목 로드", file=sys.stderr)
            return symbols
    except Exception as e:
        print(f"[WARN] DB 로드 실패, fallback 사용: {e}", file=sys.stderr)
    return _FALLBACK_ETF_STOCK

# 지표 계산에 필요한 최소 데이터 기간 (SMA200 기준)
_INDICATOR_FETCH_PERIOD = '1y'


def _compute_indicators(hist: 'pd.DataFrame') -> 'pd.DataFrame':
    """ta 라이브러리로 기술적 지표 계산"""
    if not _HAS_TA or hist.empty:
        return hist

    close = hist['Close']
    high  = hist['High']
    low   = hist['Low']

    # RSI(14)
    hist['rsi'] = _ta.momentum.RSIIndicator(close, window=14).rsi()

    # MACD(12,26,9)
    macd_obj = _ta.trend.MACD(close, window_fast=12, window_slow=26, window_sign=9)
    hist['macd']        = macd_obj.macd()
    hist['signal_line'] = macd_obj.macd_signal()

    # SMA
    hist['sma_50']  = _ta.trend.SMAIndicator(close, window=50).sma_indicator()
    hist['sma_120'] = _ta.trend.SMAIndicator(close, window=120).sma_indicator()
    hist['sma_200'] = _ta.trend.SMAIndicator(close, window=200).sma_indicator()

    # Bollinger Bands(20, 2)
    bb = _ta.volatility.BollingerBands(close, window=20, window_dev=2)
    hist['bollinger_upper']  = bb.bollinger_hband()
    hist['bollinger_middle'] = bb.bollinger_mavg()
    hist['bollinger_lower']  = bb.bollinger_lband()

    # Stochastic(14, 3)
    stoch = _ta.momentum.StochasticOscillator(high, low, close, window=14, smooth_window=3)
    hist['stoch_k'] = stoch.stoch()
    hist['stoch_d'] = stoch.stoch_signal()

    return hist


def _period_to_rows(period: str) -> int:
    """period 문자열 → 거래일(행) 수 근사값"""
    if period.endswith('d'):
        return int(period[:-1])
    if period.endswith('mo'):
        return int(period[:-2]) * 22
    if period.endswith('y'):
        return int(period[:-1]) * 252
    return 252  # 알 수 없는 경우 1년치


def _row_to_record(symbol: str, ts, row) -> dict:
    return {
        'symbol':           symbol,
        'date':             str(ts.date()),
        'open':             _safe_float(row.get('Open')),
        'high':             _safe_float(row.get('High')),
        'low':              _safe_float(row.get('Low')),
        'close':            _safe_float(row.get('Close')),
        'volume':           _safe_int(row.get('Volume')),
        'rsi':              _safe_float(row.get('rsi')),
        'macd':             _safe_float(row.get('macd')),
        'signal_line':      _safe_float(row.get('signal_line')),
        'sma_50':           _safe_float(row.get('sma_50')),
        'sma_120':          _safe_float(row.get('sma_120')),
        'sma_200':          _safe_float(row.get('sma_200')),
        'bollinger_upper':  _safe_float(row.get('bollinger_upper')),
        'bollinger_middle': _safe_float(row.get('bollinger_middle')),
        'bollinger_lower':  _safe_float(row.get('bollinger_lower')),
        'stoch_k':          _safe_float(row.get('stoch_k')),
        'stoch_d':          _safe_float(row.get('stoch_d')),
    }


def _collect_kr_index_ohlcv_pykrx(symbol: str, start_date: str, end_date: str) -> list[dict]:
    """pykrx로 한국 지수(KOSPI/KOSDAQ) OHLCV 수집 — yfinance OHLC null 보완"""
    if not _HAS_PYKRX:
        return []
    idx_code = _PYKRX_INDEX_MAP.get(symbol)
    if not idx_code:
        return []
    try:
        fmt_start = start_date.replace('-', '')
        fmt_end   = end_date.replace('-', '')
        df = _pykrx.get_index_ohlcv_by_date(fmt_start, fmt_end, idx_code)
        if df is None or df.empty:
            return []
        records = []
        for ts, row in df.iterrows():
            records.append({
                'symbol': symbol,
                'date':   str(ts.date()),
                'open':   _safe_float(row.get('시가')),
                'high':   _safe_float(row.get('고가')),
                'low':    _safe_float(row.get('저가')),
                'close':  _safe_float(row.get('종가')),
                'volume': _safe_int(row.get('거래량')),
                'rsi': None, 'macd': None, 'signal_line': None,
                'sma_50': None, 'sma_120': None, 'sma_200': None,
                'bollinger_upper': None, 'bollinger_middle': None, 'bollinger_lower': None,
                'stoch_k': None, 'stoch_d': None,
            })
        print(f"[pykrx] {symbol}: {len(records)}건 수집", file=sys.stderr)
        return records
    except Exception as e:
        print(f"[WARN] pykrx {symbol}: {e}", file=sys.stderr)
        return []


def collect_ohlcv(period: str = '5d') -> list[dict]:
    """기간(period) 기반 수집 — 지표 계산을 위해 내부적으로 1년치 데이터 사용"""
    results = []
    all_symbols = _FIXED_TARGETS + _load_etf_stock_from_db()
    req_rows = _period_to_rows(period)

    # 한국 지수는 pykrx로 우선 수집
    kr_index_symbols = set(_PYKRX_INDEX_MAP.keys())
    kr_collected: set[str] = set()
    if _HAS_PYKRX:
        today_str = date.today().isoformat()
        days_back = req_rows + 10  # 거래일 기준 여유분
        start_str = (date.today() - timedelta(days=days_back)).isoformat()
        for sym in kr_index_symbols:
            rows = _collect_kr_index_ohlcv_pykrx(sym, start_str, today_str)
            if rows:
                results.extend(rows[-req_rows:])
                kr_collected.add(sym)

    for symbol in all_symbols:
        # pykrx로 이미 수집한 한국 지수는 yfinance 중복 수집 스킵
        if symbol in kr_collected:
            continue
        try:
            ticker = yf.Ticker(symbol)
            # 지표 계산용으로 항상 1년치 fetch
            hist = ticker.history(period=_INDICATOR_FETCH_PERIOD, auto_adjust=True)
            if hist.empty:
                continue

            hist = _compute_indicators(hist)

            # 요청된 기간만 반환
            hist_sliced = hist.tail(req_rows)
            for ts, row in hist_sliced.iterrows():
                results.append(_row_to_record(symbol, ts, row))

        except Exception as e:
            print(f"[WARN] {symbol}: {e}", file=sys.stderr)

    return results


def collect_by_date(start_date: str, end_date: str) -> list[dict]:
    """날짜 범위 기반 수집 (YYYY-MM-DD 형식)"""
    from datetime import datetime, date as _date
    results = []
    all_symbols = _FIXED_TARGETS + _load_etf_stock_from_db()

    # 한국 지수는 pykrx로 우선 수집
    kr_index_symbols = set(_PYKRX_INDEX_MAP.keys())
    kr_collected: set[str] = set()
    if _HAS_PYKRX:
        for sym in kr_index_symbols:
            rows = _collect_kr_index_ohlcv_pykrx(sym, start_date, end_date)
            if rows:
                results.extend(rows)
                kr_collected.add(sym)

    # 지표 계산용 fetch start (300 캘린더일 앞)
    fetch_start = (datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=300)).strftime('%Y-%m-%d')

    for symbol in all_symbols:
        if symbol in kr_collected:
            continue
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(start=fetch_start, end=end_date, auto_adjust=True)
            if hist.empty:
                continue

            hist = _compute_indicators(hist)

            # 요청된 날짜 범위만 반환 (타임존 무관하게 date 레벨 비교)
            start_d = _date.fromisoformat(start_date)
            hist_sliced = hist[[d.date() >= start_d for d in hist.index]]
            for ts, row in hist_sliced.iterrows():
                results.append(_row_to_record(symbol, ts, row))

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
