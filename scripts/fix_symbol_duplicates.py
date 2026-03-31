#!/usr/bin/env python3
"""
market_master 심볼 중복 정리
005930 (6자리) vs 005930.KS 같이 동일 종목이 두 번 등록된 경우:
  1. .KS 버전을 정규 심볼로 유지
  2. 6자리 버전 → daily_indicators, ai_predictions, signal_history 참조를 .KS 버전으로 이전
  3. 6자리 버전 market_master 레코드 삭제

Usage:
    python fix_symbol_duplicates.py --dry-run    # 중복 목록만 확인
    python fix_symbol_duplicates.py              # 실제 정리 실행
"""

import argparse
import os
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


def get_client():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 필요")
    return create_client(url, key)


def find_duplicates(client) -> list[tuple[dict, dict]]:
    """(6자리 레코드, .KS 레코드) 쌍 목록 반환"""
    res = client.table("market_master").select("id,symbol,name,market_type,asset_type").execute()
    rows = res.data or []

    # 6자리 코드 → 레코드 매핑
    plain: dict[str, dict] = {}  # "005930" → row
    ks:    dict[str, dict] = {}  # "005930" → row for "005930.KS"

    for row in rows:
        sym = row["symbol"]
        if sym.isdigit() and len(sym) == 6:
            plain[sym] = row
        elif sym.endswith(".KS") and sym[:-3].isdigit() and len(sym[:-3]) == 6:
            ks[sym[:-3]] = row

    duplicates = []
    for code, plain_row in plain.items():
        if code in ks:
            duplicates.append((plain_row, ks[code]))

    return duplicates


def migrate_references(client, old_id: int, new_id: int, symbol: str, dry_run: bool):
    """daily_indicators에서 old_id 레코드 전체 삭제 (.KS 버전 new_id 데이터를 정본으로 유지)"""
    res = client.table("daily_indicators").select("id").eq("market_master_id", old_id).execute()
    rows = res.data or []
    count = len(rows)
    print(f"  daily_indicators: {count}건 (6자리 버전) 삭제, .KS 버전 유지", end="")

    if dry_run:
        print(" [DRY-RUN]")
        return

    if count > 0:
        # old_id 레코드 전체 삭제 (.KS 버전 데이터가 정본)
        client.table("daily_indicators").delete().eq("market_master_id", old_id).execute()

    print(" OK")


def main():
    parser = argparse.ArgumentParser(description="market_master 심볼 중복 정리")
    parser.add_argument("--dry-run", action="store_true", help="변경 없이 중복 목록만 출력")
    args = parser.parse_args()

    client = get_client()
    duplicates = find_duplicates(client)

    if not duplicates:
        print("중복 심볼 없음. 정리 불필요.")
        return

    print(f"중복 심볼 {len(duplicates)}건 발견:\n")
    for plain_row, ks_row in duplicates:
        print(f"  [{plain_row['id']}] {plain_row['symbol']}  ←삭제예정")
        print(f"  [{ks_row['id']}]  {ks_row['symbol']}  ←유지")
        print()

    if args.dry_run:
        print("[DRY-RUN] 실제 변경 없음. --dry-run 없이 실행하면 정리됩니다.")
        return

    confirm = input(f"{len(duplicates)}건의 중복 레코드를 정리하겠습니까? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("취소됨.")
        return

    for plain_row, ks_row in duplicates:
        old_id = plain_row["id"]
        new_id = ks_row["id"]
        symbol = plain_row["symbol"]
        print(f"\n[{symbol}] id={old_id} → {symbol}.KS id={new_id}")
        migrate_references(client, old_id, new_id, symbol, dry_run=False)

        # market_master에서 plain 레코드 삭제
        client.table("market_master").delete().eq("id", old_id).execute()
        print(f"  market_master id={old_id} 삭제 OK")

    print(f"\n[DONE] {len(duplicates)}건 정리 완료")


if __name__ == "__main__":
    main()
