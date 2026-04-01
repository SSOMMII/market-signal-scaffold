"""
DB에 저장된 name 값의 실제 인코딩 확인
"""
import os
from pathlib import Path

_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

from supabase import create_client
url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

# 몇 개만 확인
symbols = ["051910.KS", "000270.KS", "006400.KS"]
res = client.table("market_master").select("symbol,name").in_("symbol", symbols).execute()

print("=== DB name 실제값 (hex bytes) ===")
for r in res.data:
    name = r.get("name", "")
    # UTF-8 바이트를 hex로 출력 → 한글 여부 판별
    name_bytes = name.encode("utf-8")
    name_hex = name_bytes.hex()
    # 한글 UTF-8: e2 ~ ef 범위
    is_korean_utf8 = any(b >= 0xAC and b <= 0xD7 for b in name_bytes[::3])

    try:
        # CP949로 encode 가능하면 → 한글이 올바르게 저장된 것
        name_cp949 = name.encode("cp949")
        print(f"  {r['symbol']:20s}  name(utf8)={name_bytes!r}")
        print(f"    → cp949 가능: {name_cp949!r}")
    except UnicodeEncodeError:
        print(f"  {r['symbol']:20s}  name(utf8)={name_bytes!r}  [cp949 변환 불가 - 깨진 인코딩일 가능성]")

# 예상값 비교
print()
print("=== pykrx 현재 반환값 ===")
try:
    from pykrx import stock
    for code in ["051910", "000270", "006400"]:
        name = stock.get_market_ticker_name(code)
        print(f"  {code}  pykrx={name!r}  bytes={name.encode('utf-8')!r}")
except Exception as e:
    print(f"  pykrx 오류: {e}")
