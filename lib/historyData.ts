export type Prediction = {
  date: string
  direction: '상승' | '하락'
  confidence: number
  actual: '상승' | '하락' | null
  kospiActual: string
  nasdaqActual: string
  foreignBuy: string
  hit: boolean | null
  summary: string
}

export const predictions: Prediction[] = [
  {
    date: '2025-03-24',
    direction: '상승',
    confidence: 82,
    actual: '상승',
    kospiActual: '+0.81%',
    nasdaqActual: '+1.12%',
    foreignBuy: '+2,340억',
    hit: true,
    summary: '반도체 섹터 주도. 나스닥 기술주 강세. 예측 정확.',
  },
  {
    date: '2025-03-21',
    direction: '상승',
    confidence: 71,
    actual: '상승',
    kospiActual: '+0.45%',
    nasdaqActual: '+0.78%',
    foreignBuy: '+1,120억',
    hit: true,
    summary: '외국인 순매수 유입. 달러 약세 지속. 소폭 상승 마감.',
  },
  {
    date: '2025-03-20',
    direction: '하락',
    confidence: 65,
    actual: '상승',
    kospiActual: '+0.22%',
    nasdaqActual: '+0.31%',
    foreignBuy: '+340억',
    hit: false,
    summary: 'FOMC 경계감에도 불구 장 후반 반등. 예측 빗나감.',
  },
  {
    date: '2025-03-19',
    direction: '상승',
    confidence: 78,
    actual: '상승',
    kospiActual: '+1.32%',
    nasdaqActual: '+1.95%',
    foreignBuy: '+4,580억',
    hit: true,
    summary: '엔비디아 강세. 반도체 섹터 전반 급등. 예측 적중.',
  },
  {
    date: '2025-03-18',
    direction: '하락',
    confidence: 68,
    actual: '하락',
    kospiActual: '-0.63%',
    nasdaqActual: '-0.84%',
    foreignBuy: '-890억',
    hit: true,
    summary: '미국 인플레이션 우려 재부상. 기술주 동반 하락.',
  },
  {
    date: '2025-03-17',
    direction: '상승',
    confidence: 74,
    actual: '하락',
    kospiActual: '-0.18%',
    nasdaqActual: '-0.25%',
    foreignBuy: '-210억',
    hit: false,
    summary: '장중 강세 후 장 마감 직전 매도세. 소폭 하락 마감.',
  },
  {
    date: '2025-03-14',
    direction: '상승',
    confidence: 88,
    actual: '상승',
    kospiActual: '+1.71%',
    nasdaqActual: '+2.11%',
    foreignBuy: '+5,230억',
    hit: true,
    summary: '주간 최고 신뢰도 예측. 대형주 전반 강세. 완벽 적중.',
  },
  {
    date: '2025-03-13',
    direction: '하락',
    confidence: 72,
    actual: '하락',
    kospiActual: '-1.04%',
    nasdaqActual: '-1.37%',
    foreignBuy: '-2,100억',
    hit: true,
    summary: '美 PPI 예상치 상회. 외국인 대규모 매도. 예측 정확.',
  },
]

export const filterOptions = ['전체', '적중', '빗나감']

export const statCards = [
  { label: '총 예측 횟수', value: '47회', sub: '최근 30일', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { label: '예측 정확도', value: '74.5%', sub: '+2.1% 전월比', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: '평균 신뢰도', value: '74.8%', sub: '이번 달 평균', color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: '연속 적중',   value: '3회',   sub: '현재 연속 기록', color: 'text-purple-600', bg: 'bg-purple-50' },
]
