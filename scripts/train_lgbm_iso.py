#!/usr/bin/env python3
"""
LightGBM + ISO Regression Calibration (A/B 테스트용)
- 기존 train_lgbm.py와 동일 구조
- 변경점: CalibratedClassifierCV에서 method="isotonic" 사용
- 목표: confidence 분포 개선 (Platt보다 더 넓은 범위)
"""

import sys
from pathlib import Path

# 기존 train_lgbm.py 모듈 임포트 (공통 로직 재사용)
train_lgbm_path = Path(__file__).parent / "train_lgbm.py"

# train_lgbm.py 실행 후 수정된 calibration 로직 적용
if __name__ == "__main__":
    import os
    import joblib
    import argparse
    import pandas as pd
    import numpy as np
    import lightgbm as lgb
    from pathlib import Path
    from datetime import date
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import StackingClassifier

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
        print("ERROR: supabase 미설치. pip install supabase", file=sys.stderr)
        sys.exit(1)

    # train_lgbm.py에서 공통 함수들 임포트
    # (동일한 기능이므로 직접 인클루드)
    exec(open(train_lgbm_path).read(), globals())

    # ====== ISO Regression 커스텀 로직 시작 ======

    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true", help="Optuna 튜닝")
    parser.add_argument("--n-trials", type=int, default=50)
    parser.add_argument("--market", choices=["us", "kr", "all"], default="all")
    parser.add_argument("--predict-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase()

    if args.predict_only:
        print("[WARN] --predict-only ISO 버전에서 미구현", file=sys.stderr)
        sys.exit(1)

    for market_code in (["us", "kr"] if args.market == "all" else [args.market]):
        tag = f"[ISO {market_code.upper()}]"
        cfg = MARKET_CONFIG[market_code]

        print(f"\n{'='*70}", file=sys.stderr)
        print(f"{tag} ISO Regression Calibration 훈련 시작", file=sys.stderr)
        print(f"{'='*70}\n", file=sys.stderr)

        # 데이터 로드
        df_daily = load_daily_indicators(client, cfg["symbols"])
        df_cross = load_cross_asset_indicators(client, list(CROSS_ASSET_SYMBOLS.values()))
        
        # 피처 엔지니어링
        df_full = engineer_features(df_daily, df_cross)
        df_full = create_labels(df_full,
                               forward_days=cfg["forward_days"],
                               binary=cfg["binary"])
        
        # 데이터 준비
        available_features = [col for col in cfg["features"] if col in df_full.columns]
        X = df_full[available_features].fillna(0)
        y_lgb = df_full["label"].dropna()
        
        valid_mask = y_lgb.index.isin(X.index)
        X = X.loc[valid_mask]
        y_lgb = y_lgb.loc[valid_mask]

        if len(X) < 100:
            print(f"{tag} 데이터 부족 ({len(X)}행)", file=sys.stderr)
            continue

        X.index = df_full.loc[X.index, "as_of_date"]

        # Optuna 튜닝
        lgb_params = OPTUNA_DEFAULT_PARAMS[market_code].copy()
        if args.tune:
            cv_scores = optuna_tune(X, y_lgb, n_trials=args.n_trials,
                                   market_label=f"ISO {market_code.upper()}", 
                                   binary=cfg["binary"],
                                   **lgb_params)
        else:
            base_model = lgb.LGBMClassifier(**lgb_params)
            base_model.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])
            cv_scores = [0.5]  # 더미값

        # ====== ISO REGRESSION 적용 ======
        print(f"\n{tag} ISO Regression Calibration 적용 중...")
        base_model = lgb.LGBMClassifier(**lgb_params)
        base_model.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])
        
        # 핵심 변경: method="isotonic" (Platt 대신)
        model_iso = CalibratedClassifierCV(base_model, method="isotonic", cv=3)
        model_iso.fit(X, y_lgb)

        print(f"{tag} 모델 저장 중...", file=sys.stderr)
        model_path = cfg["model_path"].parent / (cfg["model_path"].stem + "_iso" + ".pkl")
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        joblib.dump({
            "model":              model_iso,
            "features":           available_features,
            "cv_accuracy":        float(np.mean(cv_scores)) if cv_scores else 0.5,
            "lgb_params":         lgb_params,
            "trained_at":         date.today().isoformat(),
            "market":             market_code,
            "symbols":            sorted(df_full["symbol"].unique().tolist()),
            "binary":             cfg["binary"],
            "calibration_method": "iso_regression",  # ← 핵심
            "model_version":      "ISO",
        }, model_path)
        
        print(f"{tag} ✅ 저장 완료: {model_path}", file=sys.stderr)

        # 간단한 테스트 예측
        probs = model_iso.predict_proba(X.head(100))
        print(f"\n{tag} 신뢰도 샘플 (처음 100행):")
        print(f"  Min:  {probs[:, 1].min():.4f}")
        print(f"  Max:  {probs[:, 1].max():.4f}")
        print(f"  Mean: {probs[:, 1].mean():.4f}")
        print(f"  >= 0.60: {(probs[:, 1] >= 0.60).sum()}/{len(probs[:, 1])}")
