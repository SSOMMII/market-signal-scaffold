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

# 051910.KS 한 건만 정확히 조회
res = client.table("market_master").select("id,symbol,name").in_("symbol", [
    "051910.KS", "018260.KS", "009150.KS", "000270.KS", "066570.KS"
]).execute()

for r in res.data:
    name = r['name']
    print(f"symbol={r['symbol']}  name={name}  is_digit={name.replace('.','').replace('KS','').isdigit()}")
