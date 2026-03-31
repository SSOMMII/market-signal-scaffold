#!/usr/bin/env python3
"""
LightGBM 학습 스크립트 (KR/US 모델 분리)
- Supabase daily_indicators 기반
- 피처: 가격 모멘텀 + 기술적 지표 + 크로스-에셋 (VIX, GLD, USDKRW)
- 레이블: 5거래일 후 수익률 기반 3분류 (매수/관망/매도)
- 검증: TimeSeriesSplit (5-fold)
- 결과: scripts/models/us_model.pkl + scripts/models/kr_model.pkl 저장

Usage:
    python train_lgbm.py                        # 전체 학습 + 최신 예측 저장
    python train_lgbm.py --tune                 # Optuna 튜닝 후 학습 (권장, ~10분)
    python train_lgbm.py --tune --n-trials 100  # 튜닝 횟수 지정 (기본 50)
    python train_lgbm.py --predict-only         # 저장된 모델로 예측만 (매일 크론용)
    python train_lgbm.py --market us            # US 모델만 학습/예측
    python train_lgbm.py --market kr            # KR 모델만 학습/예측
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
    from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, log_loss
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.linear_model import LogisticRegression
    from sklearn.ensemble import StackingClassifier
    from scipy.optimize import minimize
    from supabase import create_client
except ImportError as e:
    print(f"ERROR: 필요 패키지 미설치 → {e}", file=sys.stderr)
    print("설치: pip install lightgbm scikit-learn joblib pandas supabase scipy", file=sys.stderr)
    print("선택: pip install anthropic   (summary_text AI 생성용, 없어도 동작)", file=sys.stderr)
    sys.exit(1)

try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False


# ── Beta Calibration 구현 ──────────────────────────────────────────────────────

class BetaCalibrator:
    """Beta Calibration: P_calibrated = 1 / (1 + (s / (1-s))^(-beta))"""
    def __init__(self):
        self.beta = None
    
    def fit(self, y_true, y_proba):
        scores = y_proba[:, 1] if y_proba.ndim > 1 else y_proba
        scores = np.clip(scores, 1e-15, 1 - 1e-15)
        
        def objective(beta):
            log_odds = np.log(scores) - np.log(1 - scores)
            calibrated = 1.0 / (1.0 + np.exp(-beta[0] * log_odds))
            return log_loss(y_true, calibrated)
        
        result = minimize(objective, [1.0], method='L-BFGS-B', bounds=[(0.1, 10.0)])
        self.beta = result.x[0]
        return self
    
    def calibrate(self, y_proba):
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
        self.base_model.fit(X, y, callbacks=[lgb.log_evaluation(0)])
        
        if X_cal is None:
            split_idx = int(len(X) * 0.7)
            X_train, X_cal = X[:split_idx], X[split_idx:]
            y_train, y_cal = y[:split_idx], y[split_idx:]
            self.base_model.fit(X_train, y_train, callbacks=[lgb.log_evaluation(0)])
        
        y_proba_cal = self.base_model.predict_proba(X_cal)
        self.calibrator = BetaCalibrator()
        self.calibrator.fit(y_cal, y_proba_cal)
        return self
    
    def predict_proba(self, X):
        proba = self.base_model.predict_proba(X)
        if self.calibrator is None:
            return proba
        
        calibrated_scores = self.calibrator.calibrate(proba)
        result = np.column_stack([1 - calibrated_scores, calibrated_scores])
        return result
    
    def predict(self, X):
        proba = self.predict_proba(X)
        return (proba[:, 1] >= 0.5).astype(int)


# ── 설정 ──────────────────────────────────────────────────────────────────────

_US_FALLBACK = ['QQQ', 'SPY', 'SOXL', 'TQQQ', 'IWM', 'GLD', 'TLT']
_KR_FALLBACK = ['069500.KS', '229200.KS', '360750.KS', '305720.KS',
                '005930.KS', '000660.KS', '035420.KS', '005380.KS']


def _get_label_threshold(symbol: str) -> tuple[float, float]:
    code = symbol.replace('.KS', '').replace('.KQ', '')

    if code in _LEVERAGE3X_PATTERNS or symbol in _LEVERAGE3X_PATTERNS:
        return _TIER_THRESHOLDS['leverage3x']
    if code in _LEVERAGE2X_PATTERNS or symbol in _LEVERAGE2X_PATTERNS:
        return _TIER_THRESHOLDS['leverage2x']
    if code in _HIGH_VOL_PATTERNS or symbol in _HIGH_VOL_PATTERNS:
        return _TIER_THRESHOLDS['high_vol']
    if code in _BOND_INVERSE_PATTERNS or symbol in _BOND_INVERSE_PATTERNS:
        return _TIER_THRESHOLDS['low_vol']

    # name 기반 추가 판별
    if hasattr(_get_label_threshold, '_name_map'):
        name = _get_label_threshold._name_map.get(symbol, '')
        name_hints_leverage2x = ['레버리지', '2X', '2x', 'Ultra', 'Double']
        name_hints_leverage3x = ['3X', '3x', 'Triple', 'Ultra Pro']
        name_hints_bond = ['국채', '단기채', '통안채', '인버스', 'Inverse', 'Bear']

        if any(h in name for h in name_hints_leverage3x):
            return _TIER_THRESHOLDS['leverage3x']
        if any(h in name for h in name_hints_leverage2x):
            return _TIER_THRESHOLDS['leverage2x']
        if any(h in name for h in name_hints_bond):
            return _TIER_THRESHOLDS['low_vol']

    return _TIER_THRESHOLDS['mid_vol']


def _load_symbols_from_db() -> tuple[list[str], list[str]]:
    """
    market_master에서 US/KR ETF+STOCK 심볼 로드.
    - name도 함께 로드해 _get_label_threshold의 이름 패턴 분류에 활용
    - 실패 시 fallback
    """
    try:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise EnvironmentError("Supabase 환경변수 없음")
        client = create_client(url, key)
        res = (
            client.table("market_master")
            .select("symbol, market_type, name")
            .in_("asset_type", ["ETF", "STOCK"])
            .in_("market_type", ["US", "KR"])
            .execute()
        )
        rows = res.data or []
        us = [r["symbol"] for r in rows if r["market_type"] == "US"]
        kr = [r["symbol"] for r in rows if r["market_type"] == "KR"]

        # 이름 패턴 기반 임계값 분류를 위해 name_map 주입
        _get_label_threshold._name_map = {r["symbol"]: (r["name"] or "") for r in rows}

        if us or kr:
            print(f"[DB] US={len(us)}개, KR={len(kr)}개 심볼 로드", file=sys.stderr)
            return us or _US_FALLBACK, kr or _KR_FALLBACK
    except Exception as e:
        print(f"[WARN] DB 심볼 로드 실패, fallback 사용: {e}", file=sys.stderr)
    return _US_FALLBACK, _KR_FALLBACK


US_SYMBOLS, KR_SYMBOLS = _load_symbols_from_db()
TARGET_SYMBOLS = US_SYMBOLS + KR_SYMBOLS

# 크로스-에셋 피처로 쓸 종목
CROSS_ASSET_SYMBOLS = {
    'vix':    '^VIX',       # 공포지수
    'gold':   'GC=F',       # 금 선물
    'usdkrw': 'USDKRW=X',   # 달러/원 (KR 종목에 직접 영향)
    'tnx':    '^GSPC',      # S&P500 (전체 시장 흐름)
    'kospi':  '^KS11',      # KOSPI (KR 종목 기준지수)
}

# 레이블 기준 (5거래일 후 수익률)
FORWARD_DAYS = 5
LABEL_THRESHOLDS = {
    'buy':  0.01,   # +1% 이상 → 매수 (1)
    'sell': -0.01,  # -1% 이하 → 매도 (-1)
}

# 변동성 티어별 임계값
# - leverage3x : 3배 레버리지 (SOXL, TQQQ 등)         → ±5%
# - leverage2x : 2배 레버리지 (KODEX 레버리지 등)       → ±3.5%
# - high_vol   : 고변동성 개별주/섹터 ETF               → ±3%
# - mid_vol    : 일반 ETF / 블루칩 주식                 → ±1.5%
# - low_vol    : 채권/인버스 ETF                        → ±1%
_TIER_THRESHOLDS = {
    'leverage3x': (0.05,  -0.05),
    'leverage2x': (0.035, -0.035),
    'high_vol':   (0.03,  -0.03),
    'mid_vol':    (0.015, -0.015),
    'low_vol':    (0.01,  -0.01),
}

# 티어 분류 패턴 (심볼 코드 기반)
_LEVERAGE3X_PATTERNS = {'SOXL', 'TQQQ', 'LABU', 'SPXL', 'UPRO', 'FNGU', 'WEBL'}
_LEVERAGE2X_PATTERNS = {'QLD', 'SSO', 'USD', 'ROM', 'UWM', '122630', '233740'}  # 122630=KODEX레버리지, 233740=KODEX코스닥150레버리지
_HIGH_VOL_PATTERNS   = {'SOXS', 'ARKK', 'ARKG', 'ARKW', '005930', '000660', '035420', '035720', '005380'}
_BOND_INVERSE_PATTERNS = {'TLT', 'TBT', 'TMF', 'IEF', 'SHY', '114800', '252670', '195930'}  # 114800=TIGER인버스, 252670=KODEX인버스2X

# FOMC 결정일 (2021~2026, 공개 일정 기반)
FOMC_DATES = pd.to_datetime([
    # 2021
    "2021-01-27", "2021-03-17", "2021-04-28", "2021-06-16",
    "2021-07-28", "2021-09-22", "2021-11-03", "2021-12-15",
    # 2022
    "2022-01-26", "2022-03-16", "2022-05-04", "2022-06-15",
    "2022-07-27", "2022-09-21", "2022-11-02", "2022-12-14",
    # 2023
    "2023-02-01", "2023-03-22", "2023-05-03", "2023-06-14",
    "2023-07-26", "2023-09-20", "2023-11-01", "2023-12-13",
    # 2024
    "2024-01-31", "2024-03-20", "2024-05-01", "2024-06-12",
    "2024-07-31", "2024-09-18", "2024-11-07", "2024-12-18",
    # 2025
    "2025-01-29", "2025-03-19", "2025-05-07", "2025-06-18",
    "2025-07-30", "2025-09-17", "2025-11-05", "2025-12-17",
    # 2026
    "2026-01-28", "2026-03-18", "2026-05-06", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-11-04", "2026-12-16",
])

# CPI 발표일 (BLS 기준, 2021~2026)
CPI_DATES = pd.to_datetime([
    # 2021
    "2021-01-13", "2021-02-10", "2021-03-10", "2021-04-13",
    "2021-05-12", "2021-06-10", "2021-07-13", "2021-08-11",
    "2021-09-14", "2021-10-13", "2021-11-10", "2021-12-10",
    # 2022
    "2022-01-12", "2022-02-10", "2022-03-10", "2022-04-12",
    "2022-05-11", "2022-06-10", "2022-07-13", "2022-08-10",
    "2022-09-13", "2022-10-13", "2022-11-10", "2022-12-13",
    # 2023
    "2023-01-12", "2023-02-14", "2023-03-14", "2023-04-12",
    "2023-05-10", "2023-06-13", "2023-07-12", "2023-08-10",
    "2023-09-13", "2023-10-12", "2023-11-14", "2023-12-12",
    # 2024
    "2024-01-11", "2024-02-13", "2024-03-12", "2024-04-10",
    "2024-05-15", "2024-06-12", "2024-07-11", "2024-08-14",
    "2024-09-11", "2024-10-10", "2024-11-13", "2024-12-11",
    # 2025
    "2025-01-15", "2025-02-12", "2025-03-12", "2025-04-10",
    "2025-05-13", "2025-06-11", "2025-07-11", "2025-08-12",
    "2025-09-10", "2025-10-15", "2025-11-13", "2025-12-10",
    # 2026
    "2026-01-14", "2026-02-11", "2026-03-11", "2026-04-15",
    "2026-05-13", "2026-06-10", "2026-07-14", "2026-08-12",
    "2026-09-09", "2026-10-14", "2026-11-12", "2026-12-09",
])

def fetch_earnings_dates(symbols: list[str]) -> dict[str, "pd.DatetimeIndex"]:
    """
    Finnhub 실적 발표 캘린더 조회 → {symbol: DatetimeIndex}
    과거 2년 + 미래 1년 범위를 가져와 per-symbol 날짜 목록 반환.
    FINNHUB_API_KEY 없거나 실패 시 빈 dict 반환.
    """
    api_key = os.environ.get("FINNHUB_API_KEY")
    if not api_key:
        return {}

    import urllib.request, urllib.parse, json as _json
    from datetime import timedelta

    today = date.today()
    from_date = (today - timedelta(days=730)).strftime("%Y-%m-%d")
    to_date   = (today + timedelta(days=365)).strftime("%Y-%m-%d")

    earnings_map: dict[str, list] = {}
    for sym in symbols:
        try:
            qs  = urllib.parse.urlencode({"symbol": sym, "from": from_date, "to": to_date, "token": api_key})
            url = f"https://finnhub.io/api/v1/calendar/earnings?{qs}"
            with urllib.request.urlopen(url, timeout=5) as r:
                data = _json.loads(r.read())
            dates = [e["date"] for e in data.get("earningsCalendar", []) if e.get("date")]
            if dates:
                earnings_map[sym] = pd.to_datetime(dates)
        except Exception:
            pass

    return earnings_map


MODEL_DIR = Path(__file__).parent / "models"
US_MODEL_PATH = MODEL_DIR / "us_model.pkl"
KR_MODEL_PATH = MODEL_DIR / "kr_model.pkl"

# A/B 테스트용 모델 (calibrated 버전)
US_MODEL_CAL_PATH = MODEL_DIR / "us_model_calibrated.pkl"
KR_MODEL_CAL_PATH = MODEL_DIR / "kr_model_calibrated.pkl"

# US 피처: KOSPI 제외 (달러 자산에 무관)
US_FEATURE_COLS = [
    "return_1d", "return_2d", "return_3d", "return_5d", "return_20d",
    "vol_20d", "vol_ratio", "hl_range",
    "volume_spike", "price_vs_vwap", "volume_trend", "obv_vs_ma",
    "rsi", "rsi_accel", "rsi_divergence", "macd_hist", "macd_hist_accel", "macd_cross", "stoch_k", "stoch_accel", "stoch_divergence",
    "bb_position", "bb_zone_score", "price_vs_sma50", "price_vs_sma120", "price_vs_sma200",
    "return_entry_sma50", "return_entry_sma200",  # Retention context
    "momentum_accel", "entry_confidence",  # Entry context
    "vix_close", "vix_ret_1d",
    "gold_ret_1d", "gold_ret_5d",
    "usdkrw_ret_1d",
    "tnx_ret_1d", "tnx_ret_5d",
    "regime",
    "return_60d", "return_120d",
    "pct_from_52w_high", "pct_from_52w_low",
    "days_to_fomc", "is_fomc_week",
    "days_to_cpi",  "is_cpi_week",
    "days_to_earnings", "is_earnings_week",
]

# KR 피처: KOSPI + USDKRW 포함 (원화 자산 핵심 지표)
KR_FEATURE_COLS = [
    "return_1d", "return_2d", "return_3d", "return_5d", "return_20d",
    "vol_20d", "vol_ratio", "hl_range",
    "volume_spike", "price_vs_vwap", "volume_trend", "obv_vs_ma",
    "rsi", "rsi_accel", "rsi_divergence", "macd_hist", "macd_hist_accel", "macd_cross", "stoch_k", "stoch_accel", "stoch_divergence",
    "bb_position", "bb_zone_score", "price_vs_sma50", "price_vs_sma120", "price_vs_sma200",
    "return_entry_sma50", "return_entry_sma200",  # Retention context
    "momentum_accel", "entry_confidence",  # Entry context
    "vix_close", "vix_ret_1d",
    "gold_ret_1d", "gold_ret_5d",
    "usdkrw_ret_1d", "usdkrw_ret_5d",   # KR: 원/달러 5일 추세도 추가
    "tnx_ret_1d", "tnx_ret_5d",
    "kospi_ret_1d", "kospi_ret_5d", "kospi_ret_20d",  # KR: KOSPI 흐름 필수
    "kospi_rsi",                         # KR: KOSPI 과열/침체 신호
    "usdkrw_vs_ma20",                    # KR: 원달러 이동평균 이탈도
    "regime",
    "return_60d", "return_120d",
    "pct_from_52w_high", "pct_from_52w_low",
    "days_to_fomc", "is_fomc_week",
    "days_to_cpi",  "is_cpi_week",
    "days_to_earnings", "is_earnings_week",
]

# ── 피처명 한국어 매핑 ────────────────────────────────────────────────────────
FEATURE_NAME_KO = {
    "return_1d":          "전일 수익률",
    "return_2d":          "2일 수익률",
    "return_3d":          "3일 수익률",
    "return_5d":          "5일 수익률",
    "return_20d":         "20일 수익률",
    "return_60d":         "60일 수익률",
    "return_120d":        "120일 수익률",
    "vol_20d":            "20일 변동성",
    "vol_ratio":          "거래량 급등 비율",
    "hl_range":           "당일 변동폭",
    "volume_spike":       "거래량 스파이크",
    "price_vs_vwap":      "VWAP 이격도",
    "volume_trend":       "거래량 추세",
    "obv_vs_ma":          "OBV 이동평균 이탈",
    "rsi":                "RSI",
    "rsi_accel":          "RSI 가속도",
    "rsi_divergence":     "RSI 다이버전스",
    "macd_hist":          "MACD 히스토그램",
    "macd_hist_accel":    "MACD 히스토그램 가속도",
    "macd_cross":         "MACD 크로스 방향",
    "stoch_k":            "스토캐스틱 %K",
    "stoch_accel":        "스토캐스틱 가속도",
    "stoch_divergence":   "스토캐스틱 다이버전스",
    "bb_position":        "볼린저밴드 위치",
    "bb_zone_score":      "볼린저밴드 구간 점수",
    "price_vs_sma50":     "SMA50 이격도",
    "price_vs_sma120":    "SMA120 이격도",
    "price_vs_sma200":    "SMA200 이격도",
    "return_entry_sma50": "진입 후 SMA50 대비",
    "return_entry_sma200":"진입 후 SMA200 대비",
    "momentum_accel":     "모멘텀 가속도",
    "entry_confidence":   "진입 신뢰도",
    "vix_close":          "VIX 수준",
    "vix_ret_1d":         "VIX 전일 변화",
    "gold_ret_1d":        "금 전일 수익률",
    "gold_ret_5d":        "금 5일 수익률",
    "usdkrw_ret_1d":      "원/달러 전일 변화",
    "usdkrw_ret_5d":      "원/달러 5일 변화",
    "tnx_ret_1d":         "미국채10년 전일 변화",
    "tnx_ret_5d":         "미국채10년 5일 변화",
    "kospi_ret_1d":       "KOSPI 전일 수익률",
    "kospi_ret_5d":       "KOSPI 5일 수익률",
    "kospi_ret_20d":      "KOSPI 20일 수익률",
    "kospi_rsi":          "KOSPI RSI",
    "usdkrw_vs_ma20":     "원달러 MA20 이탈도",
    "regime":             "시장 레짐",
    "pct_from_52w_high":  "52주 고점 대비",
    "pct_from_52w_low":   "52주 저점 대비",
    "days_to_fomc":       "FOMC까지 잔여일",
    "is_fomc_week":       "FOMC 주간 여부",
    "days_to_cpi":        "CPI까지 잔여일",
    "is_cpi_week":        "CPI 주간 여부",
    "days_to_earnings":   "실적 발표까지 잔여일",
    "is_earnings_week":   "실적 발표 주간 여부",
}

# 퍼센트 단위로 표시할 피처 집합
_PCT_FEATURES = {
    "return_1d", "return_2d", "return_3d", "return_5d", "return_20d",
    "return_60d", "return_120d", "gold_ret_1d", "gold_ret_5d",
    "vix_ret_1d", "usdkrw_ret_1d", "usdkrw_ret_5d",
    "tnx_ret_1d", "tnx_ret_5d",
    "kospi_ret_1d", "kospi_ret_5d", "kospi_ret_20d",
    "price_vs_sma50", "price_vs_sma120", "price_vs_sma200",
    "price_vs_vwap", "volume_trend", "rsi_accel", "stoch_accel",
    "pct_from_52w_high", "pct_from_52w_low",
}

MARKET_CONFIG = {
    "us": {
        "symbols":      US_SYMBOLS,
        "features":     US_FEATURE_COLS,
        "model_path":   US_MODEL_PATH,
        "label":        "US",
        "forward_days": 5,
        "binary":       False,
    },
    "kr": {
        "symbols":      KR_SYMBOLS,
        "features":     KR_FEATURE_COLS,
        "model_path":   KR_MODEL_PATH,
        "label":        "KR",
        "forward_days": 1,   # 1일 후 상승/하락 이진 분류
        "binary":       True,
    },
}


# ── Supabase 클라이언트 ────────────────────────────────────────────────────────

def get_supabase():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정하세요.")
    return create_client(url, key)


# ── 데이터 로드 ───────────────────────────────────────────────────────────────

TRAIN_LOOKBACK_YEARS = 3  # 학습 데이터 기간 (년)

def load_daily_indicators(client, symbols: list[str]) -> pd.DataFrame:
    """Supabase에서 지정 종목들의 daily_indicators 로드 (최근 TRAIN_LOOKBACK_YEARS년)"""
    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(days=365 * TRAIN_LOOKBACK_YEARS)).isoformat()

    res = client.table("market_master").select("id, symbol").in_("symbol", symbols).execute()
    id_to_symbol = {r["id"]: r["symbol"] for r in res.data}
    ids = list(id_to_symbol.keys())

    if not ids:
        raise ValueError(f"market_master에서 종목을 찾을 수 없습니다: {symbols}")

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
            .gte("as_of_date", cutoff)
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

def engineer_features(df: pd.DataFrame, cross: pd.DataFrame, earnings_dates: dict[str, pd.DatetimeIndex] = None) -> pd.DataFrame:
    """종목별 피처 생성"""
    frames = []

    for symbol, grp in df.groupby("symbol"):
        g = grp.copy().sort_values("as_of_date").reset_index(drop=True)

        # ① 가격 모멘텀
        g["return_1d"]  = g["close"].pct_change(1)
        g["return_2d"]  = g["close"].pct_change(2)
        g["return_3d"]  = g["close"].pct_change(3)
        g["return_5d"]  = g["close"].pct_change(5)
        g["return_20d"] = g["close"].pct_change(20)

        # ② 변동성
        g["vol_20d"] = g["return_1d"].rolling(20).std()

        # ③ 거래량 비율
        g["vol_ratio"] = g["volume"] / g["volume"].rolling(20).mean()

        # ④ 볼린저 밴드 위치 (4구간 점수화 개선)
        band_range = g["bollinger_upper"] - g["bollinger_lower"]
        bb_pos = (g["close"] - g["bollinger_lower"]) / band_range.replace(0, np.nan)
        g["bb_position"] = bb_pos
        
        # Bollinger 4구간 점수화: 15%/85% 구간도 절반 점수 부여
        g["bb_zone_score"] = 0.0
        g.loc[bb_pos < 0.15, "bb_zone_score"] = -1.0  # 하단 15%: -1점
        g.loc[(bb_pos >= 0.15) & (bb_pos < 0.5), "bb_zone_score"] = (bb_pos - 0.15) / 0.35 * -0.5  # 15%-50%: -0.5 ~ 0점
        g.loc[(bb_pos >= 0.5) & (bb_pos < 0.85), "bb_zone_score"] = (bb_pos - 0.5) / 0.35 * 0.5   # 50%-85%: 0 ~ +0.5점
        g.loc[bb_pos >= 0.85, "bb_zone_score"] = 1.0  # 상단 15%: +1점

        # ⑤ MACD 히스토그램 및 모멘텀 개선
        g["macd_hist"] = g["macd"] - g["signal_line"]
        
        # MACD 히스토그램 가속도 (모멘텀 변화 감지)
        g["macd_hist_accel"] = g["macd_hist"].diff(1)  # 전일 대비 히스토그램 변화
        
        # MACD 크로스 방향 (기존 유지)
        g["macd_cross"] = 0
        g.loc[(g["macd"] > g["signal_line"]) & (g["macd"].shift(1) <= g["signal_line"].shift(1)), "macd_cross"] = 1   # 골든크로스
        g.loc[(g["macd"] < g["signal_line"]) & (g["macd"].shift(1) >= g["signal_line"].shift(1)), "macd_cross"] = -1  # 데드크로스

        # ⑥ RSI 모멘텀 개선
        g["rsi_accel"] = g["rsi"].diff(1)  # RSI 변화율 (모멘텀)
        
        # RSI 다이버전스 신호 (가격과 RSI의 방향성 차이)
        price_trend = g["close"].pct_change(5, fill_method=None)  # 5일 가격 추세
        rsi_trend = g["rsi"].pct_change(5, fill_method=None)      # 5일 RSI 추세
        g["rsi_divergence"] = ((price_trend > 0) & (rsi_trend < 0)).astype(int) - ((price_trend < 0) & (rsi_trend > 0)).astype(int)

        # ⑦ 스토캐스틱 모멘텀 개선
        g["stoch_accel"] = g["stoch_k"].diff(1)  # 스토캐스틱 변화율
        
        # 스토캐스틱 다이버전스 (가격과 스토캐스틱의 방향성 차이)
        stoch_trend = g["stoch_k"].pct_change(5, fill_method=None)
        g["stoch_divergence"] = ((price_trend > 0) & (stoch_trend < 0)).astype(int) - ((price_trend < 0) & (stoch_trend > 0)).astype(int)

        # ⑥ SMA 대비 위치 (%)
        g["price_vs_sma50"]  = (g["close"] / g["sma_50"]  - 1).replace([np.inf, -np.inf], np.nan)
        g["price_vs_sma120"] = (g["close"] / g["sma_120"] - 1).replace([np.inf, -np.inf], np.nan)
        g["price_vs_sma200"] = (g["close"] / g["sma_200"] - 1).replace([np.inf, -np.inf], np.nan)

        # ⑦ 고가-저가 범위
        g["hl_range"] = (g["high"] - g["low"]) / g["close"]

        # ⑧ 거래량 스파이크 및 패턴 개선
        g["volume_spike"] = (g["vol_ratio"] > 2.0).astype(int)
        
        # 거래량 VWAP (Volume Weighted Average Price)
        g["vwap"] = (g["close"] * g["volume"]).cumsum() / g["volume"].cumsum()
        g["price_vs_vwap"] = (g["close"] / g["vwap"] - 1).replace([np.inf, -np.inf], np.nan)
        
        # 거래량 추세 (20일 평균 대비)
        vol_ma20 = g["volume"].rolling(20).mean()
        g["volume_trend"] = (g["volume"] / vol_ma20 - 1).replace([np.inf, -np.inf], np.nan)

        # ⑨ OBV
        g["obv"] = (np.sign(g["close"].diff()) * g["volume"]).cumsum()
        obv_ma20 = g["obv"].rolling(20).mean()
        g["obv_vs_ma"] = (g["obv"] / obv_ma20.replace(0, np.nan) - 1)

        # ⑩-a 중기 모멘텀
        g["return_60d"]  = g["close"].pct_change(60)
        g["return_120d"] = g["close"].pct_change(120)

        # ⑩-b 52주 고/저가 대비 위치
        g["pct_from_52w_high"] = g["close"] / g["close"].rolling(252).max() - 1
        g["pct_from_52w_low"]  = g["close"] / g["close"].rolling(252).min() - 1

        # ⑩ 크로스-에셋 조인
        g = g.merge(cross, on="as_of_date", how="left")

        # ⑪ VIX 레짐
        g["regime"] = 0
        g.loc[g["vix_close"] < 15, "regime"] = 1
        g.loc[g["vix_close"] > 25, "regime"] = 2
        g.loc[g["vix_close"] > 35, "regime"] = 3

        # ⑫ FOMC 이벤트 피처
        def _days_to_next_fomc(dt):
            future = FOMC_DATES[FOMC_DATES >= dt]
            return (future[0] - dt).days if len(future) else 30
        g["days_to_fomc"] = g["as_of_date"].apply(_days_to_next_fomc)
        g["is_fomc_week"]  = (g["days_to_fomc"] <= 5).astype(int)

        # ⑬ CPI 이벤트 피처
        def _days_to_next_cpi(dt):
            future = CPI_DATES[CPI_DATES >= dt]
            return (future[0] - dt).days if len(future) else 30
        g["days_to_cpi"] = g["as_of_date"].apply(_days_to_next_cpi)
        g["is_cpi_week"]  = (g["days_to_cpi"] <= 5).astype(int)

        # ⑭ 실적 발표 이벤트 피처
        if earnings_dates and symbol in earnings_dates:
            symbol_earnings = earnings_dates[symbol]
            def _days_to_next_earnings(dt):
                future = symbol_earnings[symbol_earnings >= dt]
                return (future[0] - dt).days if len(future) else 90  # 90일 기본값
            g["days_to_earnings"] = g["as_of_date"].apply(_days_to_next_earnings)
            g["is_earnings_week"] = (g["days_to_earnings"] <= 5).astype(int)
        else:
            g["days_to_earnings"] = 90
            g["is_earnings_week"] = 0

        # ⑮ Retention Context Features (진입 맥락)
        # return_entry는 현재 가격이 주요 이동평균에서 얼마나 떨어져 있는지 추적
        # 다양한 진입 포인트에서의 발동 조건을 파악하는 데 도움
        g["return_entry_sma50"]  = (g["close"] - g["sma_50"]) / g["sma_50"].replace(0, np.nan)
        g["return_entry_sma200"] = (g["close"] - g["sma_200"]) / g["sma_200"].replace(0, np.nan)
        
        # 단기-중기 모멘텀 차이 (가속도 추적)
        g["momentum_accel"] = g["return_1d"] - g["return_1d"].shift(1)
        
        # 진입 신뢰도: 고/저 근처에서의 가격 위치
        g["entry_confidence"] = (g["close"] - g["low"].rolling(20).min()) / (g["high"].rolling(20).max() - g["low"].rolling(20).min()).replace(0, np.nan)

        frames.append(g)

    return pd.concat(frames, ignore_index=True)


def build_cross_asset(df_all: pd.DataFrame) -> pd.DataFrame:
    """크로스-에셋 피처 테이블 생성 — KR 추가 피처 포함"""
    rows = []

    for key, sym in CROSS_ASSET_SYMBOLS.items():
        sub = df_all[df_all["symbol"] == sym][["as_of_date", "close", "rsi"]].copy()
        if sub.empty:
            continue
        sub = sub.sort_values("as_of_date").reset_index(drop=True)
        sub[f"{key}_close"]  = sub["close"]
        sub[f"{key}_ret_1d"] = sub["close"].pct_change(1)
        sub[f"{key}_ret_5d"] = sub["close"].pct_change(5)
        cols = ["as_of_date", f"{key}_close", f"{key}_ret_1d", f"{key}_ret_5d"]

        # KR 전용 추가 피처
        if key == "kospi":
            sub["kospi_ret_20d"] = sub["close"].pct_change(20)
            sub["kospi_rsi"]     = sub["rsi"]
            cols += ["kospi_ret_20d", "kospi_rsi"]
        elif key == "usdkrw":
            ma20 = sub["close"].rolling(20).mean()
            sub["usdkrw_vs_ma20"] = (sub["close"] / ma20.replace(0, np.nan) - 1)
            cols += ["usdkrw_vs_ma20"]

        rows.append(sub[cols])

    if not rows:
        return pd.DataFrame(columns=["as_of_date"])

    cross = rows[0]
    for r in rows[1:]:
        cross = cross.merge(r, on="as_of_date", how="outer")

    return cross.sort_values("as_of_date").reset_index(drop=True)


# ── 레이블 생성 ──────────────────────────────────────────────────────────────

def make_labels(
    df: pd.DataFrame,
    forward_days: int = FORWARD_DAYS,
    binary: bool = False,
) -> pd.DataFrame:
    """
    n거래일 후 수익률 → 레이블 생성
    binary=True : 1일 후 상승(1) / 하락(0) 이진 분류
    binary=False: forward_days 후 수익률 기반 3분류 (매수/관망/매도)
    """
    frames = []

    for symbol, grp in df.groupby("symbol"):
        g = grp.copy().sort_values("as_of_date").reset_index(drop=True)

        g["forward_ret"] = g["close"].shift(-forward_days) / g["close"] - 1

        if binary:
            g["label"] = (g["forward_ret"] > 0).astype(int)  # 1=상승, 0=하락
        else:
            buy_th, sell_th = _get_label_threshold(symbol)
            g["label"] = 0
            g.loc[g["forward_ret"] >= buy_th,  "label"] =  1
            g.loc[g["forward_ret"] <= sell_th, "label"] = -1

        frames.append(g)

    return pd.concat(frames, ignore_index=True)


# ── 학습 ────────────────────────────────────────────────────────────────────

def walk_forward_validation(
    X: pd.DataFrame,
    y_lgb: pd.Series,
    lgb_params: dict,
    n_splits: int = 5,
    train_months: int = 24,
    market_label: str = "",
) -> list[float]:
    """
    월 단위 Walk-Forward Validation.
    매 스텝마다 최근 train_months 개월 데이터로 재학습 후 다음 달 검증.
    returns: fold별 accuracy 리스트
    """
    tag = f"[{market_label}]" if market_label else ""
    dates = X.index  # as_of_date가 index에 있어야 함 (호출 전 set_index 필요)
    unique_months = pd.Series(dates).dt.to_period("M").unique()
    unique_months = sorted(unique_months)

    if len(unique_months) < train_months + n_splits:
        print(f"[WARN]{tag} 데이터 부족으로 Walk-Forward 스킵 "
              f"({len(unique_months)}개월 < {train_months + n_splits})", file=sys.stderr)
        return []

    scores = []
    eval_months = unique_months[train_months:][:n_splits]

    print(f"\n{tag} Walk-Forward Validation ({n_splits} steps, train={train_months}M)...",
          file=sys.stderr)

    for i, val_month in enumerate(eval_months):
        train_end   = val_month - 1
        train_start = train_end - train_months + 1

        train_mask = pd.Series(dates).dt.to_period("M").between(train_start, train_end).values
        val_mask   = (pd.Series(dates).dt.to_period("M") == val_month).values

        if train_mask.sum() < 50 or val_mask.sum() < 5:
            continue

        X_tr, X_val = X.iloc[train_mask], X.iloc[val_mask]
        y_tr, y_val = y_lgb.iloc[train_mask], y_lgb.iloc[val_mask]

        m = lgb.LGBMClassifier(**lgb_params)
        m.fit(X_tr, y_tr, callbacks=[lgb.log_evaluation(0)])
        acc = accuracy_score(y_val, m.predict(X_val))
        scores.append(acc)
        print(f"  Step {i+1} ({val_month}): accuracy={acc:.4f} / "
              f"train={len(X_tr)} val={len(X_val)}", file=sys.stderr)

    if scores:
        print(f"{tag} Walk-Forward CV: {np.mean(scores):.4f} ± {np.std(scores):.4f}",
              file=sys.stderr)
    return scores


def optuna_tune(
    X: pd.DataFrame,
    y_lgb: pd.Series,
    n_trials: int = 50,
    market_label: str = "",
    binary: bool = False,
    forward_days: int = FORWARD_DAYS,
) -> dict:
    """Optuna로 LightGBM 하이퍼파라미터 최적화 (3-fold TimeSeriesSplit)"""
    if not OPTUNA_AVAILABLE:
        print("[WARN] optuna 미설치 → 튜닝 스킵. pip install optuna", file=sys.stderr)
        return {}

    tscv = TimeSeriesSplit(n_splits=3, gap=forward_days)

    def objective(trial: "optuna.Trial") -> float:
        base_params = {
            "verbose":           -1,
            "is_unbalance":      True,
            "bagging_freq":      5,
            "n_estimators":      trial.suggest_int("n_estimators", 300, 800),
            "num_leaves":        trial.suggest_int("num_leaves", 20, 100),
            "max_depth":         trial.suggest_int("max_depth", 4, 8),
            "learning_rate":     trial.suggest_float("learning_rate", 0.02, 0.1, log=True),
            "min_child_samples": trial.suggest_int("min_child_samples", 10, 50),
            "feature_fraction":  trial.suggest_float("feature_fraction", 0.6, 1.0),
            "bagging_fraction":  trial.suggest_float("bagging_fraction", 0.6, 1.0),
            "reg_alpha":         trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda":        trial.suggest_float("reg_lambda", 0.0, 1.0),
            "min_split_gain":    trial.suggest_float("min_split_gain", 0.0, 0.1),
        }
        if binary:
            base_params.update({"objective": "binary", "metric": "binary_logloss"})
        else:
            base_params.update({"objective": "multiclass", "num_class": 3, "metric": "multi_logloss"})

        fold_scores = []
        for train_idx, val_idx in tscv.split(X):
            X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
            y_tr, y_val = y_lgb.iloc[train_idx], y_lgb.iloc[val_idx]

            model = lgb.LGBMClassifier(**base_params)
            model.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.early_stopping(30, verbose=False), lgb.log_evaluation(0)],
            )
            fold_scores.append(balanced_accuracy_score(y_val, model.predict(X_val)))

        return float(np.mean(fold_scores))

    tag = f"[{market_label}]" if market_label else ""
    mode = "binary" if binary else "multiclass"
    print(f"\n[OPTUNA]{tag} {n_trials}회 탐색 시작 (3-fold / {mode} / balanced_accuracy)...", file=sys.stderr)
    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)

    best = study.best_params
    print(f"[OPTUNA]{tag} 최적 Balanced Accuracy: {study.best_value:.4f}", file=sys.stderr)
    for k, v in best.items():
        print(f"  {k:25s}: {v}", file=sys.stderr)

    return best


def train_market(
    df: pd.DataFrame,
    feature_cols: list[str],
    model_path: Path,
    market_label: str = "",
    tune: bool = False,
    n_trials: int = 50,
    stack: bool = False,
    walk_forward: bool = False,
    binary: bool = False,
    forward_days: int = FORWARD_DAYS,
    calibration: str = "platt",  # "platt", "iso", "beta", "all"
):
    """단일 시장(US 또는 KR) 모델 학습"""
    tag = f"[{market_label}]" if market_label else ""

    df_train = df.dropna(subset=["label", "forward_ret"]).copy()
    df_train = df_train[df_train["forward_ret"].notna()]

    available_features = [c for c in feature_cols if c in df_train.columns]
    missing = [c for c in feature_cols if c not in df_train.columns]
    if missing:
        print(f"[WARN]{tag} 누락 피처 (스킵): {missing}", file=sys.stderr)

    df_train = df_train.sort_values("as_of_date").reset_index(drop=True)

    X = df_train[available_features].astype(float)
    y = df_train["label"].astype(int)
    # binary: label은 0/1 그대로, multiclass: -1→0, 0→1, 1→2
    y_lgb = y if binary else (y + 1)

    print(f"\n{tag} 학습 데이터: {len(X)}행 / 피처: {len(available_features)}개", file=sys.stderr)
    if binary:
        print(f"{tag} 레이블 분포: 하락={(y==0).sum()} / 상승={(y==1).sum()} "
              f"(상승비율={((y==1).sum()/len(y)*100):.1f}%)", file=sys.stderr)
    else:
        print(f"{tag} 레이블 분포: 매도={(y==-1).sum()} / 관망={(y==0).sum()} / 매수={(y==1).sum()}", file=sys.stderr)
    print(f"{tag} 종목: {sorted(df_train['symbol'].unique().tolist())}", file=sys.stderr)

    tscv = TimeSeriesSplit(n_splits=5, gap=forward_days)
    cv_scores = []

    if binary:
        lgb_params = {
            "objective":         "binary",
            "metric":            "binary_logloss",
            "learning_rate":     0.05,
            "num_leaves":        31,
            "min_child_samples": 20,
            "feature_fraction":  0.8,
            "bagging_fraction":  0.8,
            "bagging_freq":      5,
            "verbose":           -1,
            "n_estimators":      500,
            "is_unbalance":      True,
        }
    else:
        lgb_params = {
            "objective":         "multiclass",
            "num_class":         3,
            "metric":            "multi_logloss",
            "learning_rate":     0.05,
            "num_leaves":        31,
            "min_child_samples": 20,
            "feature_fraction":  0.8,
            "bagging_fraction":  0.8,
            "bagging_freq":      5,
            "verbose":           -1,
            "n_estimators":      500,
            "is_unbalance":      True,
        }

    if tune:
        best_params = optuna_tune(
            X, y_lgb, n_trials=n_trials,
            market_label=market_label, binary=binary, forward_days=forward_days,
        )
        if best_params:
            lgb_params.update(best_params)

    bal_scores = []
    print(f"\n{tag} TimeSeriesSplit 교차검증 시작...", file=sys.stderr)
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
        bal_acc = balanced_accuracy_score(y_val, preds)
        cv_scores.append(acc)
        bal_scores.append(bal_acc)
        print(f"  Fold {fold+1}: accuracy={acc:.4f} / balanced={bal_acc:.4f} / val_size={len(val_idx)}", file=sys.stderr)

    print(f"\n{tag} CV Accuracy:     {np.mean(cv_scores):.4f} ± {np.std(cv_scores):.4f}", file=sys.stderr)
    print(f"{tag} CV Balanced Acc: {np.mean(bal_scores):.4f} ± {np.std(bal_scores):.4f}", file=sys.stderr)

    if walk_forward:
        X_wf = X.copy()
        X_wf.index = df_train["as_of_date"].values
        walk_forward_validation(X_wf, y_lgb, lgb_params, market_label=market_label)

    print(f"\n{tag} 전체 데이터로 최종 모델 학습 중...", file=sys.stderr)
    base_model = lgb.LGBMClassifier(**lgb_params)
    base_model.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])

    # ==================== Calibration 방식 선택 ====================
    calibration_methods = []
    if calibration == "all":
        # Beta Calibration은 binary classification만 지원
        if n_classes == 2:
            calibration_methods = ["platt", "iso", "beta"]
        else:
            # Multiclass: Platt과 ISO만 사용 (Beta는 복잡하고 multiclass에 비효율)
            calibration_methods = ["platt", "iso"]
            print(f"\n{tag} Beta Calibration은 multiclass에서 지원하지 않음 (Platt/ISO만 사용)", file=sys.stderr)
    else:
        calibration_methods = [calibration]
    
    models_to_save = []

    for cal_method in calibration_methods:
        print(f"\n{tag} [{cal_method.upper()}] Calibration 적용 중...", file=sys.stderr)

        if cal_method == "platt":
            # Platt Scaling (시그모이드 함수)
            model_cal_base = lgb.LGBMClassifier(**lgb_params)
            model_cal_base.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])
            model_cal = CalibratedClassifierCV(model_cal_base, method="sigmoid", cv=3)
            model_cal.fit(X, y_lgb)
            cal_name = "platt_scaling"

        elif cal_method == "iso":
            # ISO Regression (isotonic calibration)
            model_cal_base = lgb.LGBMClassifier(**lgb_params)
            model_cal_base.fit(X, y_lgb, callbacks=[lgb.log_evaluation(0)])
            model_cal = CalibratedClassifierCV(model_cal_base, method="isotonic", cv=3)
            model_cal.fit(X, y_lgb)
            cal_name = "iso_regression"

        elif cal_method == "beta":
            # Beta Calibration (커스텀 구현, binary only)
            if n_classes == 2:
                model_cal_base = lgb.LGBMClassifier(**lgb_params)
                model_cal = BetaCalibratedModel(model_cal_base)
                model_cal.fit(X.values, y_lgb.values)
                cal_name = "beta_calibration"
            else:
                print(f"  {tag} [BETA] Skipped for multiclass problem", file=sys.stderr)
                continue
        
        probs_sample = model_cal.predict_proba(X[:100])
        print(f"  {tag} [{cal_method.upper()}] 신뢰도 샘플: min={probs_sample[:, 1].min():.4f} / max={probs_sample[:, 1].max():.4f} / avg={probs_sample[:, 1].mean():.4f}", file=sys.stderr)
        
        models_to_save.append({
            "method": cal_method,
            "model": model_cal,
            "name": cal_name,
        })

    # 피처 중요도
    importances = pd.Series(base_model.feature_importances_, index=available_features)
    importances = importances.sort_values(ascending=False)
    print(f"\n{tag} 피처 중요도 (상위 10):", file=sys.stderr)
    for feat, imp in importances.head(10).items():
        print(f"  {feat:30s}: {imp}", file=sys.stderr)

    # 모델 저장
    model_path.parent.mkdir(parents=True, exist_ok=True)
    
    for model_info in models_to_save:
        cal_method = model_info["method"]
        model_cal = model_info["model"]
        cal_name = model_info["name"]
        
        # 저장 경로 (calibration 방식에 따라 다름)
        if calibration == "all":
            save_path = model_path.with_stem(f"{model_path.stem}_{cal_method}")
        else:
            save_path = model_path
        
        joblib.dump({
            "model":              model_cal,
            "features":           available_features,
            "cv_accuracy":        float(np.mean(cv_scores)),
            "cv_balanced_acc":    float(np.mean(bal_scores)),
            "lgb_params":         lgb_params,"trained_at":         date.today().isoformat(),
            "market":             market_label,
            "symbols":            sorted(df_train["symbol"].unique().tolist()),
            "binary":             binary,
            "calibration_method": cal_name,
            "model_version":      "CALIBRATED",
        }, save_path)
        print(f"{tag} [{cal_method.upper()}] 저장: {save_path}", file=sys.stderr)

    # 모델 정보 반환 (예측 시 필요)
    return {
        "model": models_to_save[0]["model"] if models_to_save else base_model,
        "features": available_features,
    }, available_features, df_train


# ── 예측 및 Supabase upsert ──────────────────────────────────────────────────

def generate_summary_text(
    ticker: str,
    market: str,
    signal_label: str,
    signal_score: int,
    buy_prob: float,
    sell_prob: float,
    contributions: list[dict],
    row=None,
) -> str:
    """
    피처 값을 분석해 규칙 기반 한국어 분석 텍스트를 생성합니다. (API 불필요)
    row: predict_and_upsert의 원본 행 (contributions에 없는 피처도 참조하기 위해 사용)
    """
    # row 전체에서 피처 값 읽기 (contributions는 상위 5개만이라 누락될 수 있음)
    def _get(key):
        if row is not None and pd.notna(row.get(key)):
            return float(row[key])
        # fallback: contributions에서 탐색
        for c in contributions:
            if c["feature"] == key and c.get("value") is not None:
                return c["value"]
        return None

    fv = {key: _get(key) for key in [
        "return_5d", "return_20d", "rsi", "bb_position",
        "vix_close", "usdkrw_ret_1d", "tnx_ret_1d",
    ]}

    sentences = []

    # ── 1) 모멘텀 문장 ────────────────────────────────────────────
    r5  = fv.get("return_5d")
    r20 = fv.get("return_20d")
    if r5 is not None and r20 is not None:
        r5_pct  = r5  * 100
        r20_pct = r20 * 100
        if r5_pct > 3:
            mom_str = f"5일 수익률 {r5_pct:+.1f}%의 강한 단기 상승 모멘텀이 확인됩니다."
        elif r5_pct > 0:
            mom_str = f"5일 수익률 {r5_pct:+.1f}%로 단기 흐름이 소폭 우세합니다."
        elif r5_pct > -3:
            mom_str = f"5일 수익률 {r5_pct:+.1f}%로 단기 흐름이 약세를 보이고 있습니다."
        else:
            mom_str = f"5일 수익률 {r5_pct:+.1f}%의 뚜렷한 단기 하락 압력이 나타나고 있습니다."
        if abs(r20_pct) > 5:
            trend = "상승" if r20_pct > 0 else "하락"
            mom_str += f" 20일 기준으로도 {r20_pct:+.1f}% {trend} 추세가 지속 중입니다."
        sentences.append(mom_str)

    # ── 2) 기술적 지표 문장 (RSI + BB) ───────────────────────────
    rsi    = fv.get("rsi")
    bb_pos = fv.get("bb_position")
    tech_parts = []
    if rsi is not None:
        if rsi >= 70:
            tech_parts.append(f"RSI {rsi:.0f}로 과매수 구간에 진입해 있습니다")
        elif rsi <= 30:
            tech_parts.append(f"RSI {rsi:.0f}로 과매도 구간에 위치합니다")
        else:
            tech_parts.append(f"RSI {rsi:.0f}로 중립 구간을 유지 중입니다")
    if bb_pos is not None:
        if bb_pos > 0.8:
            tech_parts.append("볼린저밴드 상단 근접으로 단기 과열 가능성이 있습니다")
        elif bb_pos < 0.2:
            tech_parts.append("볼린저밴드 하단 근접으로 반등 가능성이 있습니다")
    if tech_parts:
        sentences.append(". ".join(tech_parts) + ".")

    # ── 3) 크로스에셋/거시 문장 ───────────────────────────────────
    vix      = fv.get("vix_close")
    usdkrw   = fv.get("usdkrw_ret_1d")
    tnx      = fv.get("tnx_ret_1d")
    macro_parts = []
    if vix is not None:
        if vix >= 25:
            macro_parts.append(f"VIX {vix:.1f}로 시장 불안심리가 높은 상태입니다")
        elif vix <= 15:
            macro_parts.append(f"VIX {vix:.1f}로 시장 변동성이 낮아 안정적 흐름입니다")
    if market == "KR" and usdkrw is not None:
        usdkrw_pct = usdkrw * 100
        if usdkrw_pct > 0.5:
            macro_parts.append(f"원/달러 {usdkrw_pct:+.2f}% 상승으로 외국인 수급에 부담이 있습니다")
        elif usdkrw_pct < -0.5:
            macro_parts.append(f"원/달러 {usdkrw_pct:+.2f}% 하락으로 원화 강세가 수급에 우호적입니다")
    if tnx is not None:
        tnx_pct = tnx * 100
        if tnx_pct > 2:
            macro_parts.append(f"미국채 10년물 금리가 {tnx_pct:+.2f}% 상승해 밸류에이션 압박이 있습니다")
    if macro_parts:
        sentences.append(". ".join(macro_parts) + ".")

    # ── 4) 최종 신호 결론 ────────────────────────────────────────
    label_ko = {"BUY": "매수", "SELL": "매도", "HOLD": "관망"}.get(signal_label, signal_label)
    conclusion = (
        f"종합적으로 AI 모델은 {label_ko} 신호를 제시하며 "
        f"상승 확률 {buy_prob*100:.1f}%, 스코어 {signal_score}점으로 평가됩니다."
    )
    sentences.append(conclusion)

    return " ".join(sentences)


def predict_and_upsert(client, model_specs: list[dict], df: pd.DataFrame, ab_version: str = "all"):
    """
    예측 및 Supabase upsert
    
    model_specs: [{"model": ..., "features": [...], "symbols": [...], ...}, ...]
    각 종목에 알맞은 모델로 예측 후 ai_predictions + signal_history upsert
    """
    # symbol → model spec 매핑
    symbol_to_spec = {}
    for spec in model_specs:
        for sym in spec["symbols"]:
            symbol_to_spec[sym] = spec

    latest = df.sort_values("as_of_date").groupby("symbol").last().reset_index()

    rows_to_upsert = []
    for _, row in latest.iterrows():
        symbol = row["symbol"]

        spec = symbol_to_spec.get(symbol)
        if spec is None:
            print(f"[WARN] {symbol}: 매핑된 모델 없음, 스킵", file=sys.stderr)
            continue

        features = spec["features"]
        is_binary = spec.get("binary", False)
        model = spec.get("model")
        
        if model is None:
            print(f"[WARN] {symbol}: 모델이 없음, 스킵", file=sys.stderr)
            continue

        X_pred = pd.DataFrame([row[features].values], columns=features, dtype=float)
        if X_pred.isnull().all(axis=1).iloc[0]:
            print(f"[WARN] {symbol}: 피처 전부 null, 예측 스킵", file=sys.stderr)
            continue

        proba = model.predict_proba(X_pred)[0]
        pred_class = int(model.predict(X_pred)[0])

        if is_binary:
            # binary: proba=[P(down), P(up)], classes=[0,1]
            label_map_spec = {0: "SELL", 1: "BUY"}
            buy_prob  = float(proba[1])
            sell_prob = float(proba[0])
            breakdown = {"up_prob": round(buy_prob, 4), "down_prob": round(sell_prob, 4)}
            log_extra = f"up={buy_prob:.2f} down={sell_prob:.2f}"
        else:
            # multiclass: proba=[P(SELL), P(HOLD), P(BUY)], classes=[0,1,2]
            label_map_spec = {0: "SELL", 1: "HOLD", 2: "BUY"}
            buy_prob  = float(proba[2])
            sell_prob = float(proba[0])
            breakdown = {
                "buy_prob":  round(buy_prob, 4),
                "hold_prob": round(float(proba[1]), 4),
                "sell_prob": round(sell_prob, 4),
            }
            log_extra = f"buy={buy_prob:.2f} hold={float(proba[1]):.2f} sell={sell_prob:.2f}"

        pred_label   = label_map_spec[pred_class]
        signal_score = int((buy_prob - sell_prob + 1) / 2 * 100)

        # 모델 feature importance 기준 상위 5개 피처를 contributions로 사용
        try:
            base_model = model.estimator if hasattr(model, "estimator") else model
            if hasattr(base_model, "feature_importances_"):
                imp = base_model.feature_importances_
                top_idx = np.argsort(imp)[::-1][:5]
                top_features = [features[i] for i in top_idx if i < len(features)]
            else:
                top_features = features[:5]
        except Exception:
            top_features = features[:5]

        contributions = [
            {"feature": f, "value": float(row[f]) if pd.notna(row.get(f)) else None}
            for f in top_features
        ]

        market_str = spec.get("market", "?")
        summary = generate_summary_text(
            ticker=symbol,
            market=market_str,
            signal_label=pred_label,
            signal_score=signal_score,
            buy_prob=buy_prob,
            sell_prob=sell_prob,
            contributions=contributions,
            row=row,
        )

        rows_to_upsert.append({
            "ticker":        symbol,
            "date":          str(row["as_of_date"].date()),
            "signal_score":  signal_score,
            "signal_label":  pred_label,
            "lgbm_prob":     buy_prob,
            "contributions": json.dumps(contributions),
            "breakdown":     json.dumps(breakdown),
            "entry_price":   float(row["close"]) if pd.notna(row.get("close")) else None,
            "entry_date":    str(row["as_of_date"].date()),
            "summary_text":  summary,
            "model_version": "A",
        })

        print(f"  [{spec.get('market','?')}] {symbol:12s}: {pred_label:4s} | score={signal_score} | {log_extra}",
              file=sys.stderr)

    if rows_to_upsert:
        # A/B 테스트 마킹 컬럼 추가
        # (기존 ai_predictions 테이블이 지원하면 저장, 아니면 로깅만)
        try:
            client.table("ai_predictions").upsert(
                rows_to_upsert, on_conflict="ticker,date,model_version"
            ).execute()
            print(f"\n[OK] ai_predictions에 {len(rows_to_upsert)}건 upsert 완료", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] ai_predictions upsert 실패: {e}", file=sys.stderr)

        history_rows = [
            {
                "etf_code":        r["ticker"],
                "as_of_date":      r["date"],
                "signal":          r["signal_label"],
                "predicted_score": r["signal_score"],
            }
            for r in rows_to_upsert
        ]
        client.table("signal_history").upsert(
            history_rows, on_conflict="etf_code,as_of_date"
        ).execute()
        print(f"[OK] signal_history에 {len(history_rows)}건 기록 완료", file=sys.stderr)


# ── main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--predict-only", action="store_true",
                        help="저장된 모델로 예측만 수행 (학습 스킵)")
    parser.add_argument("--tune", action="store_true",
                        help="Optuna 하이퍼파라미터 튜닝 후 학습")
    parser.add_argument("--n-trials", type=int, default=50,
                        help="Optuna 탐색 횟수 (기본 50)")
    parser.add_argument("--market", choices=["us", "kr", "all"], default="all",
                        help="학습/예측할 시장 선택 (기본: all)")
    parser.add_argument("--stack", action="store_true",
                        help="LightGBM + LogisticRegression Stacking 앙상블 사용")
    parser.add_argument("--walk-forward", action="store_true",
                        help="월 단위 Walk-Forward Validation 추가 실행")
    parser.add_argument("--calibration", choices=["platt", "iso", "beta", "all"], default="platt",
                        help="Calibration 방식 선택: platt (기본), iso, beta, all (세 가지 모두)")
    parser.add_argument("--ab-version", choices=["A", "B", "all"], default="all",
                        help="A/B 테스트 버전 선택: A(원본), B(캘리브된), all(양쪽, default)")
    args = parser.parse_args()

    client = get_supabase()

    # 어떤 시장을 처리할지 결정
    markets = ["us", "kr"] if args.market == "all" else [args.market]

    # 데이터 로드 (한 번만)
    all_syms = TARGET_SYMBOLS + list(CROSS_ASSET_SYMBOLS.values())
    print("[INFO] 데이터 로드 중...", file=sys.stderr)
    df_raw = load_daily_indicators(client, all_syms)

    print("[INFO] 크로스-에셋 피처 생성 중...", file=sys.stderr)
    cross = build_cross_asset(df_raw)

    print("[INFO] 실적 발표일 데이터 조회 중...", file=sys.stderr)
    earnings_dates = fetch_earnings_dates(TARGET_SYMBOLS)

    df_target = df_raw[df_raw["symbol"].isin(TARGET_SYMBOLS)].copy()
    df_feat = engineer_features(df_target, cross, earnings_dates)

    if args.predict_only:
        # 저장된 모델 로드 후 예측만
        model_specs = []
        for mkt in markets:
            cfg = MARKET_CONFIG[mkt]
            
            # Model A 로드
            model_a_path = cfg["model_path"]
            model_b_path = model_a_path.with_stem(model_a_path.stem + "_calibrated")
            
            spec_item = {}
            
            if args.ab_version in ["A", "all"]:
                if not model_a_path.exists():
                    print(f"[WARN] {cfg['label']} Model A 없음: {model_a_path}", file=sys.stderr)
                else:
                    saved_a = joblib.load(model_a_path)
                    print(f"[INFO] {cfg['label']} Model A 로드 (학습일: {saved_a['trained_at']}, "
                          f"CV acc: {saved_a['cv_accuracy']:.4f}, calibration: {saved_a.get('calibration_method', 'unknown')})", file=sys.stderr)
                    spec_item["model_a"] = saved_a["model"]
                    spec_item["features"] = saved_a["features"]
                    spec_item["binary"] = saved_a.get("binary", False)

            if args.ab_version in ["B", "all"]:
                if not model_b_path.exists():
                    print(f"[WARN] {cfg['label']} Model B 없음: {model_b_path}", file=sys.stderr)
                else:
                    saved_b = joblib.load(model_b_path)
                    print(f"[INFO] {cfg['label']} Model B 로드 (학습일: {saved_b['trained_at']}, "
                          f"CV acc: {saved_b['cv_accuracy']:.4f}, calibration: {saved_b.get('calibration_method', 'unknown')})", file=sys.stderr)
                    spec_item["model_b"] = saved_b["model"]
                    if "features" not in spec_item:
                        spec_item["features"] = saved_b["features"]
                        spec_item["binary"] = saved_b.get("binary", False)

            if spec_item:
                spec_item["symbols"] = cfg["symbols"]
                spec_item["market"] = cfg["label"]
                # predict_and_upsert는 spec["model"]을 참조하므로 model_a를 기본 모델로 설정
                if "model_a" in spec_item and "model" not in spec_item:
                    spec_item["model"] = spec_item["model_a"]
                model_specs.append(spec_item)

        if not model_specs:
            print("ERROR: 사용 가능한 저장 모델이 없습니다. 먼저 학습을 실행하세요.", file=sys.stderr)
            sys.exit(1)

        print("\n[INFO] 예측 결과:", file=sys.stderr)
        predict_and_upsert(client, model_specs, df_feat, ab_version=args.ab_version)

    else:
        # 학습 + 예측 — 시장별로 forward_days/binary 다르게 레이블 생성
        labeled_parts = []
        for mkt in markets:
            cfg = MARKET_CONFIG[mkt]
            df_mkt_raw = df_feat[df_feat["symbol"].isin(cfg["symbols"])].copy()
            labeled_parts.append(make_labels(
                df_mkt_raw,
                forward_days=cfg["forward_days"],
                binary=cfg["binary"],
            ))
        df_labeled = pd.concat(labeled_parts, ignore_index=True)
        model_specs = []

        for mkt in markets:
            cfg = MARKET_CONFIG[mkt]
            df_mkt = df_labeled[df_labeled["symbol"].isin(cfg["symbols"])].copy()

            if df_mkt.empty:
                print(f"[WARN] {cfg['label']}: 데이터 없음, 스킵", file=sys.stderr)
                continue

            print(f"\n{'='*60}", file=sys.stderr)
            print(f"  {cfg['label']} 모델 학습 (forward={cfg['forward_days']}일 / "
                  f"{'이진' if cfg['binary'] else '3분류'})", file=sys.stderr)
            print(f"{'='*60}", file=sys.stderr)

            models_dict, features, _ = train_market(
                df_mkt,
                feature_cols=cfg["features"],
                model_path=cfg["model_path"],
                market_label=cfg["label"],
                tune=args.tune,
                n_trials=args.n_trials,
                stack=args.stack,
                walk_forward=args.walk_forward,
                binary=cfg["binary"],
                forward_days=cfg["forward_days"],
                calibration=args.calibration,  # ← 파라미터 전달
            )

            # Model spec 구성 (calibration 방식에 상관없이 첫 모델 사용)
            spec_item = {
                "model": models_dict["model"],
                "features": features,
                "symbols":  cfg["symbols"],
                "market":   cfg["label"],
                "binary":   cfg["binary"],
            }
            model_specs.append(spec_item)

        print("\n[INFO] 최신 예측 생성 중...", file=sys.stderr)
        predict_and_upsert(client, model_specs, df_labeled, ab_version=args.ab_version)

    print("\n[DONE]", file=sys.stderr)


if __name__ == "__main__":
    main()
