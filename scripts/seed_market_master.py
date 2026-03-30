#!/usr/bin/env python3
"""
market_master 시드 스크립트
- pykrx로 KRX 전체 ETF 목록 자동 조회 (거래량 기준 상위 N개)
- yfinance로 이름 보완
- Supabase market_master에 upsert

Usage:
    python seed_market_master.py              # 기본 (KR top30 + US 전체)
    python seed_market_master.py --top 50     # KR ETF 상위 50개
    python seed_market_master.py --kr-only    # KR ETF만
    python seed_market_master.py --dry-run    # DB 저장 없이 목록만 출력
"""

import argparse
import os
import sys
from datetime import date, timedelta
from pathlib import Path

# .env.local 자동 로드
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

try:
    from supabase import create_client
except ImportError:
    print("ERROR: pip install supabase", file=sys.stderr)
    sys.exit(1)

try:
    from pykrx import stock as pykrx_stock
    HAS_PYKRX = True
except ImportError:
    HAS_PYKRX = False
    print("[WARN] pykrx 미설치 → KR ETF 자동 조회 불가. pip install pykrx", file=sys.stderr)

try:
    import yfinance as yf
    HAS_YF = True
except ImportError:
    HAS_YF = False
    print("[WARN] yfinance 미설치 → 이름 자동 보완 불가. pip install yfinance", file=sys.stderr)


# ── 수동 curated 목록 (pykrx 없을 때 fallback) ─────────────────────────────
# (코드, 이름, 섹터)
KR_ETF_CURATED = [
    # 국내 지수
    ("069500", "KODEX 200",                  "국내지수"),
    ("229200", "KODEX KOSDAQ150",             "국내지수"),
    ("102110", "TIGER 200",                   "국내지수"),
    ("122630", "KODEX 레버리지",              "레버리지"),
    ("251340", "KODEX 코스닥150레버리지",     "레버리지"),
    ("114800", "TIGER 200선물인버스2X",       "인버스"),
    ("252670", "KODEX 200선물인버스2X",       "인버스"),
    ("233740", "KODEX 코스닥150선물인버스",   "인버스"),
    # 해외 지수 (무환헤지)
    ("360750", "TIGER 미국S&P500",            "해외지수"),
    ("133690", "TIGER 미국나스닥100",         "해외지수"),
    ("278540", "KODEX 미국S&P500TR",          "해외지수"),
    ("379800", "KODEX 미국S&P500(H)",         "해외지수"),
    ("195930", "TIGER 미국나스닥100(H)",      "해외지수"),
    ("381170", "KODEX 미국빅테크TOP10TR",     "해외지수"),
    ("143850", "TIGER 미국S&P500선물(H)",     "해외지수"),
    ("411060", "ACE 미국500밸류",             "해외지수"),
    ("364980", "TIGER 미국테크TOP10INDXX",    "해외지수"),
    # 섹터
    ("305720", "KODEX 반도체",                "섹터"),
    ("139220", "TIGER 200IT",                 "섹터"),
    ("157490", "TIGER 200금융",               "섹터"),
    ("261240", "KODEX 2차전지산업",           "섹터"),
    ("148020", "KODEX 철강",                  "섹터"),
    ("091160", "KODEX 반도체",                "섹터"),
    ("091180", "KODEX 자동차",                "섹터"),
    ("102780", "KODEX 은행",                  "섹터"),
    # 채권/원자재
    ("114260", "KODEX 국채3년",               "채권"),
    ("130730", "KODEX 단기채권",              "채권"),
    ("272580", "TIGER 단기통안채",            "채권"),
    ("132030", "KODEX 골드선물(H)",           "원자재"),
    ("130680", "TIGER 원유선물Enhanced(H)",   "원자재"),
]

US_ETF_LIST = [
    # (symbol, name, sector)
    ("QQQ",  "Invesco QQQ Trust",          "해외지수"),
    ("SPY",  "SPDR S&P 500 ETF",           "해외지수"),
    ("IWM",  "iShares Russell 2000",        "해외지수"),
    ("GLD",  "SPDR Gold Shares",            "원자재"),
    ("TLT",  "iShares 20Y Treasury",        "채권"),
    ("SOXL", "Direxion Semi Bull 3X",       "레버리지"),
    ("TQQQ", "ProShares UltraPro QQQ",      "레버리지"),
    ("VTI",  "Vanguard Total Market",       "해외지수"),
    ("EFA",  "iShares MSCI EAFE",          "해외지수"),
    ("EEM",  "iShares MSCI Emerging",      "해외지수"),
    ("XLK",  "Technology Select SPDR",     "섹터"),
    ("XLF",  "Financial Select SPDR",      "섹터"),
    ("XLE",  "Energy Select SPDR",         "섹터"),
    ("ARKK", "ARK Innovation ETF",         "섹터"),
    ("SOXX", "iShares Semiconductor",      "섹터"),
]


def get_supabase():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
    return create_client(url, key)


def fetch_kr_etf_from_pykrx(top_n: int) -> list[tuple[str, str, str]]:
    """pykrx로 KRX 전체 ETF 목록 → 최근 거래량 기준 상위 N개 반환"""
    if not HAS_PYKRX:
        return []

    today = date.today()
    # 최근 영업일 기준 (주말 제외)
    check_date = today
    for _ in range(7):
        if check_date.weekday() < 5:
            break
        check_date -= timedelta(days=1)

    date_str = check_date.strftime("%Y%m%d")
    prev_date = (check_date - timedelta(days=7)).strftime("%Y%m%d")

    print(f"[pykrx] ETF 목록 조회 중 ({date_str})...", file=sys.stderr)
    try:
        tickers = pykrx_stock.get_etf_ticker_list(date_str)
    except Exception as e:
        print(f"[WARN] pykrx ETF 목록 조회 실패: {e}", file=sys.stderr)
        return []

    print(f"[pykrx] 전체 ETF {len(tickers)}개 발견", file=sys.stderr)

    # 거래량 데이터로 상위 N개 선별
    volume_data = []
    try:
        ohlcv = pykrx_stock.get_etf_ohlcv_by_ticker(date_str)
        if ohlcv is not None and not ohlcv.empty and "거래량" in ohlcv.columns:
            for ticker in tickers:
                if ticker in ohlcv.index:
                    vol = ohlcv.loc[ticker, "거래량"]
                    volume_data.append((ticker, int(vol) if vol == vol else 0))
                else:
                    volume_data.append((ticker, 0))
            volume_data.sort(key=lambda x: x[1], reverse=True)
            top_tickers = [t for t, _ in volume_data[:top_n]]
        else:
            top_tickers = list(tickers[:top_n])
    except Exception as e:
        print(f"[WARN] 거래량 정렬 실패, 순서대로 사용: {e}", file=sys.stderr)
        top_tickers = list(tickers[:top_n])

    # 이름 조회
    results = []
    for ticker in top_tickers:
        try:
            name = pykrx_stock.get_etf_ticker_name(ticker)
        except Exception:
            name = ticker
        results.append((ticker, name or ticker, "기타"))

    return results


def yf_validate_and_enrich(code_6: str, name: str) -> tuple[bool, str]:
    """yfinance로 .KS 심볼 유효성 확인 + 이름 보완"""
    if not HAS_YF:
        return True, name
    symbol = f"{code_6}.KS"
    try:
        t = yf.Ticker(symbol)
        info = t.fast_info
        # fast_info로 빠른 유효성 확인
        last_price = getattr(info, "last_price", None)
        if last_price is None or last_price != last_price:  # NaN
            return False, name
        # 이름 보완 시도
        full_info = t.info
        yf_name = full_info.get("longName") or full_info.get("shortName")
        if yf_name:
            name = yf_name
    except Exception:
        pass
    return True, name


def seed_kr_etfs(client, etf_list: list[tuple[str, str, str]], dry_run: bool) -> int:
    """KR ETF를 market_master에 upsert"""
    rows = []
    for code, name, sector in etf_list:
        symbol = f"{code}.KS"
        rows.append({
            "symbol":      symbol,
            "name":        name,
            "market_type": "KR",
            "asset_type":  "ETF",
            "region":      "KR",
            "currency":    "KRW",
            "sector":      sector,
        })

    if dry_run:
        print(f"\n[DRY-RUN] KR ETF {len(rows)}개:")
        for r in rows:
            print(f"  {r['symbol']:20s} {r['name']}")
        return len(rows)

    BATCH = 50
    total = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        client.table("market_master").upsert(
            batch, on_conflict="symbol"
        ).execute()
        total += len(batch)
        print(f"[OK] KR ETF upserted {total}/{len(rows)}", file=sys.stderr)
    return total


def seed_us_etfs(client, dry_run: bool) -> int:
    """US ETF를 market_master에 upsert"""
    rows = []
    for symbol, name, sector in US_ETF_LIST:
        rows.append({
            "symbol":      symbol,
            "name":        name,
            "market_type": "US",
            "asset_type":  "ETF",
            "region":      "US",
            "currency":    "USD",
            "sector":      sector,
        })

    if dry_run:
        print(f"\n[DRY-RUN] US ETF {len(rows)}개:")
        for r in rows:
            print(f"  {r['symbol']:10s} {r['name']}")
        return len(rows)

    client.table("market_master").upsert(rows, on_conflict="symbol").execute()
    print(f"[OK] US ETF {len(rows)}개 upserted", file=sys.stderr)
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description="market_master ETF 시드")
    parser.add_argument("--top", type=int, default=30, help="KR ETF 상위 N개 (기본 30)")
    parser.add_argument("--kr-only", action="store_true", help="KR ETF만 처리")
    parser.add_argument("--us-only", action="store_true", help="US ETF만 처리")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 목록만 출력")
    parser.add_argument("--no-pykrx", action="store_true", help="pykrx 사용 안함 (curated 목록만)")
    args = parser.parse_args()

    client = None if args.dry_run else get_supabase()
    total = 0

    if not args.us_only:
        # KR ETF 수집
        if HAS_PYKRX and not args.no_pykrx:
            kr_etfs = fetch_kr_etf_from_pykrx(args.top)
        else:
            kr_etfs = [(code, name, sector) for code, name, sector in KR_ETF_CURATED]
            print(f"[INFO] Curated 목록 사용: {len(kr_etfs)}개", file=sys.stderr)

        if kr_etfs:
            total += seed_kr_etfs(client, kr_etfs, args.dry_run)

    if not args.kr_only:
        total += seed_us_etfs(client, args.dry_run)

    print(f"\n[DONE] 총 {total}개 ETF {'확인됨' if args.dry_run else 'upserted'}")


if __name__ == "__main__":
    main()
