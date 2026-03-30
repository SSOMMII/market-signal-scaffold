#!/usr/bin/env python3
"""
AI 예측 신뢰도 확인 (인코딩 에러 없음)
"""

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
    print("ERROR: supabase package not installed", file=sys.stderr)
    sys.exit(1)

def check_confidence_distribution():
    """Check confidence distribution after model retraining"""
    print("\n=== AI Confidence Distribution (After Retraining) ===\n")
    
    try:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set")
        
        client = create_client(url, key)
        
        # Get latest data
        res = client.table("ai_predictions").select("ticker, date, signal_score, signal_label, lgbm_prob").order("date", desc=True).limit(30).execute()
        
        rows = res.data or []
        if not rows:
            print("No data found\n")
            return
        
        print(f"[Total Records: {len(rows)}]\n")
        print(f"{'Ticker':<10} {'Date':<12} {'Score':<6} {'Label':<10} {'Confidence':<12}")
        print("-" * 50)
        
        probs = []
        for row in rows:
            ticker = (row['ticker'] or 'N/A')[:10]
            date = (row['date'] or 'N/A')[:10]
            score = f"{row['signal_score']:.1f}" if row['signal_score'] else 'N/A'
            label = (row['signal_label'] or 'NULL')[:10]
            conf = f"{row['lgbm_prob']:.4f}" if row['lgbm_prob'] else 'NULL'
            
            print(f"{ticker:<10} {date:<12} {score:<6} {label:<10} {conf:<12}")
            
            if row['lgbm_prob'] is not None:
                probs.append(row['lgbm_prob'])
        
        if not probs:
            print("\nNo confidence data available\n")
            return
        
        print("\n[Confidence Statistics]")
        probs_sorted = sorted(probs)
        print(f"Count: {len(probs)}")
        print(f"Min:   {min(probs):.4f}")
        print(f"Max:   {max(probs):.4f}")
        print(f"Avg:   {sum(probs) / len(probs):.4f}")
        print(f"Median: {probs_sorted[len(probs)//2]:.4f}")
        
        print("\n[Threshold Distribution]")
        high = sum(1 for p in probs if p >= 0.60)
        mid = sum(1 for p in probs if 0.40 <= p < 0.60)
        low = sum(1 for p in probs if p < 0.40)
        
        print(f"HIGH (>= 0.60):    {high:3d} / {len(probs)} ({high*100//len(probs):3d}%)")
        print(f"MID  (0.40-0.60):  {mid:3d} / {len(probs)} ({mid*100//len(probs):3d}%)")
        print(f"LOW  (< 0.40):     {low:3d} / {len(probs)} ({low*100//len(probs):3d}%)")
        
        print("\n")
        
    except Exception as e:
        print(f"ERROR: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    check_confidence_distribution()
