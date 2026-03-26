# AI 분석 파이프라인 설계 문서
## LightGBM + LLM 하이브리드 구조 — Global Market Bridge AI

- 작성일: 2026-03-26
- 문서 상태: 설계 초안 (Design Draft)
- 연계 문서: `PRD_Global_Market_Bridge_AI_v1.0.md`

---

## 1. 전체 파이프라인 개요

```
[Raw Data Layer]
    ├── 정형(Numeric): KIS API / ECOS / FRED / yfinance
    └── 비정형(Text): 네이버 뉴스 / ApeWisdom (Reddit)
              ↓
[Step A — LLM Sentiment Engine]
    텍스트 → Sentiment Score (-1.0 ~ +1.0)
              ↓
[Feature Assembly Layer]
    수치 피처 + Sentiment Score → Feature Matrix
              ↓
[Step B — LightGBM Predictor]
    분류(Up/Down) + 회귀(변화율 예측)
              ↓
[Step C — Explainability Layer]
    SHAP Feature Importance → 기여도 JSON
              ↓
[Signal Score Engine]
    가중 합산 → Signal Score (0 ~ 100)
              ↓
[UX Visual Output]
    신호등 컬러 / 레이더 차트 / 기여도 바 / 요약 문장
```

---

## 2. Step A — LLM 감성 분석 엔진

### 2.1 설계 원칙

- LLM은 **분류기가 아닌 수치 변환기**로 사용한다.
- 출력 형식을 JSON으로 강제하여 파싱 오류를 차단한다.
- 뉴스 헤드라인과 Reddit 코멘트는 **분리 호출 후 가중 평균**으로 합산한다.

### 2.2 프롬프트 설계

```python
SYSTEM_PROMPT = """
당신은 주식 시장 감성 분석 전문가입니다.
입력된 텍스트를 읽고 아래 JSON 형식만 출력하세요.
절대 다른 텍스트를 포함하지 마세요.

출력 형식:
{
  "score": <float, -1.0 ~ 1.0>,
  "confidence": <float, 0.0 ~ 1.0>,
  "reason": "<한 줄 근거>"
}

평가 기준:
- +1.0: 매우 강한 호재 (실적 서프라이즈, 대규모 수주, 금리 인하 확정)
- +0.5: 완만한 호재 (긍정적 전망, 업종 수혜 기대)
-  0.0: 중립 또는 혼재
- -0.5: 완만한 악재 (실적 우려, 규제 리스크 언급)
- -1.0: 매우 강한 악재 (파산, 회계 부정, 전쟁 확전)
"""

USER_PROMPT_TEMPLATE = """
종목: {ticker}
날짜: {date}
텍스트 목록:
{texts}
"""
```

### 2.3 API 호출 구조 (Python)

```python
# scripts/sentiment_engine.py
import json
from anthropic import Anthropic  # 또는 openai

client = Anthropic()

def get_sentiment(ticker: str, date: str, texts: list[str]) -> dict:
    """
    texts: 헤드라인 또는 코멘트 리스트 (최대 10개 권장)
    반환: {"score": float, "confidence": float, "reason": str}
    """
    joined = "\n".join(f"- {t}" for t in texts[:10])

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": USER_PROMPT_TEMPLATE.format(
                ticker=ticker, date=date, texts=joined
            )
        }]
    )

    raw = message.content[0].text.strip()
    result = json.loads(raw)  # 파싱 실패 시 아래 fallback 처리
    return result


def get_combined_sentiment(ticker: str, date: str,
                            news_texts: list[str],
                            reddit_texts: list[str]) -> float:
    """
    뉴스(가중치 0.6) + Reddit(가중치 0.4) 가중 평균 반환
    """
    news_result   = get_sentiment(ticker, date, news_texts)
    reddit_result = get_sentiment(ticker, date, reddit_texts)

    news_score   = news_result.get("score", 0.0)
    reddit_score = reddit_result.get("score", 0.0)

    combined = (news_score * 0.6) + (reddit_score * 0.4)
    return round(combined, 4)
```

### 2.4 비용/속도 최적화

| 전략 | 내용 |
|---|---|
| 배치 처리 | 장 마감 후 일괄 호출 (실시간 불필요) |
| 캐싱 | Supabase `sentiment_cache` 테이블에 날짜+종목 기준 저장, 당일 재호출 방지 |
| Fallback | JSON 파싱 실패 시 score=0.0 처리, 오류 로그 기록 |
| 토큰 절감 | 텍스트 10개 이하로 슬라이싱, 헤드라인만 사용 (본문 제외) |

---

## 3. Step B — LightGBM 학습 구조

### 3.1 피처 매트릭스 구성

```
Feature Matrix (1행 = 1 거래일)
─────────────────────────────────────────────────────
[수급 그룹]
  foreigner_net_buy          외국인 순매수 금액
  institution_net_buy        기관 순매수 금액
  program_buy_ratio          프로그램 매수 비율
  foreigner_5d_streak        외국인 5일 연속 순매수 여부 (0/1/연속일수)

[기술적 지표 그룹]
  rsi_14                     RSI(14)
  macd_signal                MACD 시그널
  bb_position                볼린저밴드 내 위치 (0~1)
  volume_ratio               거래량 / 20일 평균 거래량

[거시경제 그룹]
  us_fed_rate                연방금리
  us_cpi_yoy                 미국 CPI 전년비
  usd_krw                    원달러 환율
  vix                        VIX 공포지수

[글로벌 시장 그룹]
  sp500_return_1d            S&P500 전일 등락률
  nasdaq_future_pct          나스닥 선물 등락률 (시초 전)
  us_10y_yield               미국 10년 국채 금리

[감성 분석 그룹]  ← LLM 출력 연결
  sentiment_news             네이버 뉴스 감성 점수 (-1~1)
  sentiment_reddit           Reddit 감성 점수 (-1~1)
  sentiment_combined         가중 평균 감성 점수
  fear_greed_index           공포/탐욕 지수 (0~100)
─────────────────────────────────────────────────────
[Target]
  target_direction           익일 방향 (1=상승, 0=하락)  ← 분류
  target_return              익일 수익률 (%)              ← 회귀 (선택)
```

### 3.2 연속성 피처 생성 코드

```python
# scripts/feature_engineering.py
import pandas as pd
import numpy as np

def add_streak_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    df: 날짜순 정렬된 DataFrame, 'foreigner_net_buy' 컬럼 포함
    """
    df = df.copy().sort_values("date").reset_index(drop=True)

    # --- 외국인 5일 연속 순매수 여부 (bool) ---
    df["foreigner_buy_flag"] = (df["foreigner_net_buy"] > 0).astype(int)

    streak = []
    current = 0
    for flag in df["foreigner_buy_flag"]:
        current = current + 1 if flag == 1 else 0
        streak.append(current)

    df["foreigner_buy_streak"] = streak  # 연속 매수일수 (0, 1, 2, 3 ...)
    df["foreigner_5d_streak"]  = (df["foreigner_buy_streak"] >= 5).astype(int)

    # --- 기관 3일 연속 순매도 여부 ---
    df["institution_sell_flag"] = (df["institution_net_buy"] < 0).astype(int)

    sell_streak = []
    current = 0
    for flag in df["institution_sell_flag"]:
        current = current + 1 if flag == 1 else 0
        sell_streak.append(current)

    df["institution_sell_streak"] = sell_streak
    df["institution_3d_sell"]     = (df["institution_sell_streak"] >= 3).astype(int)

    # --- 5일 이동 감성 평균 ---
    df["sentiment_5d_ma"] = (
        df["sentiment_combined"].rolling(window=5, min_periods=1).mean()
    )

    return df


def add_technical_features(df: pd.DataFrame) -> pd.DataFrame:
    """RSI, MACD, 볼린저밴드 위치 추가"""
    close = df["close"]

    # RSI(14)
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss.replace(0, np.nan)
    df["rsi_14"] = 100 - (100 / (1 + rs))

    # MACD Signal
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd  = ema12 - ema26
    df["macd_signal"] = macd - macd.ewm(span=9, adjust=False).mean()

    # 볼린저밴드 위치 (0=하단, 1=상단)
    ma20  = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    upper = ma20 + 2 * std20
    lower = ma20 - 2 * std20
    df["bb_position"] = (close - lower) / (upper - lower).replace(0, np.nan)

    # 거래량 비율
    df["volume_ratio"] = df["volume"] / df["volume"].rolling(20).mean()

    return df
```

### 3.3 전처리 주의사항

| 항목 | 주의점 | 권장 처리 |
|---|---|---|
| **Scaling** | LightGBM은 트리 기반이라 스케일 영향 없음. Scaling 불필요 | 모델 입력 전 정규화 생략 가능. 단, 신경망 앙상블 추가 시에만 StandardScaler 적용 |
| **Leakage** | Target(익일 수익률)을 피처로 사용하면 데이터 누수 발생 | 반드시 `shift(-1)`로 1일 미래 타겟 생성 후 NaN 행 제거 |
| **시계열 분할** | `train_test_split` 랜덤 분할 금지 (미래 데이터가 학습에 포함됨) | `TimeSeriesSplit` 또는 날짜 기준 고정 분할 (예: 마지막 3개월 = 테스트) |
| **Resampling** | 상승/하락 비율 불균형 시 SMOTE 사용 금지 (시계열 왜곡) | `scale_pos_weight` 파라미터 또는 클래스 가중치로 대응 |
| **결측치** | 공휴일, 서킷브레이커 등으로 데이터 공백 발생 | Forward Fill → 최대 2일. 그 이상은 행 제거 |
| **감성 점수 지연** | 당일 뉴스로 당일 예측 시 미래 데이터 누수 위험 | 뉴스는 전일(D-1) 감성 점수를 당일 피처로 사용 |

### 3.4 LightGBM 학습 코드 구조

```python
# scripts/train_lgbm.py
import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import accuracy_score, roc_auc_score

FEATURE_COLS = [
    "foreigner_net_buy", "institution_net_buy", "program_buy_ratio",
    "foreigner_buy_streak", "foreigner_5d_streak", "institution_3d_sell",
    "rsi_14", "macd_signal", "bb_position", "volume_ratio",
    "us_fed_rate", "us_cpi_yoy", "usd_krw", "vix",
    "sp500_return_1d", "nasdaq_future_pct", "us_10y_yield",
    "sentiment_news", "sentiment_reddit", "sentiment_combined",
    "sentiment_5d_ma", "fear_greed_index"
]

TARGET_COL = "target_direction"  # 1=상승, 0=하락

params = {
    "objective":        "binary",
    "metric":           "auc",
    "learning_rate":    0.05,
    "num_leaves":       31,
    "max_depth":        -1,
    "min_child_samples": 20,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq":     5,
    "scale_pos_weight": 1.2,  # 하락 클래스 불균형 시 조정
    "verbose":          -1
}

tscv = TimeSeriesSplit(n_splits=5)
models = []

for fold, (train_idx, val_idx) in enumerate(tscv.split(df)):
    X_train = df.iloc[train_idx][FEATURE_COLS]
    y_train = df.iloc[train_idx][TARGET_COL]
    X_val   = df.iloc[val_idx][FEATURE_COLS]
    y_val   = df.iloc[val_idx][TARGET_COL]

    train_set = lgb.Dataset(X_train, label=y_train)
    val_set   = lgb.Dataset(X_val,   label=y_val)

    model = lgb.train(
        params, train_set,
        num_boost_round=500,
        valid_sets=[val_set],
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]
    )
    models.append(model)

# 앙상블 평균 예측
import numpy as np
preds = np.mean([m.predict(X_val) for m in models], axis=0)
```

---

## 4. Step C — Feature Importance & Explainability

### 4.1 SHAP 기반 기여도 추출

LightGBM 내장 Feature Importance(`split`, `gain`)보다 **SHAP**을 사용하면 개별 예측에 대한 기여도를 산출할 수 있어 UX 시각화에 적합합니다.

```python
# scripts/explain_prediction.py
import shap
import json

def get_prediction_explanation(model, X_row: pd.DataFrame) -> dict:
    """
    단일 예측에 대한 피처별 기여도 반환
    X_row: 1행짜리 DataFrame (오늘의 피처)

    반환 예시:
    {
      "prediction_score": 0.73,
      "direction": "UP",
      "contributions": [
        {"feature": "foreigner_buy_streak", "contribution": 0.18, "label": "외국인 연속 매수"},
        {"feature": "sentiment_combined",   "contribution": 0.14, "label": "뉴스 감성"},
        {"feature": "sp500_return_1d",      "contribution": 0.12, "label": "S&P500 전일 등락"},
        ...
      ]
    }
    """
    explainer  = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_row)

    # 이진 분류: shap_values[1] = 상승 클래스 기여도
    contributions = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]

    FEATURE_LABELS = {
        "foreigner_buy_streak":  "외국인 연속 매수",
        "sentiment_combined":    "뉴스/커뮤니티 감성",
        "sp500_return_1d":       "S&P500 전일 등락",
        "nasdaq_future_pct":     "나스닥 선물",
        "rsi_14":                "RSI 과매수/과매도",
        "vix":                   "VIX 공포지수",
        "usd_krw":               "원달러 환율",
        "institution_3d_sell":   "기관 연속 매도",
        "fear_greed_index":      "공포/탐욕 지수",
        "us_fed_rate":           "미국 기준금리",
    }

    result_list = []
    for feat, val in zip(FEATURE_COLS, contributions):
        result_list.append({
            "feature":      feat,
            "contribution": round(float(val), 4),
            "label":        FEATURE_LABELS.get(feat, feat)
        })

    # 절대값 기준 상위 6개만 프론트로 전달
    result_list.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    top_contributors = result_list[:6]

    pred_score = float(model.predict(X_row)[0])

    return {
        "prediction_score": round(pred_score, 4),
        "direction":        "UP" if pred_score >= 0.5 else "DOWN",
        "contributions":    top_contributors
    }
```

### 4.2 프론트엔드 전달 JSON 스키마

```json
{
  "ticker":           "KODEX200",
  "date":             "2026-03-26",
  "signal_score":     72,
  "direction":        "UP",
  "confidence":       0.73,
  "top_contributors": [
    { "label": "외국인 연속 매수",    "value": 18.2, "positive": true  },
    { "label": "뉴스/커뮤니티 감성",  "value": 14.1, "positive": true  },
    { "label": "S&P500 전일 등락",    "value": 12.3, "positive": true  },
    { "label": "VIX 공포지수",        "value": 8.7,  "positive": false },
    { "label": "원달러 환율",          "value": 6.1,  "positive": false },
    { "label": "RSI 과매수/과매도",   "value": 4.4,  "positive": true  }
  ],
  "summary_text": "외국인이 5일 연속 순매수하며 수급 압력이 강하고, 전일 S&P500 상승 여파로 상방 가능성이 높습니다."
}
```

---

## 5. Signal Score 산출 로직 (0 ~ 100)

### 5.1 설계 개념

PRD의 기존 Signal Score(+점수 방식)를 **0~100 사용자 친화적 척도**로 변환합니다.

```
Signal Score = 50 (중립 기준)
             + LightGBM 기여분
             + Sentiment 기여분
             + 수급 기여분
             + 거시 기여분
```

### 5.2 Python 구현

```python
# scripts/signal_score.py

def compute_signal_score(
    lgbm_prob:         float,  # LightGBM 상승 확률 (0~1)
    sentiment_score:   float,  # 감성 점수 (-1~1)
    foreigner_streak:  int,    # 외국인 연속 매수일 (0~N)
    vix:               float,  # VIX 공포지수
    sp500_return:      float,  # S&P500 전일 등락률 (%)
    fear_greed:        float,  # 공포/탐욕 지수 (0~100)
) -> dict:

    # 1) LightGBM 기여 (±25점): 확률 0.5 = 0점, 1.0 = +25점, 0.0 = -25점
    lgbm_contribution = (lgbm_prob - 0.5) * 50  # -25 ~ +25

    # 2) 감성 기여 (±15점)
    sentiment_contribution = sentiment_score * 15  # -15 ~ +15

    # 3) 수급 기여 (±10점): 연속 매수 5일 이상 = 최대 +10
    streak_capped = min(foreigner_streak, 5)
    supply_contribution = (streak_capped / 5) * 10  # 0 ~ +10
    # 단, 연속 매도 상황이면 음수로 전환 (foreigner_streak < 0 인 경우)

    # 4) VIX 기여 (±5점): VIX 20 이하 = +5, VIX 30 이상 = -5
    vix_contribution = max(-5, min(5, (20 - vix) / 2))

    # 5) 거시 기여 (±5점): S&P500 등락 및 공포/탐욕
    macro_contribution = (sp500_return * 2) + ((fear_greed - 50) / 10)
    macro_contribution = max(-5, min(5, macro_contribution))

    # 합산 후 0~100 클리핑
    raw_score = (50
                 + lgbm_contribution
                 + sentiment_contribution
                 + supply_contribution
                 + vix_contribution
                 + macro_contribution)

    final_score = round(max(0, min(100, raw_score)))

    # 시그널 레이블
    if final_score >= 70:
        signal_label = "STRONG_BUY"
        signal_color = "GREEN"
    elif final_score >= 55:
        signal_label = "BUY"
        signal_color = "LIGHT_GREEN"
    elif final_score >= 45:
        signal_label = "HOLD"
        signal_color = "YELLOW"
    elif final_score >= 30:
        signal_label = "SELL"
        signal_color = "ORANGE"
    else:
        signal_label = "STRONG_SELL"
        signal_color = "RED"

    return {
        "signal_score":    final_score,
        "signal_label":    signal_label,
        "signal_color":    signal_color,
        "breakdown": {
            "lgbm":      round(lgbm_contribution, 1),
            "sentiment": round(sentiment_contribution, 1),
            "supply":    round(supply_contribution, 1),
            "vix":       round(vix_contribution, 1),
            "macro":     round(macro_contribution, 1),
        }
    }
```

### 5.3 점수 구간 기준

| Signal Score | 레이블 | 컬러 | UX 표현 |
|---|---|---|---|
| 70 ~ 100 | STRONG BUY | 🟢 초록 | 강한 매수 신호, 레이더 차트 확장 |
| 55 ~ 69  | BUY        | 🟡 연두 | 매수 우세, 수급 지표 하이라이트 |
| 45 ~ 54  | HOLD       | ⚪ 회색 | 관망, 지표 혼조 표시 |
| 30 ~ 44  | SELL       | 🟠 주황 | 매도 우세, 리스크 지표 강조 |
| 0 ~ 29   | STRONG SELL| 🔴 빨강 | 강한 매도 신호, 경고 배너 표시 |

---

## 6. UX 시각화 데이터 구조 설계

UX 전문가 관점에서 AI 결과를 직관적인 신호로 전달하기 위한 컴포넌트별 데이터 명세입니다.

### 6.1 신호 게이지 (Signal Gauge)
```
데이터: signal_score (0~100)
컴포넌트: 반원형 게이지, 0=빨강 / 50=노랑 / 100=초록
핵심: 숫자보다 색상과 바늘 위치로 즉각 인지
```

### 6.2 기여도 수평 바 차트 (Contribution Bar)
```
데이터: top_contributors[].{ label, value, positive }
컴포넌트: 오른쪽=호재(초록), 왼쪽=악재(빨강) 양방향 바
핵심: "왜 이 점수인가"를 5초 안에 이해 가능하도록
```

### 6.3 레이더 차트 (Radar Chart)
```
데이터: breakdown.{ lgbm, sentiment, supply, vix, macro }
컴포넌트: 5각형 레이더, 각 축 = 분석 카테고리
핵심: 전반적인 강/약 영역을 한눈에 파악
```

### 6.4 AI 요약 문장 (LLM Summary)
```
데이터: summary_text (LLM 생성)
컴포넌트: 카드 하단 1~2줄 텍스트
핵심: 숫자를 자연어로 번역하여 투자 결정 근거 제공
프롬프트: "점수 {score}점, 주요 기여 요인 {top_contributors}를
           바탕으로 투자자에게 1~2문장으로 오늘의 시장 요약을 작성하라."
```

---

## 7. Supabase 테이블 설계 (추가 필요 테이블)

```sql
-- 감성 분석 캐시
CREATE TABLE sentiment_cache (
    id              BIGSERIAL PRIMARY KEY,
    ticker          TEXT        NOT NULL,
    date            DATE        NOT NULL,
    sentiment_news  FLOAT,
    sentiment_reddit FLOAT,
    sentiment_combined FLOAT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, date)
);

-- AI 예측 결과
CREATE TABLE ai_predictions (
    id              BIGSERIAL PRIMARY KEY,
    ticker          TEXT        NOT NULL,
    date            DATE        NOT NULL,
    signal_score    INT         NOT NULL,  -- 0~100
    signal_label    TEXT        NOT NULL,  -- STRONG_BUY 등
    lgbm_prob       FLOAT,
    contributions   JSONB,                 -- top_contributors 배열
    breakdown       JSONB,                 -- 카테고리별 기여 수치
    summary_text    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(ticker, date)
);
```

---

## 8. 개발 순서 (Milestone)

| 단계 | 작업 | 선행 조건 |
|---|---|---|
| M1 | Supabase에 수집 데이터 upsert 완성 | API Key 발급 완료 |
| M2 | `feature_engineering.py` 구현 및 피처 매트릭스 CSV 생성 | M1 |
| M3 | `sentiment_engine.py` 구현 → `sentiment_cache` 테이블 적재 | Claude/OpenAI API Key |
| M4 | LightGBM 초기 학습 (6개월 ~ 1년 과거 데이터) | M2, M3 |
| M5 | SHAP Explainability 연결 → `ai_predictions` 테이블 적재 | M4 |
| M6 | `compute_signal_score()` 연결 → Signal Score JSON 생성 | M5 |
| M7 | Next.js API Route (`/api/signal/[ticker]`) 연결 | M6 |
| M8 | 프론트엔드 게이지/바차트/레이더 컴포넌트 구현 | M7 |
| M9 | 백테스트 검증 및 가중치 튜닝 | M8 |

---

## 9. 리스크 및 고려사항

| 리스크 | 내용 | 대응 |
|---|---|---|
| 예측 정확도 과신 | 90% KPI는 강세장/방향성 명확한 구간에서만 달성 가능 | UX에서 "참고용 지표" 명시, 신뢰 구간 표시 |
| LLM 환각 | 감성 점수가 실제 시장과 반대로 나올 가능성 | Confidence < 0.5인 결과는 weight 0.5 감소 적용 |
| 시장 체제 변화 | 학습 데이터의 시장 환경이 현재와 상이할 수 있음 | 최근 3개월 데이터 가중 재학습 (월 1회 정기 재학습) |
| 금융 규제 | 투자 권유로 해석될 수 있는 표현 | "AI 분석 참고 정보이며 투자 결정은 사용자 책임" 법적 고지 필수 |
