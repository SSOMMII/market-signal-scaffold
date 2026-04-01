import os, re
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

SYMBOL_LIKE = re.compile(r'^\d{4,6}(\.(KS|KQ|KPK))?$', re.IGNORECASE)

res = client.table("market_master").select("id,symbol,name,market_type,asset_type").execute()
rows = res.data or []

bad = [r for r in rows if SYMBOL_LIKE.match(r.get("name","") or "")]
good_kr = [r for r in rows if r.get("market_type") == "KR" and not SYMBOL_LIKE.match(r.get("name","") or "")]

print(f"전체 레코드: {len(rows)}개")
print(f"한글명 정상 KR 종목: {len(good_kr)}개")
print(f"아직 숫자(심볼)로 남은 레코드: {len(bad)}개")
if bad:
    for r in bad:
        print(f"  [{r['id']}] {r['symbol']:20s}  name={r['name']}  ({r['market_type']}/{r['asset_type']})")
