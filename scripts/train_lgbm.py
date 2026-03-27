#!/usr/bin/env python3
"""
LightGBM 학습 스크립트
- Supabase daily_indicators 기반
- 피처: 가격 모멘텀 + 기술적 지표 + 크로스-에셋 (VIX, GLD, USDKRW)
- 레이블: 5거래일 후 수익률 기반 3분류 (매수/관망/매도)
- 검증: TimeSeriesSplit (5-fold)
- 결과: scripts/models/lgbm_model.pkl 저장 + ai_predictions 테이블 upsert

Usage:
    python train_lgbm.py               # 전체 학습 + 최신 예측 저장
    python train_lgbm.py --predict-only  # 저장된 모델로 예측만 (매일 크론용)
"""

import argparse
import os
import sys
import json
import joblib
from pathlib import Path
from datetime import date

# .env.local 자동 로드
_env_file = Path(__file__).parent.parent / ".env.local"
if _env_file.exists():
    for line in _env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip())

try:
    import pandas as pd
    import numpy as np
    import lightgbm as lgb
    from sklearn.model_selection import TimeSeriesSplit
    from sklearn.metrics import accuracy_score, classification_report
    from supabase import create_client
except ImportError as e:
    print(f"ERROR: 필요 패키지 미설치 → {e}", file=sys.stderr)
    print("설치: pip install lightgbm scikit-learn joblib pandas supabase", file=sys.stderr)
    sys.exit(1)


# ── 설정 ──────────────────────────────────────────────────────────────────────

# 학습 대상 ETF (US 시장)
TARGET_SYMBOLS = ['QQQ', 'SPY', 'SOXL', 'TQQQ', 'IWM', 'GLD', 'TLT']

# 크로스-에셋 피처로 쓸 종목
CROSS_ASSET_SYMBOLS = {
    'vix':    '^VIX',       # 공포지수
    'gold':   'GC=F',       # 금 선물
    'usdkrw': 'USDKRW=X',   # 달러/원
    'tnx':    '^GSPC',      # S&P500 (전체 시장 흐름)
}

# 레이블 기준 (5거래일 후 수익률)
FORWARD_DAYS = 5
LABEL_THRESHOLDS = {
    'buy':  0.02,   # +2% 이상 → 매수 (1)
    'sell': -0.02,  # -2% 이하 → 매도 (-1)
    # 그 사이 → 관망 (0)
}

# 레버리지 ETF는 임계값을 더 넓게
LEVERAGE_THRESHOLDS = {
    'SOXL': (0.05, -0.05),
    'TQQQ': (0.04, -0.04),
}

MODEL_PATH = Path(__file__).parent / "models" / "lgbm_model.pkl"


# ── Supabase 클라이언트 ────────────────────────────────────────────────────────

def get_supabase():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.")
    return create_client(url, key)


# ── 데이터 로드 ───────────────────────────────────────────────────────────────

def load_daily_indicators(client, symbols: list[str]) -> pd.DataFrame:
    """Supabase에서 지정 종목들의 daily_indicators 전체 로드"""
    # market_master id 조회
    res = client.table("market_master").select("id, symbol").in_("symbol", symbols).execute()
    id_to_symbol = {r["id"]: r["symbol"] for r in res.data}
    ids = list(id_to_symbol.keys())

    if not ids:
        raise ValueError(f"market_master에서 종목을 찾을 수 없습니다: {symbols}")

    # daily_indicators 전체 로드 (1000건씩 페이지네이션)
    all_rows = []
    page_size = 1000
    offset = 0

    while True:
        res = (
            client.table("daily_indicators")
            .select("market_master_id, as_of_date, open, high, low, close, volume, "
                    "rsi, macd, signal_line, sma_50, sma_120, sma_200, "
                    "bollinger_upper, bollinger_lower, stoch_k")
            .in_("market_master_id", ids)
            .order("as_of_date", desc=False)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        batch = res.data or []
        all_rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(all_rows)
    df["symbol"] = df["market_master_id"].map(id_to_symbol)
    df["as_of_date"] = pd.to_datetime(df["as_of_date"])
    df = df.sort_values(["symbol", "as_of_date"]).reset_index(drop=True)

    numeric_cols = ["open", "high", "low", "close", "volume",
                    "rsi", "macd", "signal_line", "sma_50", "sma_120", "sma_200",
                    "bollinger_upper", "bollinger_lower", "stoch_k"]
    df[numeric_cols] = df[numeric_cols].apply(pd.to_numeric, errors="coerce")

    print(f"[INFO] 로드 완료: {len(df)}행 / 종목: {df['symbol'].unique().tolist()}", file=sys.stderr)
    return df


# ── 피처 엔지니어링 ──────────────────────────────────────────────────────────

def engineer_features(df: pd.DataFrame, cross: pd.DataFrame) -> pd.DataFrame:
    """종목별 피처 생성"""
    frames = []

    for symbol, grp in df.groupby("symbol"):
        g = grp.copy().sort_values("as_of_date").reset_index(drop=True)

        # ① 가격 모멘텀
        g["return_1d"]  = g["close"].pct_change(1)
        g["return_5d"]  = g["close"].pct_change(5)
        g["return_20d"] = g["close"].pct_change(20)

        # ② 변동성
        g["vol_20d"] = g["return_1d"].rolling(20).std()

        # ③ 거래량 비율 (오늘 거래량 / 20일 평균)
        g["vol_ratio"] = g["volume"] / g["volume"].rolling(20).mean()

        # ④ 볼린저 밴드 위치 (0 = 하단, 1 = 상단)
        band_range = g["bollinger_upper"] - g["bollinger_lower"]
        g["bb_position"] = (g["close"] - g["bollinger_lower"]) / band_range.replace(0, np.nan)

        # ⑤ MACD 히스토그램
        g["macd_hist"] = g["macd"] - g["signal_line"]

        # ⑥ SMA 대비 위치 (%)
        g["price_vs_sma50"]  = (g["close"] / g["sma_50"]  - 1).replace([np.inf, -np.inf], np.nan)
        g["price_vs_sma120"] = (g["close"] / g["sma_120"] - 1).replace([np.inf, -np.inf], np.nan)
        g["price_vs_sma200"] = (g["close"] / g["sma_200"] - 1).replace([np.inf, -np.inf], np.nan)

        # ⑦ 고가-저가 범위 (일중 변동성)
        g["hl_range"] = (g["high"] - g["low"]) / g["close"]

        # ⑧ 크로스-에셋 조인 (VIX, 금, 달러)
        g = g.merge(cross, on="as_of_date", how="left")

        frames.append(g)

    result = pd.concat(frames, ignore_index=True)
    return result


def build_cross_asset(df_all: pd.DataFrame) -> pd.DataFrame:
    """크로스-에셋 피처 테이블 생성 (날짜별 VIX, 금, 달러 수익률)"""
    rows = []

    for key, sym in CROSS_ASSET_SYMBOLS.items():
        sub = df_all[df_all["symbol"] == sym][["as_of_date", "close", "rsi"]].copy()
        if sub.empty:
            continue
        sub = sub.sort_values("as_of_date").reset_index(drop=True)
        sub[f"{key}_close"]  = sub["close"]
        sub[f"{key}_ret_1d"] = sub["close"].pct_change(1)
        sub[f"{key}_ret_5d"] = sub["close"].pct_change(5)
        rows.append(sub[["as_of_date", f"{key}_close", f"{key}_ret_1d", f"{key}_ret_5d"]])

    if not rows:
        return pd.DataFrame(columns=["as_of_date"])

    cross = rows[0]
    for r in rows[1:]:
        cross = cross.merge(r, on="as_of_date", how="outer")

    return cross.sort_values("as_of_date").reset_index(drop=True)


# ── 레이블 생성 ──────────────────────────────────────────────────────────────

def make_labels(df: pd.DataFrame) -> pd.DataFrame:
    """5거래일 후 수익률 → 3분류 레이블"""
    frames = []

    for symbol, grp in df.groupby("symbol"):
        g = grp.copy().sort_values("as_of_date").reset_index(drop=True)

        # 5일 후 종가 수익률
        g["forward_5d"] = g["close"].shift(-FORWARD_DAYS) / g["close"] - 1

        # 종목별 임계값
        buy_th, sell_th = LEVERAGE_THRESHOLDS.get(
            symbol,
            (LABEL_THRESHOLDS["buy"], LABEL_THRESHOLDS["sell"])
        )

        g["label"] = 0  # 관망
        g.loc[g["forward_5d"] >= buy_th,  "label"] =  1  # 매수
        g.loc[g["forward_5d"] <= sell_th, "label"] = -1  # 매도

        frames.append(g)

    return pd.concat(frames, ignore_index=True)


# ── 학습 ────────────────────────────────────────────────────────────────────

FEATURE_COLS = [
    # 모멘텀
    "return_1d", "return_5d", "return_20d",
    # 변동성
    "vol_20d", "vol_ratio", "hl_range",
    # 기술적 지표
    "rsi", "macd_hist", "stoch_k",
    "bb_position", "price_vs_sma50", "price_vs_sma120", "price_vs_sma200",
    # 크로스-에셋
    "vix_close", "vix_ret_1d",
    "gold_ret_1d", "gold_ret_5d",
    "usdkrw_ret_1d",
    "tnx_ret_1d", "tnx_ret_5d",
]


def train(df: pd.DataFrame):
    """TimeSeriesSplit 기반 학습 + 최종 전체 데이터 학습"""

    # 마지막 FORWARD_DAYS 행은 레이블 없음 → 제거
    df_train = df.dropna(subset=["label", "forward_5d"]).copy()
    df_train = df_train[df_train["forward_5d"].notna()]

    # 사용 가능한 피처만 선택
    available_features = [c for c in FEATURE_COLS if c in df_train.columns]
    missing = [c for c in FEATURE_COLS if c not in df_train.columns]
    if missing:
        print(f"[WARN] 누락 피처 (스킵): {missing}", file=sys.stderr)

    # 날짜순 정렬 (TimeSeriesSplit 전제)
    df_train = df_train.sort_values("as_of_date").reset_index(drop=True)

    X = df_train[available_features].astype(float)
    y = df_train["label"].astype(int)  # -1, 0, 1

    # LightGBM은 클래스가 0-indexed여야 함 → +1 해서 0/1/2로 변환
    y_lgb = y + 1  # -1→0, 0→1, 1→2

    print(f"\n[INFO] 학습 데이터: {len(X)}행 / 피처: {len(available_features)}개", file=sys.stderr)
    print(f"[INFO] 레이블 분포: 매도={( y==-1).sum()} / 관망={(y==0).sum()} / 매수={(y==1).sum()}", file=sys.stderr)

    # TimeSeriesSplit 교차검증
    tscv = TimeSeriesSplit(n_splits=5, gap=FORWARD_DAYS)
    cv_scores = []

    lgb_params = {
        "objective": "multiclass",
        "num_class": 3,
        "metric": "multi_logloss",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 20,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbose": -1,
        "n_estimators": 500,
    }

    print("\n[INFO] TimeSeriesSplit 교차검증 시작...", file=sys.stderr)
    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y_lgb.iloc[train_idx], y_lgb.iloc[val_idx]

        model_cv = lgb.LGBMClassifier(**lgb_params)
        model_cv.fit(
            X_tr, y_tr,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(0)],
        )

        preds = model_cv.predict(X_val)
        acc = accuracy_score(y_val, preds)
        cv_scores.append(acc)
        print(f"  Fold {fold+1}: accuracy={acc:.4f} / val_size={len(val_idx)}", file=sys.stderr)

    print(f"\n[RESULT] CV Accuracy: {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}", file=sys.stderr)
    print(f"[RESULT] 폴드별: {[f'{s:.4f}' for s in cv_scores]}", file=sys.stderr)

    # 전체 데이터로 최종 모델 학습
    print("\n[INFO] 전체 데이터로 최종 모델 학습 중...", file=sys.stderr)
    final_model = lgb.LGBMClassifier(**lgb_params)
    final_model.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])

    # 피처 중요도 출력
    importances = pd.Series(final_model.feature_importances_, index=available_features)
    importances = importances.sort_values(ascending=False)
    print("\n[INFO] 피처 중요도 (상위 10):", file=sys.stderr)
    for feat, imp in importances.head(10).items():
        print(f"  {feat:30s}: {imp}", file=sys.stderr)

    # 모델 저장
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({
        "model": final_model,
        "features": available_features,
        "cv_accuracy": float(np.mean(cv_scores)),
        "trained_at": date.today().isoformat(),
    }, MODEL_PATH)
    print(f"\n[OK] 모델 저장: {MODEL_PATH}", file=sys.stderr)

    return final_model, available_features, df_train


# ── 예측 및 Supabase upsert ──────────────────────────────────────────────────

def predict_and_upsert(client, model, features: list[str], df: pd.DataFrame):
    """최신 날짜 데이터로 예측 → ai_predictions 테이블에 upsert"""
    label_map = {0: "SELL", 1: "HOLD", 2: "BUY"}
    signal_label_map = {
        "BUY":  "BUY",
        "HOLD": "HOLD",
        "SELL": "SELL",
    }

    # 종목별 최신 행만 추출
    latest = df.sort_values("as_of_date").groupby("symbol").last().reset_index()

    rows_to_upsert = []
    for _, row in latest.iterrows():
        symbol = row["symbol"]

        X_pred = pd.DataFrame([row[features].values], columns=features, dtype=float)
        if X_pred.isnull().all(axis=1).iloc[0]:
            print(f"[WARN] {symbol}: 피처 전부 null, 예측 스킵", file=sys.stderr)
            continue

        proba = model.predict_proba(X_pred)[0]  # [P(SELL), P(HOLD), P(BUY)]
        pred_class = int(model.predict(X_pred)[0])  # 0/1/2
        pred_label = label_map[pred_class]

        # signal_score: 0~100 (BUY 확률 기반)
        buy_prob  = float(proba[2])
        sell_prob = float(proba[0])
        signal_score = int((buy_prob - sell_prob + 1) / 2 * 100)  # 0~100

        # ai_predictions 스키마에 맞게
        signal_label = {
            "BUY": "BUY", "HOLD": "HOLD", "SELL": "SELL"
        }[pred_label]

        contributions = [
            {"feature": f, "value": float(row[f]) if pd.notna(row.get(f)) else None}
            for f in features[:5]  # 상위 5개 피처만
        ]

        rows_to_upsert.append({
            "ticker":       symbol,
            "date":         str(row["as_of_date"].date()),
            "signal_score": signal_score,
            "signal_label": signal_label,
            "lgbm_prob":    buy_prob,
            "contributions": json.dumps(contributions),
            "breakdown": json.dumps({
                "buy_prob":  round(buy_prob, 4),
                "hold_prob": round(float(proba[1]), 4),
                "sell_prob": round(sell_prob, 4),
            }),
            "summary_text": (
                f"{symbol} LightGBM 예측: {pred_label} "
                f"(매수확률 {buy_prob*100:.1f}% / 매도확률 {sell_prob*100:.1f}%)"
            ),
        })

        print(f"  {symbol:6s}: {pred_label:4s} | score={signal_score} | "
              f"buy={buy_prob:.2f} hold={float(proba[1]):.2f} sell={sell_prob:.2f}",
              file=sys.stderr)

    if rows_to_upsert:
        client.table("ai_predictions").upsert(
            rows_to_upsert, on_conflict="ticker,date"
        ).execute()
        print(f"\n[OK] ai_predictions에 {len(rows_to_upsert)}건 upsert 완료", file=sys.stderr)


# ── main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--predict-only", action="store_true",
                        help="저장된 모델로 예측만 수행 (학습 스킵)")
    args = parser.parse_args()

    client = get_supabase()

    if args.predict_only:
        # 저장된 모델 로드
        if not MODEL_PATH.exists():
            print("ERROR: 저장된 모델 없음. 먼저 python train_lgbm.py 실행하세요.", file=sys.stderr)
            sys.exit(1)
        saved = joblib.load(MODEL_PATH)
        model    = saved["model"]
        features = saved["features"]
        print(f"[INFO] 모델 로드: {MODEL_PATH} (학습일: {saved['trained_at']}, CV acc: {saved['cv_accuracy']:.4f})", file=sys.stderr)

        # 최신 데이터만 로드 (예측용)
        all_syms = TARGET_SYMBOLS + list(CROSS_ASSET_SYMBOLS.values())
        df_raw = load_daily_indicators(client, all_syms)
        cross  = build_cross_asset(df_raw)
        df_raw = df_raw[df_raw["symbol"].isin(TARGET_SYMBOLS)]
        df_feat = engineer_features(df_raw, cross)

        print("\n[INFO] 예측 결과:", file=sys.stderr)
        predict_and_upsert(client, model, features, df_feat)

    else:
        # 전체 학습 흐름
        all_syms = TARGET_SYMBOLS + list(CROSS_ASSET_SYMBOLS.values())

        print("[INFO] 데이터 로드 중...", file=sys.stderr)
        df_raw = load_daily_indicators(client, all_syms)

        print("[INFO] 크로스-에셋 피처 생성 중...", file=sys.stderr)
        cross = build_cross_asset(df_raw)

        df_target = df_raw[df_raw["symbol"].isin(TARGET_SYMBOLS)].copy()
        df_feat = engineer_features(df_target, cross)
        df_labeled = make_labels(df_feat)

        print("[INFO] 학습 시작...", file=sys.stderr)
        model, features, df_train = train(df_labeled)

        print("\n[INFO] 최신 예측 생성 중...", file=sys.stderr)
        predict_and_upsert(client, model, features, df_labeled)

    print("\n[DONE]", file=sys.stderr)


if __name__ == "__main__":
    main()
