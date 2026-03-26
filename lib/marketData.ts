export interface IndexData {
  name: string
  sub: string
  value: string
  change: string
  data: number[]
  color: string
  ohlc: [string, string][]
}

export interface SignalItem {
  ticker: string
  name: string
  change: string
  score: string
  action: string
  up: boolean
}

export interface IndicatorItem {
  label: string
  value: string
  sub: string
  badge: string
  cls: string
}

export interface StripItem {
  name: string
  value: string
  change: string
  up: boolean
}

export interface PortfolioItem {
  code: string
  name: string
  pct: number
  color: string
  profit: string
}

export interface MarketData {
  statusTitle: string
  statusSub: string
  statusBadge: string
  insightTitle: string
  insightSub: string
  insightDir: string
  insightConf: number
  insightText: string
  insightStats: { label: string; value: string }[]
  index1: IndexData
  index2: IndexData
  globalStrip: StripItem[]
  stripPreview: StripItem[]
  signals: SignalItem[]
  indicators: IndicatorItem[]
  portfolio: PortfolioItem[]
  accentColor: string
  accentBg: string
  gradientFrom: string
  gradientTo: string
}

export const krData: MarketData = {
  statusTitle: '한국 증시',
  statusSub: 'KOSPI / KOSDAQ',
  statusBadge: '거래중',
  insightTitle: 'Day Insight',
  insightSub: '국장 → 미장 예측',
  insightDir: '상승 예상',
  insightConf: 82,
  insightText: '코스피 외국인 순매수 유입. 반도체 섹터 강세 지속으로 나스닥 상승 예상. 달러 안정세 긍정적. 야간 선물 +0.3% 기반 상승 출발 전망.',
  insightStats: [
    { label: '코스피', value: '+0.8%' },
    { label: '외국인', value: '+2,340억' },
    { label: '환율',   value: '1,320원' },
  ],
  index1: {
    name: 'KOSPI', sub: '한국 대표 지수', value: '2,720', change: '+21.8 (+0.81%)',
    data: [2680,2695,2710,2698,2720,2715,2730,2720], color: '#6366f1',
    ohlc: [['시가','2,695'],['고가','2,735'],['저가','2,690']],
  },
  index2: {
    name: 'KOSDAQ', sub: '중소형 성장 지수', value: '891', change: '+9.4 (+1.07%)',
    data: [870,878,885,880,892,888,895,891], color: '#a855f7',
    ohlc: [['시가','878'],['고가','896'],['저가','876']],
  },
  globalStrip: [
    { name: 'S&P 500', value: '5,248',  change: '+0.74%', up: true  },
    { name: 'NASDAQ',  value: '16,382', change: '+1.12%', up: true  },
    { name: 'DOW',     value: '38,905', change: '+0.23%', up: true  },
    { name: 'VIX',     value: '14.2',   change: '-5.3%',  up: false },
    { name: 'WTI',     value: '$82.4',  change: '-0.8%',  up: false },
    { name: 'Gold',    value: '$2,318', change: '+0.6%',  up: true  },
  ],
  stripPreview: [
    { name: 'S&P 500', value: '5,248',  change: '+0.74%', up: true },
    { name: 'NASDAQ',  value: '16,382', change: '+1.12%', up: true },
    { name: 'DOW',     value: '38,905', change: '+0.23%', up: true },
  ],
  signals: [
    { ticker: '360750', name: 'TIGER 미국S&P500', change: '+1.8%', score: '+2.4', action: '매수', up: true  },
    { ticker: '305720', name: 'KODEX 반도체',     change: '+2.3%', score: '+3.1', action: '매수', up: true  },
    { ticker: '114800', name: 'KODEX 인버스',     change: '-0.9%', score: '-1.7', action: '관망', up: false },
    { ticker: '229200', name: 'KODEX 코스닥150',  change: '+1.1%', score: '+1.5', action: '매수', up: true  },
  ],
  indicators: [
    { label: 'RSI (14)',   value: '42.5',  sub: '중립 구간',   badge: '중립', cls: 'badge-hold' },
    { label: 'MACD',      value: '+12',   sub: '골든크로스',  badge: '매수', cls: 'badge-up'   },
    { label: '이동평균',  value: '2,698', sub: '120MA 상회',  badge: '상승', cls: 'badge-up'   },
    { label: '볼린저밴드',value: '중단',  sub: '밴드 수렴',   badge: '중립', cls: 'badge-hold' },
    { label: '스토캐스틱',value: '68.3',  sub: '과매수 근접', badge: '주의', cls: 'badge-hold' },
    { label: '거래량',    value: '↑28%',  sub: '평균 대비',   badge: '강세', cls: 'badge-up'   },
  ],
  portfolio: [
    { code: 'AAPL',   name: 'Apple Inc.',      pct: 25, color: 'bg-blue-500',   profit: '+4.2%'  },
    { code: 'NVDA',   name: 'NVIDIA Corp.',    pct: 30, color: 'bg-purple-500', profit: '+11.7%' },
    { code: '005930', name: '삼성전자',        pct: 25, color: 'bg-cyan-500',   profit: '-1.3%'  },
    { code: 'MSFT',   name: 'Microsoft Corp.', pct: 20, color: 'bg-indigo-500', profit: '+2.9%'  },
  ],
  accentColor: 'bg-indigo-50 text-indigo-600',
  accentBg: 'bg-indigo-600 hover:bg-indigo-700',
  gradientFrom: 'from-indigo-600',
  gradientTo: 'to-purple-600',
}

export const usData: MarketData = {
  statusTitle: '미국 증시',
  statusSub: 'S&P 500 / NASDAQ',
  statusBadge: '야간장',
  insightTitle: 'Night Insight',
  insightSub: '미장 → 국장 예측',
  insightDir: '상승 예상',
  insightConf: 76,
  insightText: '엔비디아 실적 서프라이즈 기대감. AI 인프라 투자 확대 기조 유지. 10년물 국채금리 소폭 하락, 기술주 밸류에이션 부담 완화. 내일 코스피 상승 출발 전망.',
  insightStats: [
    { label: 'S&P 500',  value: '+0.74%' },
    { label: 'NASDAQ',   value: '+1.12%' },
    { label: 'DXY',      value: '104.2'  },
  ],
  index1: {
    name: 'S&P 500', sub: '미국 대표 지수', value: '5,248', change: '+38.5 (+0.74%)',
    data: [5180,5195,5210,5200,5230,5220,5248,5248], color: '#8b5cf6',
    ohlc: [['시가','5,200'],['고가','5,260'],['저가','5,188']],
  },
  index2: {
    name: 'NASDAQ', sub: '기술주 중심 지수', value: '16,382', change: '+182 (+1.12%)',
    data: [16100,16150,16200,16180,16300,16280,16382,16382], color: '#06b6d4',
    ohlc: [['시가','16,180'],['고가','16,420'],['저가','16,090']],
  },
  globalStrip: [
    { name: 'KOSPI',  value: '2,720',  change: '+0.81%', up: true  },
    { name: 'KOSDAQ', value: '891',    change: '+1.07%', up: true  },
    { name: 'Nikkei', value: '40,168', change: '+0.55%', up: true  },
    { name: 'DAX',    value: '18,492', change: '-0.12%', up: false },
    { name: 'WTI',    value: '$82.4',  change: '-0.8%',  up: false },
    { name: 'BTC',    value: '$67,240',change: '+2.4%',  up: true  },
  ],
  stripPreview: [
    { name: 'KOSPI',  value: '2,720',  change: '+0.81%', up: true  },
    { name: 'Nikkei', value: '40,168', change: '+0.55%', up: true  },
    { name: 'DAX',    value: '18,492', change: '-0.12%', up: false },
  ],
  signals: [
    { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',    change: '+0.8%',  score: '+1.9', action: '매수', up: true  },
    { ticker: 'QQQ',  name: 'Invesco QQQ Trust',    change: '+1.2%',  score: '+2.8', action: '매수', up: true  },
    { ticker: 'SOXS', name: 'Direxion Semi Bear 3X', change: '-2.1%', score: '-2.5', action: '관망', up: false },
    { ticker: 'ARKK', name: 'ARK Innovation ETF',   change: '+1.7%',  score: '+1.4', action: '매수', up: true  },
  ],
  indicators: [
    { label: 'RSI (14)',   value: '58.2',  sub: '중립 구간',   badge: '중립', cls: 'badge-hold' },
    { label: 'MACD',      value: '+28',   sub: '골든크로스',  badge: '매수', cls: 'badge-up'   },
    { label: '이동평균',  value: '5,210', sub: '50MA 상회',   badge: '상승', cls: 'badge-up'   },
    { label: '볼린저밴드',value: '상단',  sub: '밴드 확장',   badge: '강세', cls: 'badge-up'   },
    { label: '스토캐스틱',value: '72.1',  sub: '고평가 구간', badge: '주의', cls: 'badge-hold' },
    { label: '거래량',    value: '↑15%',  sub: '평균 대비',   badge: '보통', cls: 'badge-hold' },
  ],
  portfolio: [
    { code: 'NVDA', name: 'NVIDIA Corp.',    pct: 35, color: 'bg-purple-500', profit: '+11.7%' },
    { code: 'AAPL', name: 'Apple Inc.',      pct: 25, color: 'bg-blue-500',   profit: '+4.2%'  },
    { code: 'MSFT', name: 'Microsoft Corp.', pct: 25, color: 'bg-indigo-500', profit: '+2.9%'  },
    { code: 'META', name: 'Meta Platforms',  pct: 15, color: 'bg-cyan-500',   profit: '+8.1%'  },
  ],
  accentColor: 'bg-violet-50 text-violet-600',
  accentBg: 'bg-violet-600 hover:bg-violet-700',
  gradientFrom: 'from-violet-600',
  gradientTo: 'to-indigo-700',
}
