#!/usr/bin/env python3
"""
market_master KR 종목명 수정 스크립트
- name 컬럼이 심볼값(005935.KS 등)으로 채워진 레코드를 찾아
  pykrx로 실제 한국어 종목명(삼성SDI 등)을 조회해 업데이트

Usage:
    python fix_kr_stock_names.py --dry-run   # 변경 내용 미리 보기
    python fix_kr_stock_names.py             # 실제 DB 업데이트
"""

import argparse
import os
import re
import sys
from pathlib import Path

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
    print("ERROR: pip install pykrx", file=sys.stderr)
    sys.exit(1)

# 심볼처럼 보이는 name 패턴: 숫자만으로 구성되거나 숫자+.KS/.KQ 형태
_SYMBOL_LIKE = re.compile(r'^\d{4,6}(\.(KS|KQ|KPK))?$', re.IGNORECASE)


def get_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
    return create_client(url, key)


def extract_code(symbol: str) -> str:
    """005935.KS → 005935"""
    return re.sub(r'\.(KS|KQ|KPK)$', '', symbol, flags=re.IGNORECASE)


def lookup_name(code: str, asset_type: str) -> str | None:
    """pykrx로 종목명 조회 (ETF / STOCK 구분)"""
    try:
        if asset_type == 'ETF':
            name = pykrx_stock.get_etf_ticker_name(code)
        else:
            name = pykrx_stock.get_market_ticker_name(code)
        return name if name else None
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser(description="KR 종목명 DB 수정")
    parser.add_argument("--dry-run", action="store_true", help="변경 없이 목록만 출력")
    args = parser.parse_args()

    client = get_client()

    # market_master에서 KR 종목 전체 조회
    res = client.table("market_master") \
        .select("id,symbol,name,asset_type,market_type") \
        .eq("market_type", "KR") \
        .execute()
    rows = res.data or []

    # name이 심볼처럼 생긴 레코드만 필터
    to_fix = [r for r in rows if _SYMBOL_LIKE.match(r.get("name", "") or "")]

    if not to_fix:
        print("수정이 필요한 레코드 없음.")
        return

    print(f"수정 대상 {len(to_fix)}개:\n")

    updates = []
    for row in to_fix:
        code = extract_code(row["symbol"])
        asset_type = row.get("asset_type") or "EQUITY"
        new_name = lookup_name(code, asset_type)

        if new_name:
            print(f"  [{row['id']}] {row['symbol']}  {row['name']}  →  {new_name}")
            updates.append({"id": row["id"], "new_name": new_name})
        else:
            print(f"  [{row['id']}] {row['symbol']}  {row['name']}  →  [이름 조회 실패, 건너뜀]")

    print(f"\n총 {len(updates)}건 업데이트 예정")

    if args.dry_run:
        print("\n[DRY-RUN] 실제 변경 없음.")
        return

    if not updates:
        print("업데이트할 항목 없음.")
        return

    confirm = input(f"\n{len(updates)}건을 DB에 반영하겠습니까? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("취소됨.")
        return

    ok = 0
    for u in updates:
        try:
            client.table("market_master") \
                .update({"name": u["new_name"]}) \
                .eq("id", u["id"]) \
                .execute()
            ok += 1
        except Exception as e:
            print(f"  [ERROR] id={u['id']}: {e}", file=sys.stderr)

    print(f"\n[DONE] {ok}/{len(updates)}건 업데이트 완료")


if __name__ == "__main__":
    main()
