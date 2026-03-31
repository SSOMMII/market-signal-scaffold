#!/usr/bin/env python3
"""
Supabase upsert 파이프라인
collect_yfinance.py / collect_fred.py 의 JSON 출력을 받아 Supabase 테이블에 upsert

사용 예:
    python collect_yfinance.py 30d | python upsert_supabase.py --mode yfinance
    python collect_fred.py          | python upsert_supabase.py --mode fred
    python upsert_supabase.py --mode snapshot   # 글로벌 스냅샷만

환경변수 필요:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY   (anon key 대신 service role key 사용 — INSERT 권한)
"""

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

# .env.local 자동 로드 (Next.js 프로젝트 루트 기준)
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

try:
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase-py 패키지가 필요합니다.", file=sys.stderr)
    print("설치: pip install supabase", file=sys.stderr)
    sys.exit(1)


# ── Supabase 클라이언트 ──────────────────────────────────────────────
def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요."
        )
    return create_client(url, key)


# ── yfinance 모드: daily_indicators + global_indicators upsert ───────
# 심볼 → market_master 조회 캐시
_master_cache: dict[str, int | None] = {}


def get_master_id(client: Client, symbol: str) -> int | None:
    if symbol in _master_cache:
        return _master_cache[symbol]
    res = (
        client.table("market_master")
        .select("id")
        .eq("symbol", symbol)
        .maybe_single()
        .execute()
    )
    mid = res.data["id"] if (res and res.data) else None
    _master_cache[symbol] = mid
    return mid


def ensure_market_master(client: Client, symbol: str) -> int:
    """market_master에 없으면 자동 삽입 후 id 반환"""
    mid = get_master_id(client, symbol)
    if mid is not None:
        return mid

    # 심볼 패턴으로 market_type / asset_type 추론
    market_type = "US"
    asset_type = "INDEX"

    if symbol.startswith("^KS"):
        market_type, asset_type = "KR", "INDEX"
    elif symbol.endswith("=F"):
        asset_type = "FUTURE"
    elif symbol.endswith("=X"):
        asset_type = "FX"
    elif symbol.endswith(".KS"):
        market_type = "KR"
        # market_master에 이미 seed된 ETF는 조회로 확인, 신규 .KS 심볼은 STOCK으로 기본 처리
        # (seed_market_master.py로 ETF를 먼저 등록하면 get_master_id에서 기존 레코드 반환)
        asset_type = "STOCK"
    elif symbol.upper() in {"QQQ", "SPY", "IWM", "GLD", "TLT", "SOXL", "TQQQ",
                             "VTI", "EFA", "EEM", "XLK", "XLF", "XLE", "ARKK", "SOXX"}:
        asset_type = "ETF"

    res = (
        client.table("market_master")
        .insert({
            "symbol": symbol,
            "name": symbol,
            "market_type": market_type,
            "asset_type": asset_type,
        })
        .execute()
    )
    new_id = res.data[0]["id"]
    _master_cache[symbol] = new_id
    print(f"[NEW] market_master: {symbol} → id={new_id}", file=sys.stderr)
    return new_id


def upsert_yfinance(client: Client, payload: dict) -> None:
    records = payload.get("records", [])
    snapshot = payload.get("global_snapshot", {})

    # 1) daily_indicators upsert
    rows = []
    for r in records:
        master_id = ensure_market_master(client, r["symbol"])
        row: dict = {
            "market_master_id": master_id,
            "as_of_date": r["date"],
            "open":   r.get("open"),
            "high":   r.get("high"),
            "low":    r.get("low"),
            "close":  r.get("close"),
            "volume": r.get("volume"),
        }
        # 기술적 지표 컬럼 (pandas_ta로 계산된 경우에만 포함)
        # numeric(8,4) 컬럼: 절대값 9999 초과 시 None으로 처리 (KRW 종목 overflow 방지)
        _BOUNDED = {"macd", "signal_line"}  # numeric(8,4) — KRW 종목에서 초과 가능
        for col in ("rsi", "macd", "signal_line", "sma_50", "sma_120", "sma_200",
                    "bollinger_upper", "bollinger_middle", "bollinger_lower",
                    "stoch_k", "stoch_d"):
            val = r.get(col)
            if val is not None:
                if col in _BOUNDED and abs(float(val)) >= 9999:
                    val = None  # overflow 방지
                row[col] = val
        rows.append(row)

    # 배치 100건씩
    BATCH = 100
    for i in range(0, len(rows), BATCH):
        batch = rows[i: i + BATCH]
        client.table("daily_indicators").upsert(
            batch, on_conflict="market_master_id,as_of_date"
        ).execute()
        print(f"[OK] daily_indicators upserted {i + len(batch)}/{len(rows)}", file=sys.stderr)

    # 2) global_indicators upsert (스냅샷)
    if snapshot:
        ts = snapshot.get("as_of_timestamp", date.today().isoformat()) + "T00:00:00+00:00"
        row = {
            "as_of_timestamp": ts,
            "sp500":   snapshot.get("sp500"),
            "nasdaq":  snapshot.get("nasdaq"),
            "vix":     snapshot.get("vix"),
            "wti":     snapshot.get("wti"),
            "gold":    snapshot.get("gold"),
            "usd_krw": snapshot.get("usd_krw"),
        }
        client.table("global_indicators").upsert(
            row, on_conflict="as_of_timestamp"
        ).execute()
        print("[OK] global_indicators snapshot upserted", file=sys.stderr)


# ── FRED 모드: global_indicators에 거시경제 시계열 upsert ────────────
# FRED series → global_indicators 컬럼 매핑
FRED_COL_MAP = {
    "FEDFUNDS": None,     # global_indicators에 컬럼 없음 → 추후 macro 테이블 확장 시 사용
    "DGS10":    None,
    "DEXKOUS":  "usd_krw",
}


def upsert_fred(client: Client, payload: dict) -> None:
    series = payload.get("series", {})

    # usd_krw 시계열만 global_indicators에 반영 (나머지는 macro 테이블 확장 후 처리)
    krw_series = series.get("DEXKOUS", {}).get("data", [])
    if not krw_series:
        print("[INFO] FRED: DEXKOUS 데이터 없음. 건너뜀.", file=sys.stderr)
        return

    rows = []
    for item in krw_series:
        ts = item["date"] + "T00:00:00+00:00"
        rows.append({
            "as_of_timestamp": ts,
            "usd_krw": item["value"],
        })

    BATCH = 100
    for i in range(0, len(rows), BATCH):
        batch = rows[i: i + BATCH]
        client.table("global_indicators").upsert(
            batch, on_conflict="as_of_timestamp"
        ).execute()
        print(f"[OK] global_indicators (DEXKOUS) upserted {i + len(batch)}/{len(rows)}", file=sys.stderr)


# ── snapshot 모드: yfinance 스냅샷만 직접 수집하여 upsert ────────────
def upsert_snapshot_only(client: Client) -> None:
    try:
        import yfinance as yf
    except ImportError:
        print("ERROR: yfinance 패키지가 필요합니다.", file=sys.stderr)
        sys.exit(1)

    targets = {
        "sp500": "^GSPC", "nasdaq": "^IXIC", "vix": "^VIX",
        "wti": "CL=F", "gold": "GC=F", "usd_krw": "USDKRW=X",
    }
    snapshot: dict = {}
    for key, sym in targets.items():
        try:
            hist = yf.Ticker(sym).history(period="1d")
            if not hist.empty:
                snapshot[key] = round(float(hist["Close"].iloc[-1]), 6)
        except Exception as e:
            print(f"[WARN] {sym}: {e}", file=sys.stderr)
            snapshot[key] = None

    ts = date.today().isoformat() + "T00:00:00+00:00"
    row = {"as_of_timestamp": ts, **snapshot}
    client.table("global_indicators").upsert(row, on_conflict="as_of_timestamp").execute()
    print(f"[OK] snapshot upserted: {snapshot}", file=sys.stderr)


# ── main ─────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Supabase upsert pipeline")
    parser.add_argument(
        "--mode",
        choices=["yfinance", "fred", "snapshot"],
        required=True,
        help="입력 데이터 종류",
    )
    parser.add_argument(
        "--input", "-i",
        default=None,
        help="JSON 입력 파일 경로 (생략 시 stdin). PowerShell 환경에서 파이프 대신 사용",
    )
    args = parser.parse_args()

    client = get_client()

    if args.mode == "snapshot":
        upsert_snapshot_only(client)
        return

    # --input 파일 지정 시 파일에서 읽기, 아니면 stdin
    if args.input:
        try:
            raw = Path(args.input).read_text(encoding="utf-8-sig").strip()
        except FileNotFoundError:
            print(f"ERROR: 파일을 찾을 수 없습니다: {args.input}", file=sys.stderr)
            sys.exit(1)
    else:
        raw = sys.stdin.read().strip()

    if not raw:
        print("ERROR: JSON 데이터가 없습니다. --input 파일을 지정하거나 stdin으로 전달하세요.", file=sys.stderr)
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON 파싱 실패: {e}", file=sys.stderr)
        sys.exit(1)

    if args.mode == "yfinance":
        upsert_yfinance(client, payload)
    elif args.mode == "fred":
        upsert_fred(client, payload)

    print("[DONE]", file=sys.stderr)


if __name__ == "__main__":
    main()
