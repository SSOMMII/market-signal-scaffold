#!/usr/bin/env python3
"""
LightGBM + Beta Calibration (A/B 테스트용)
- Beta Calibration: P(Y=1|confidence) = 1 / (1 + pow(score/(1-score), -beta))
- sklearn에서 직접 지원 안 함 → 커스텀 구현
- 목표: 신뢰도 과 과소평가 모두 보정
"""

import sys
import os
import joblib
import argparse
import pandas as pd
import numpy as np
import lightgbm as lgb
from pathlib import Path
from datetime import date
from scipy.optimize import minimize
from sklearn.metrics import log_loss

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

# train_lgbm.py에서 공통 함수 임포트
train_lgbm_path = Path(__file__).parent / "train_lgbm.py"
exec(open(train_lgbm_path).read(), globals())


# ====== Beta Calibration 구현 ======

class BetaCalibrator:
    """
    Beta Calibration: 신뢰도 보정
    P_calibrated = 1 / (1 + (s / (1-s))^(-beta))
    where s = 원본 신뢰도, beta = 학습 파라미터
    """
    def __init__(self):
        self.beta = None
    
    def fit(self, y_true, y_proba):
        """calibration 데이터로부터 beta 파라미터 학습"""
        # y_proba: (n_samples, 2)에서 클래스 1의 확률
        scores = y_proba[:, 1] if y_proba.ndim > 1 else y_proba
        
        # Beta 범위 제외 (log-odds 스케일에서)
        scores = np.clip(scores, 1e-15, 1 - 1e-15)
        
        def objective(beta):
            # 보정된 확률
            log_odds = np.log(scores) - np.log(1 - scores)
            calibrated = 1.0 / (1.0 + np.exp(-beta[0] * log_odds))
            
            # Cross-entropy loss 최소화
            return log_loss(y_true, calibrated)
        
        # 초기값 beta=1 (보정 안 함)
        result = minimize(objective, [1.0], method='L-BFGS-B',
                         bounds=[(0.1, 10.0)])
        self.beta = result.x[0]
        return self
    
    def calibrate(self, y_proba):
        """신뢰도 보정 적용"""
        scores = y_proba[:, 1] if y_proba.ndim > 1 else y_proba
        scores = np.clip(scores, 1e-15, 1 - 1e-15)
        
        log_odds = np.log(scores) - np.log(1 - scores)
        calibrated = 1.0 / (1.0 + np.exp(-self.beta * log_odds))
        return calibrated


class BetaCalibratedModel:
    """Beta Calibration이 적용된 분류기 래퍼"""
    def __init__(self, base_model):
        self.base_model = base_model
        self.calibrator = None
    
    def fit(self, X, y, X_cal=None, y_cal=None):
        """모델 학습 및 calibrator 학습"""
        # 기본 모델 학습
        self.base_model.fit(X, y, callbacks=[lgb.log_evaluation(0)])
        
        # Calibration 데이터가 없으면 훈련 데이터의 일부 사용
        if X_cal is None:
            split_idx = int(len(X) * 0.7)
            X_train, X_cal = X[:split_idx], X[split_idx:]
            y_train, y_cal = y[:split_idx], y[split_idx:]
            # 재학습 (더 작은 데이터로)
            self.base_model.fit(X_train, y_train, callbacks=[lgb.log_evaluation(0)])
        
        # Calibrator 학습
        y_proba_cal = self.base_model.predict_proba(X_cal)
        self.calibrator = BetaCalibrator()
        self.calibrator.fit(y_cal, y_proba_cal)
        return self
    
    def predict_proba(self, X):
        """보정된 확률 반환"""
        proba = self.base_model.predict_proba(X)
        
        if self.calibrator is None:
            return proba
        
        calibrated_scores = self.calibrator.calibrate(proba)
        
        # (n_samples, 2) 형태로 반환
        result = np.column_stack([1 - calibrated_scores, calibrated_scores])
        return result
    
    def predict(self, X):
        """클래스 예측"""
        proba = self.predict_proba(X)
        return (proba[:, 1] >= 0.5).astype(int)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--tune", action="store_true", help="Optuna 튜닝")
    parser.add_argument("--n-trials", type=int, default=50)
    parser.add_argument("--market", choices=["us", "kr", "all"], default="all")
    parser.add_argument("--predict-only", action="store_true")
    args = parser.parse_args()

    client = get_supabase()

    if args.predict_only:
        print("[WARN] --predict-only Beta 버전에서 미구현", file=sys.stderr)
        sys.exit(1)

    for market_code in (["us", "kr"] if args.market == "all" else [args.market]):
        tag = f"[BETA {market_code.upper()}]"
        cfg = MARKET_CONFIG[market_code]

        print(f"\n{'='*70}", file=sys.stderr)
        print(f"{tag} Beta Calibration 훈련 시작", file=sys.stderr)
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
                                   market_label=f"BETA {market_code.upper()}", 
                                   binary=cfg["binary"],
                                   **lgb_params)
        else:
            base_model = lgb.LGBMClassifier(**lgb_params)
            base_model.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])
            cv_scores = [0.5]

        # ====== BETA CALIBRATION 적용 ======
        print(f"\n{tag} Beta Calibration 파라미터 학습 중...")
        base_model = lgb.LGBMClassifier(**lgb_params)
        
        # Beta Calibrator 포장
        model_beta = BetaCalibratedModel(base_model)
        model_beta.fit(X.values, y_lgb.values)
        
        print(f"{tag} Beta 파라미터: {model_beta.calibrator.beta:.4f}", file=sys.stderr)

        print(f"{tag} 모델 저장 중...", file=sys.stderr)
        model_path = cfg["model_path"].parent / (cfg["model_path"].stem + "_beta" + ".pkl")
        model_path.parent.mkdir(parents=True, exist_ok=True)
        
        joblib.dump({
            "model":              model_beta,
            "features":           available_features,
            "cv_accuracy":        float(np.mean(cv_scores)) if cv_scores else 0.5,
            "lgb_params":         lgb_params,
            "trained_at":         date.today().isoformat(),
            "market":             market_code,
            "symbols":            sorted(df_full["symbol"].unique().tolist()),
            "binary":             cfg["binary"],
            "calibration_method": "beta_calibration",  # ← 핵심
            "beta_param":         float(model_beta.calibrator.beta),
            "model_version":      "BETA",
        }, model_path)
        
        print(f"{tag} ✅ 저장 완료: {model_path}", file=sys.stderr)

        # 간단한 테스트 예측
        probs = model_beta.predict_proba(X.values[:100])
        print(f"\n{tag} 신뢰도 샘플 (처음 100행):")
        print(f"  Min:  {probs[:, 1].min():.4f}")
        print(f"  Max:  {probs[:, 1].max():.4f}")
        print(f"  Mean: {probs[:, 1].mean():.4f}")
        print(f"  >= 0.60: {(probs[:, 1] >= 0.60).sum()}/{len(probs[:, 1])}")
