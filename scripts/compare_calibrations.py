#!/usr/bin/env python3
"""
Calibration 방식 비교 (A/B 테스트)
세 가지 calibration 방식을 동일한 테스트셋에서 평가
"""

import sys
import os
import json
import joblib
import argparse
from pathlib import Path
from datetime import date

import pandas as pd
import numpy as np

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
    print("ERROR: supabase 미설치", file=sys.stderr)
    sys.exit(1)

train_lgbm_path = Path(__file__).parent / "train_lgbm.py"
exec(open(train_lgbm_path).read(), globals())


def expected_calibration_error(y_true, y_prob, n_bins=10):
    """ECE (Expected Calibration Error) 계산"""
    bin_sums = np.zeros(n_bins)
    bin_true = np.zeros(n_bins)
    bin_total = np.zeros(n_bins)
    
    for i in range(len(y_prob)):
        bin_idx = int(y_prob[i] * n_bins)
        if bin_idx == n_bins:
            bin_idx -= 1
        
        bin_sums[bin_idx] += y_prob[i]
        bin_true[bin_idx] += y_true[i]
        bin_total[bin_idx] += 1
    
    ece = 0
    for i in range(n_bins):
        if bin_total[i] > 0:
            acc = bin_true[i] / bin_total[i]
            conf = bin_sums[i] / bin_total[i]
            ece += (bin_total[i] / len(y_prob)) * abs(acc - conf)
    
    return ece


def compute_metrics(y_true, y_prob, method_name, market):
    """캘리브레이션 평가 지표"""
    from sklearn.metrics import accuracy_score, roc_auc_score
    
    y_pred = (y_prob >= 0.5).astype(int)
    
    metrics = {
        "method": method_name,
        "market": market,
        "n_samples": len(y_true),
        "accuracy": accuracy_score(y_true, y_pred),
        "auc": roc_auc_score(y_true, y_prob),
        "ece": expected_calibration_error(y_true, y_prob),
        "confidence_min": y_prob.min(),
        "confidence_max": y_prob.max(),
        "confidence_mean": y_prob.mean(),
        "confidence_std": y_prob.std(),
        "conf_ge_60": (y_prob >= 0.60).sum(),
        "conf_ge_60_pct": (y_prob >= 0.60).sum() / len(y_prob) * 100,
    }
    
    return metrics


def load_test_data(client, market, cfg):
    """테스트용 데이터 로드 (마지막 1개월)"""
    df_daily = load_daily_indicators(client, cfg["symbols"])
    df_cross = load_cross_asset_indicators(client, list(CROSS_ASSET_SYMBOLS.values()))
    
    df_full = engineer_features(df_daily, df_cross)
    df_full = create_labels(df_full,
                           forward_days=cfg["forward_days"],
                           binary=cfg["binary"])
    
    # 마지막 20% 데이터를 테스트셋으로 사용
    available_features = [col for col in cfg["features"] if col in df_full.columns]
    X = df_full[available_features].fillna(0)
    y_lgb = df_full["label"].dropna()
    
    valid_mask = y_lgb.index.isin(X.index)
    X = X.loc[valid_mask]
    y_lgb = y_lgb.loc[valid_mask]
    
    split_idx = int(len(X) * 0.8)
    X_test = X.iloc[split_idx:]
    y_test = y_lgb.iloc[split_idx:]
    
    return X_test.values, y_test.values


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--market", choices=["us", "kr", "all"], default="all")
    parser.add_argument("--output", default="calibration_comparison.json")
    args = parser.parse_args()

    client = get_supabase()
    results = []

    for market_code in (["us", "kr"] if args.market == "all" else [args.market]):
        print(f"\n{'='*80}")
        print(f"[{market_code.upper()}] Calibration 방식 비교")
        print(f"{'='*80}\n")

        cfg = MARKET_CONFIG[market_code]
        model_dir = Path("scripts/models")
        
        # 테스트 데이터 로드
        try:
            X_test, y_test = load_test_data(client, market_code, cfg)
        except Exception as e:
            print(f"[ERROR] 데이터 로드 실패: {e}", file=sys.stderr)
            continue

        # 세 가지 모델 로드 및 평가
        methods = [
            ("Platt Scaling", cfg["model_path"]),
            ("ISO Regression", model_dir / f"{market_code}_model_iso.pkl"),
            ("Beta Calibration", model_dir / f"{market_code}_model_beta.pkl"),
        ]

        market_results = []

        for method_name, model_path in methods:
            print(f"[{method_name}] 평가 중...", flush=True)

            if not model_path.exists():
                print(f"  ⚠️  모델 파일 없음: {model_path}")
                continue

            try:
                model_data = joblib.load(model_path)
                model = model_data["model"]
                
                # 예측
                y_prob = model.predict_proba(X_test)
                y_prob_class1 = y_prob[:, 1]
                
                # 지표 계산
                metrics = compute_metrics(y_test, y_prob_class1, method_name, market_code)
                market_results.append(metrics)
                results.append(metrics)
                
                # 출력
                print(f"  Accuracy:      {metrics['accuracy']:.4f}")
                print(f"  AUC:           {metrics['auc']:.4f}")
                print(f"  ECE:           {metrics['ece']:.4f}")
                print(f"  Confidence:    min={metrics['confidence_min']:.4f} / "
                      f"max={metrics['confidence_max']:.4f} / "
                      f"mean={metrics['confidence_mean']:.4f}")
                print(f"  >= 0.60:       {metrics['conf_ge_60']}/{metrics['n_samples']} "
                      f"({metrics['conf_ge_60_pct']:.1f}%)")
                print()

            except Exception as e:
                print(f"  ❌ 오류: {e}", file=sys.stderr)
                continue

        # 마켓별 최고 성능 방식 선택
        if market_results:
            print(f"\n{'─'*80}")
            print(f"[{market_code.upper()}] 평가 최종 결과\n")
            
            # 비교표
            df_results = pd.DataFrame(market_results)
            
            # 최고/최저 표시
            print(f"{'Metric':<20} {'Platt':<15} {'ISO':<15} {'Beta':<15}")
            print("─" * 65)
            
            if len(df_results) == 3:
                for metric in ["accuracy", "auc", "confidence_max", "conf_ge_60_pct"]:
                    values = df_results[metric].values
                    best_idx = np.argmax(values)
                    row = [f"{v:.4f}" if metric != "conf_ge_60_pct" else f"{v:.1f}%" 
                           for v in values]
                    for i, r in enumerate(row):
                        if i == best_idx:
                            row[i] = f"✓ {r}"
                    print(f"{metric:<20} {row[0]:<15} {row[1]:<15} {row[2]:<15}")
            
            # 추천 방식
            best_method = df_results.loc[df_results["ece"].idxmin(), "method"]
            print(f"\n🏆 추천 방식: {best_method}")
            print(f"   이유: ECE 가장 낮음 = calibration 품질 최고")

    # 결과 저장
    if results:
        output_path = Path(__file__).parent / args.output
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\n✅ 결과 저장: {output_path}")
