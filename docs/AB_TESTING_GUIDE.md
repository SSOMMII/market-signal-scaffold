# A/B 테스트 구현 가이드 - Calibration 모델 병렬 운영

**작성 날짜**: 2026-03-28  
**목표**: Calibration 방식을 적용한 두 가지 LightGBM 모델을 병렬 운영하며 A/B 테스트 진행

---

## 📋 개요

### Model A (원본)
- **Calibration 방식**: 없음
- **모델 구조**: 순수 LightGBM
- **Platt Scaling**: 미적용
- **저장 경로**: `scripts/models/us_model.pkl`, `scripts/models/kr_model.pkl`

### Model B (Calibrated)
- **Calibration 방식**: Platt Scaling (Sigmoid 함수)
- **모델 구조**: `CalibratedClassifierCV` 래핑 LightGBM
- **목표**: 예측 확률 보정으로 신뢰도 개선
- **저장 경로**: `scripts/models/us_model_calibrated.pkl`, `scripts/models/kr_model_calibrated.pkl`

---

## 🔧 백엔드 구현

### 1. 모델 학습 & 저장 (`scripts/train_lgbm.py`)

#### 새 옵션
```bash
python train_lgbm.py --tune --ab-version all
```

| 옵션 | 설명 | 기본값 |
|------|------|-----:|
| `--ab-version` | A(Model A만) / B(Model B만) / all(양쪽) | `all` |

#### 모델 생성 프로세스
```python
# 1. Base LightGBM 학습
base_model = lgb.LGBMClassifier(**lgb_params)
base_model.fit(X, y)

# 2. Model A: 스택킹 또는 원본 저장
model_a = stacking or base_model  # --stack 옵션 적용 시만

# 3. Model B: Platt Scaling 적용
model_b_wrapper = CalibratedClassifierCV(base_model, method="sigmoid", cv=3)
model_b_wrapper.fit(X, y)

# 4. 두 가지 모델 저장
joblib.dump({"model": model_a, ...}, "us_model.pkl")
joblib.dump({"model": model_b, ...}, "us_model_calibrated.pkl")
```

#### 예측 시 두 버전 모두 생성
```python
predict_and_upsert(client, model_specs, df_feat, ab_version="all")
```

`ai_predictions` 테이블에 `model_version` (A/B) 마킹과 함께 저장됨.

---

### 2. 데이터베이스 마이그레이션

마이그레이션 파일: `db/migrations/add_model_version_to_predictions.sql`

```sql
ALTER TABLE ai_predictions ADD COLUMN model_version TEXT DEFAULT 'A';
ALTER TABLE ai_predictions 
  DROP CONSTRAINT ai_predictions_ticker_date_key,
  ADD CONSTRAINT ai_predictions_ticker_date_version_key UNIQUE(ticker, date, model_version);
```

**실행**:
```bash
# Supabase 대시보드 또는 CLI
supabase migration up
```

---

### 3. API 응답 구조

#### `/api/signals?market=us`

```json
{
  "data": [
    {
      "ticker": "QQQ",
      "score": 65,              // 기본: Model A 스코어
      "aiScore": 65,
      "aiLabel": "BUY",
      "confidence": 0.72,
      
      "modelA": {                // Model A 예측
        "score": 65,
        "label": "BUY",
        "confidence": 0.72
      },
      "modelB": {                // Model B 예측 (Calibrated)
        "score": 68,
        "label": "BUY", 
        "confidence": 0.75       // 일반적으로 더 신뢰도 높음
      }
    }
  ]
}
```

#### `/api/signals/top?market=us&limit=10`

동일한 응답 구조로 상위 10개 반환.

---

## 👥 클라이언트 구현

### A/B 버전 할당 로직 (`lib/abTest.ts`)

#### 사용자 ID 기반 결정론적 할당

```typescript
import { getABTestVersion, getOrAssignABVersion, selectVersionScore } from '@/lib/abTest'

// 1. 사용자별 버전 결정 (일관된 경험)
const userId = user?.id ?? 'anonymous'
const abVersion = getOrAssignABVersion(userId)  // 'A' 또는 'B'

// 2. API 응답에서 해당 버전 스코어 추출
const selectedScore = selectVersionScore(signal, abVersion)
console.log(`사용자 v${abVersion}: ${selectedScore.score} (신뢰도 ${selectedScore.confidence})`)

// 3. 분석용 메타데이터
const abMetadata = createABTestMetadata(userId, abVersion)
// → { version: 'B', userId: 'user123', timestamp: '2026-03-28T...' }
```

#### 할당 규칙

- **50/50 분할** (기본)
  ```typescript
  const version = getABTestVersion(userId, 0.5)  // A: 50%, B: 50%
  ```

- **사용자 메타데이터 기반**
  ```typescript
  const ratio = user?.isPremium ? 0.3 : 0.5  // 프리미엄: 30% A, 70% B
  ```

###  PageComponent에서 사용

```typescript
'use client'
import { useContext } from 'react'
import { AuthContext } from '@/context/AuthContext'
import { getOrAssignABVersion, selectVersionScore } from '@/lib/abTest'

export default function SignalTable({ signals }) {
  const { user } = useContext(AuthContext)
  const abVersion = getOrAssignABVersion(user?.id ?? null)

  return (
    <table>
      <tbody>
        {signals.map(signal => {
          const score = selectVersionScore(signal, abVersion)
          return (
            <tr key={signal.ticker}>
              <td>{signal.ticker}</td>
              <td>{score.score}</td>  {/* A/B 버전 적용 스코어 */}
              <td>{signal.modelA?.score} (A) / {signal.modelB?.score} (B)</td>
              <td>v{abVersion}</td>  {/* 분석용 버전 표시 */}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
```

---

## 📊 분석 및 검증

### A/B 테스트 메트릭 추적

#### 1. 데이터 저장 (optional)

analytics 테이블에 클릭 및 성과 기록:

```typescript
// 신호 클릭 추적
await supabase.from('ab_test_events').insert({
  user_id: user.id,
  ab_version: abVersion,
  signal_ticker: signal.ticker,
  score_a: signal.modelA?.score,
  score_b: signal.modelB?.score,
  action: 'click',
  timestamp: new Date().toISOString()
})
```

#### 2. 성과 비교 쿼리

```sql
SELECT 
  ab_version,
  COUNT(*) as total_signals,
  AVG(CASE WHEN action = 'buy_success' THEN 1 ELSE 0 END) as success_rate,
  AVG(score_a) as avg_score_a,
  AVG(score_b) as avg_score_b
FROM ab_test_events
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY ab_version
```

**기대 결과**:
- **Model B (Calibrated)**: 신뢰도 평균 ↑ 2~5%
- **Model B**: 극단 신호(> 70, < 30) 비율 감소
- **Success rate**: 두 모델 유사 또는 Model B 우수

---

## 🚀 배포 프로세스

### Step 1: 마이그레이션 적용
```bash
# Supabase 대시보드에서 실행
select * from exec(sql_file('db/migrations/add_model_version_to_predictions.sql'))
```

### Step 2: 모델 재학습
```bash
# 로컬에서 두 모델 버전 생성 및 저장
python scripts/train_lgbm.py --tune --n-trials 100 --ab-version all

# 결과 확인
ls -la scripts/models/
# us_model.pkl              (Model A)
# us_model_calibrated.pkl   (Model B)
# kr_model.pkl              (Model A)
# kr_model_calibrated.pkl   (Model B)
```

### Step 3: 예측 생성
```bash
# 기존 모델로 양쪽 버전 예측 생성
python scripts/train_lgbm.py --predict-only --ab-version all
```

### Step 4: 프론트엔드 배포
```bash
# lib/abTest.ts 추가
git add lib/abTest.ts app/api/signals/ app/api/signals/top/
git commit -m "feat: A/B 테스트 구현 (Model A/B 병렬 운영)"
git push
```

---

## 🔍 모니터링

### 1. 모델 성능 비교

```bash
# 학습 로그 확인
tail -f scripts/train_lgbm.py

# Model A vs B 검증 정확도
# [MODEL A] CV Accuracy:     0.6234 ± 0.0456
# [MODEL B] CV Accuracy:     0.6187 ± 0.0489  (유사)
# → Calibration은 accuracy보다 confidence 보정에 효과
```

### 2. 예측 신뢰도 비교

```sql
-- Model A vs B 평균 신뢰도
SELECT 
  model_version,
  COUNT(*) as count,
  AVG(lgbm_prob) as avg_confidence,
  STDDEV(lgbm_prob) as std_confidence,
  MIN(lgbm_prob) as min_confidence,
  MAX(lgbm_prob) as max_confidence
FROM ai_predictions
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY model_version;

-- 기대: Model B confidence ↓ (더 보수적)
```

### 3. 신호 분포 비교

```sql
SELECT 
  model_version,
  signal_label,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY model_version), 2) as percentage
FROM ai_predictions
WHERE date >= NOW() - INTERVAL '7 days'
GROUP BY model_version, signal_label
ORDER BY model_version, percentage DESC;
```

---

## 🐛 트러블슈팅

### 문제: Model B 파일이 없음
```bash
# 확인
ls -la scripts/models/

# 해결: 모델 재생성
python scripts/train_lgbm.py --tune --ab-version B
```

### 문제: API 응답에 modelA/modelB 필드 없음
- **원인**: 마이그레이션 미적용 또는 예측 데이터 구버전
- **해결**:
  1. 마이그레이션 재확인: `ALTER TABLE ai_predictions ...`
  2. 예측 데이터 재생성: `python scripts/train_lgbm.py --predict-only`

### 문제: 사용자별 일관되지 않은 버전 할당
- **원인**: `sessionStorage` 사용 불가 환경
- **해결**: `localStorage` 또는 쿠키 기반 할당으로 변경

```typescript
// localStorage 기반
const stored = localStorage.getItem(AB_VERSION_STORAGE_KEY)
```

---

## 📈 기대 효과

| 항목 | 기대값 |
|------|----:|
| **Model B 신뢰도 개선** | +2% ~ +5% |
| **극단 신호 오탐율 감소** | -1% ~ -3% |
| **전체 정확도** | 유지 또는 미미한 ↑ |
| **배포 복잡도** | 낮음 (점진적 A/B 테스트) |

---

## 📚 참고

- [Calibration in Machine Learning](https://scikit-learn.org/stable/modules/calibration.html)
- [Platt Scaling](https://en.wikipedia.org/wiki/Platt_scaling)
- [A/B Testing Best Practices](https://www.optimizely.com/optimization-glossary/ab-testing/)

