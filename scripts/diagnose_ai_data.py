#!/usr/bin/env python3
"""
AI 예측 데이터 상태 진단 스크립트

ai_predictions 테이블 상태 확인:
- 저장된 데이터 개수
- lgbm_prob 분포
- confidence threshold 필터링 시뮬레이션
"""

import os
import sys
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
    print("ERROR: supabase 패키지 미설치", file=sys.stderr)
    print("설치: pip install supabase", file=sys.stderr)
    sys.exit(1)

# Supabase 클라이언트
def get_supabase():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.")
    return create_client(url, key)

def diagnose_ai_predictions():
    """AI 예측 데이터 진단"""
    print("\n🔍 AI 예측 데이터 진단")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")
    
    try:
        client = get_supabase()
        
        # 1. 전체 데이터 개수
        res = client.table("ai_predictions").select("count", count="exact").execute()
        total_count = res.count
        print(f"📊 ai_predictions 테이블 총 행 수: {total_count}")
        
        if total_count == 0:
            print("   ⚠️  데이터가 없습니다. 모델 학습 후 예측 저장이 필요합니다.")
            print("   실행: python scripts/train_lgbm.py --predict-only\n")
            return
        
        # 2. 최신 데이터 샘플
        print(f"\n📋 최신 20개 API 예측 데이터 샘플:\n")
        res = client.table("ai_predictions") \
            .select("ticker, date, signal_score, signal_label, lgbm_prob") \
            .order("date", desc=True) \
            .limit(20) \
            .execute()
        
        rows = res.data or []
        if not rows:
            print("   데이터 없음\n")
            return
        
        # 헤더
        print(f"{'Ticker':<8} {'Date':<12} {'Score':<8} {'Label':<15} {'Confidence':<12}")
        print("─" * 55)
        
        for row in rows:
            ticker = row['ticker'][:8]
            date = row['date'][:10]
            score = f"{row['signal_score']:>6.1f}" if row['signal_score'] is not None else "   N/A"
            label = (row['signal_label'] or 'NULL')[:15]
            conf = f"{row['lgbm_prob']:>10.2f}" if row['lgbm_prob'] is not None else "     NULL"
            print(f"{ticker:<8} {date:<12} {score:<8} {label:<15} {conf:<12}")
        
        # 3. lgbm_prob 분포 분석
        print(f"\n📊 lgbm_prob (신뢰도) 분포 분석:\n")
        
        res = client.table("ai_predictions") \
            .select("lgbm_prob") \
            .execute()
        
        probs = [r['lgbm_prob'] for r in res.data if r['lgbm_prob'] is not None]
        
        if not probs:
            print("   ⚠️  lgbm_prob 데이터 없음 (NULL)\n")
        else:
            probs_sorted = sorted(probs)
            min_p = min(probs)
            max_p = max(probs)
            avg_p = sum(probs) / len(probs)
            median_p = probs_sorted[len(probs) // 2]
            
            print(f"   최소값:     {min_p:.4f}")
            print(f"   최대값:     {max_p:.4f}")
            print(f"   평균:       {avg_p:.4f}")
            print(f"   중앙값:     {median_p:.4f}")
            
            # Threshold별 분포
            thresholds = {
                'HIGH (≥0.60)': sum(1 for p in probs if p >= 0.60),
                'MEDIUM (0.40-0.60)': sum(1 for p in probs if 0.40 <= p < 0.60),
                'LOW (<0.40)': sum(1 for p in probs if p < 0.40),
            }
            
            print(f"\n   Confidence Threshold 분포:")
            total = len(probs)
            for name, count in thresholds.items():
                pct = (count / total * 100) if total > 0 else 0
                bar = '█' * int(pct / 5)
                print(f"     {name:<20} {count:>5} ({pct:>5.1f}%) {bar}")
        
        # 4. 신호 레이블 분포
        print(f"\n📈 signal_label 분포:\n")
        res = client.table("ai_predictions") \
            .select("signal_label") \
            .execute()
        
        labels = {}
        for row in res.data:
            label = row['signal_label'] or 'NULL'
            labels[label] = labels.get(label, 0) + 1
        
        for label, count in sorted(labels.items(), key=lambda x: -x[1]):
            pct = (count / total_count * 100) if total_count > 0 else 0
            bar = '█' * int(pct / 5)
            print(f"   {label:<15} {count:>5} ({pct:>5.1f}%) {bar}")
        
        # 5. 종목별 데이터 개수
        print(f"\n🎯 종목별 AI 예측 데이터 개수:\n")
        res = client.table("ai_predictions") \
            .select("ticker") \
            .execute()
        
        ticker_counts = {}
        for row in res.data:
            ticker = row['ticker']
            ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
        
        for ticker, count in sorted(ticker_counts.items(), key=lambda x: -x[1])[:15]:
            bar = '█' * min(int(count / 5), 20)
            print(f"   {ticker:<10} {count:>5} {bar}")
        
        print(f"\n✅ 진단 완료!\n")
        
    except Exception as e:
        print(f"❌ 오류: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    diagnose_ai_predictions()
