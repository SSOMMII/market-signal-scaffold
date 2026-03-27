# LightGBM 예측 정확도 향상 로드맵

- 작성일: 2026-03-27
- 현재 CV Accuracy: 52.7% (랜덤 33% 대비 +20%p)
- 목표: 57~60% (실전 수익 가능 임계값)

---

## 현재 상태 진단

| 항목 | 현재 |
|------|------|
| 모델 | LightGBM 단일 모델 |
| 피처 수 | 20개 |
| 학습 데이터 | 9,173건 (7개 ETF × 5년) |
| 검증 방식 | TimeSeriesSplit 5-fold |
| CV Accuracy | 52.7% ± 6.3% |
| 레이블 분포 | 매도 21% / 관망 54% / 매수 25% |

**문제점**
- 관망(0)이 54%로 과다 → 모델이 관망을 과다 예측하는 편향 발생
- 하이퍼파라미터가 기본값 (최적화 미실시)
- 감성 데이터 미포함 (Fear & Greed 시계열, 뉴스 감성)
- 시장 레짐(강세장/공황 등) 미구분
- 경제 이벤트(FOMC, CPI) 미반영

---

## 개선 방향 (우선순위 순)

### ★★★ 1순위 — 즉시 적용 가능 (코드 수정만)

#### A. 클래스 불균형 보정
```python
# train_lgbm.py lgb_params에 추가
lgb_params["is_unbalance"] = True
```
- 관망(54%) 과다로 인한 편향 제거
- 예상 효과: **+1~2%p**

#### B. VIX 레짐 피처
```python
df["regime"] = 0  # normal
df.loc[df["vix_close"] < 15, "regime"] = 1   # low_vol  (강세장)
df.loc[df["vix_close"] > 25, "regime"] = 2   # high_vol (변동성)
df.loc[df["vix_close"] > 35, "regime"] = 3   # crisis   (공황)
```
- VIX 구간별로 시장 성격이 완전히 다름 → 레짐을 피처로 추가
- 예상 효과: **+0.5~1%p**

#### C. 거래량 이상 탐지 피처
```python
# 거래량 스파이크 (기관 매매 신호)
df["volume_spike"] = (df["vol_ratio"] > 2.0).astype(int)

# OBV (On-Balance Volume) — 가격과 거래량 누적 관계
df["obv"] = (np.sign(df["close"].diff()) * df["volume"]).cumsum()
df["obv_ma20"] = df["obv"].rolling(20).mean()
df["obv_vs_ma"] = df["obv"] / df["obv_ma20"] - 1
```
- 예상 효과: **+0.5~1%p**

---

### ★★ 2순위 — 단기 (OpenAI 연동 후 / 데이터 누적 후)

#### D. Optuna 하이퍼파라미터 자동 튜닝
```python
import optuna
def objective(trial):
    params = {
        "num_leaves":        trial.suggest_int("num_leaves", 20, 100),
        "learning_rate":     trial.suggest_float("learning_rate", 0.01, 0.1),
        "min_child_samples": trial.suggest_int("min_child_samples", 10, 50),
        "feature_fraction":  trial.suggest_float("feature_fraction", 0.6, 1.0),
        "bagging_fraction":  trial.suggest_float("bagging_fraction", 0.6, 1.0),
    }
    # TimeSeriesSplit CV 평균 accuracy 반환
```
- 현재 기본값(num_leaves=31) 대비 최적값 탐색
- 예상 효과: **+1~2%p**

#### E. Fear & Greed 시계열 피처
```python
# sentiment_cache 테이블에서 Fear & Greed 시계열 조인
df["fg_ma7"]    = df["fear_greed"].rolling(7).mean()   # 7일 이동평균
df["fg_change"] = df["fear_greed"] - df["fg_ma7"]      # 심리 급변 감지
df["fg_extreme"] = ((df["fear_greed"] < 20) | (df["fear_greed"] > 80)).astype(int)
```
- Fear & Greed가 시계열로 쌓여야 사용 가능 (현재 당일치만 수집 중)
- 예상 효과: **+1%p**

#### F. 뉴스 감성 점수 (OpenAI 연동 후)
```python
# sentiment_cache.sentiment_news 컬럼 조인
df["news_sentiment"]    # −1(매우 부정) ~ +1(매우 긍정)
df["news_sentiment_ma5"] = df["news_sentiment"].rolling(5).mean()
```
- OpenAI 연동 완료 후 추가 가능
- 예상 효과: **+1~2%p**

#### G. 경제 이벤트 캘린더 피처
```python
# FOMC/CPI 발표일 기준 ±3일 여부
df["is_fomc_week"]  = df["date"].isin(fomc_dates)
df["days_to_fomc"]  = # 다음 FOMC까지 남은 영업일
df["is_cpi_week"]   = df["date"].isin(cpi_dates)
```
- FOMC, CPI 발표일 전후 변동성 급증 → 별도 패턴으로 학습
- FRED API로 이미 CPI 수집 중 → 발표일 추출만 하면 됨
- 예상 효과: **+0.5~1%p**

---

### ★ 3순위 — 중장기 (데이터 더 쌓인 후)

#### H. 앙상블 (XGBoost + LightGBM + RandomForest)
```python
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier

models = {
    "lgbm": LGBMClassifier(...),
    "xgb":  XGBClassifier(...),
    "rf":   RandomForestClassifier(...),
}
# 최종 확률 = 3개 모델 소프트 보팅 평균
final_prob = np.mean([m.predict_proba(X) for m in models.values()], axis=0)
```
- 모델 다양성으로 분산 감소
- 예상 효과: **+1~3%p**

#### I. 멀티 구간 예측 (1d / 5d / 10d)
```python
# 3개 레이블 동시 학습
for horizon in [1, 5, 10]:
    df[f"label_{horizon}d"] = # horizon일 후 수익률 기반 레이블
    model[horizon] = train(features, df[f"label_{horizon}d"])

# 최종 신호 = 3개 구간 컨센서스
consensus = vote(model[1].predict(), model[5].predict(), model[10].predict())
```
- 1일(단기) + 5일(중기) + 10일(추세) 컨센서스
- 예상 효과: **+1~2%p**

#### J. LSTM 시퀀스 모델
```python
# 30일 시퀀스 → 다음 5일 예측
X_seq.shape = (samples, 30, n_features)
# LightGBM은 각 행 독립 처리 → LSTM은 시퀀스 패턴 학습
model = LSTM(units=64) → Dense(3, activation="softmax")
```
- 현재 데이터(9,173건)는 다소 적음 → 데이터 2배 이상 쌓인 후 효과적
- 예상 효과: **+2~5%p** (데이터 충분할 때)

---

## 실행 로드맵

```
Phase 1 — 지금 즉시 (1~2일)
  ├─ A. 클래스 불균형 보정 (is_unbalance)
  ├─ B. VIX 레짐 피처
  └─ C. OBV / 거래량 스파이크 피처
  예상 달성: 52.7% → 54~55%

Phase 2 — 단기 (OpenAI 연동 후, 1~2주)
  ├─ D. Optuna 하이퍼파라미터 튜닝
  ├─ E. Fear & Greed 시계열 피처
  ├─ F. 뉴스 감성 점수
  └─ G. FOMC/CPI 이벤트 캘린더
  예상 달성: 55~57%

Phase 3 — 중기 (데이터 3개월 이상 추가 누적 후)
  ├─ H. XGBoost + LightGBM 앙상블
  └─ I. 멀티 구간 컨센서스 (1d/5d/10d)
  예상 달성: 57~60%

Phase 4 — 장기
  └─ J. LSTM 시퀀스 모델
  예상 달성: 60%+
```

---

## 참고: 피처 중요도 현황 (2026-03-27 기준)

| 순위 | 피처 | 중요도 | 카테고리 |
|------|------|--------|---------|
| 1 | gold_ret_5d | 3051 | 크로스-에셋 |
| 2 | tnx_ret_5d | 2906 | 크로스-에셋 |
| 3 | vix_close | 2867 | 크로스-에셋 |
| 4 | gold_ret_1d | 2787 | 크로스-에셋 |
| 5 | usdkrw_ret_1d | 2640 | 크로스-에셋 |
| 6 | tnx_ret_1d | 2437 | 크로스-에셋 |
| 7 | macd_hist | 2429 | 기술적 지표 |
| 8 | vix_ret_1d | 2378 | 크로스-에셋 |
| 9 | vol_20d | 2338 | 모멘텀 |
| 10 | vol_ratio | 2303 | 모멘텀 |

→ **상위 8개 중 6개가 크로스-에셋** — 단일 종목 지표보다 시장 전체 맥락이 훨씬 중요
