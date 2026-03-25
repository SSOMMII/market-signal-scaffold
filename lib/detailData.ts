export const tabs = ['일간', '주간', '섹터별', '커스텀']

export const sectorData = [
  { name: '반도체',     score: 92, change: '+3.2%', stocks: ['삼성전자', 'SK하이닉스', 'NVDA'], up: true },
  { name: '바이오',     score: 74, change: '+1.1%', stocks: ['셀트리온', '삼성바이오', 'LG화학'], up: true },
  { name: '2차전지',    score: 58, change: '-0.4%', stocks: ['LG에너지솔루션', 'SK이노베이션'], up: false },
  { name: '금융',       score: 65, change: '+0.7%', stocks: ['KB금융', '신한지주', '하나금융'], up: true },
  { name: '철강/소재',  score: 42, change: '-1.2%', stocks: ['POSCO홀딩스', '현대제철'], up: false },
  { name: '엔터/미디어',score: 81, change: '+2.1%', stocks: ['HYBE', 'SM엔터', 'JYP엔터'], up: true },
]

export const etfDetailList = [
  { ticker: '360750', name: 'TIGER 미국S&P500',    price: '16,240', change: '+1.8%', volume: '2.3M', signal: '매수', score: 2.4, up: true },
  { ticker: '305720', name: 'KODEX 반도체',         price: '28,450', change: '+2.3%', volume: '5.1M', signal: '매수', score: 3.1, up: true },
  { ticker: '229200', name: 'KODEX 코스닥150',      price: '9,870',  change: '+1.1%', volume: '3.7M', signal: '매수', score: 1.5, up: true },
  { ticker: '069500', name: 'KODEX 200',            price: '35,120', change: '+0.8%', volume: '8.2M', signal: '보유', score: 0.9, up: true },
  { ticker: '114800', name: 'KODEX 인버스',         price: '3,180',  change: '-0.9%', volume: '4.1M', signal: '관망', score: -1.7, up: false },
  { ticker: '252670', name: 'KODEX 200선물인버스2X', price: '1,940', change: '-1.8%', volume: '7.3M', signal: '관망', score: -2.3, up: false },
]

export const indicatorDetail = [
  {
    label: 'RSI (14)',
    value: 42.5,
    max: 100,
    zone: [30, 70],
    badge: '중립',
    cls: 'badge-hold',
    desc: 'RSI가 중립 구간(30~70)에 위치합니다. 과매수/과매도 신호 없음.',
    color: 'bg-amber-400',
  },
  {
    label: 'MACD',
    value: 12,
    max: 30,
    zone: [0, 30],
    badge: '매수',
    cls: 'badge-up',
    desc: 'MACD 선이 시그널선 위에 위치 (골든크로스). 단기 상승 모멘텀.',
    color: 'bg-emerald-500',
  },
  {
    label: '스토캐스틱',
    value: 68.3,
    max: 100,
    zone: [20, 80],
    badge: '주의',
    cls: 'badge-hold',
    desc: '스토캐스틱 %K가 80에 근접. 과매수 구간 진입 임박. 단기 조정 가능.',
    color: 'bg-amber-400',
  },
  {
    label: '볼린저밴드',
    value: 50,
    max: 100,
    zone: [20, 80],
    badge: '중립',
    cls: 'badge-hold',
    desc: '가격이 밴드 중단부 근처. 변동성 수렴 중. 방향성 돌파 대기.',
    color: 'bg-amber-400',
  },
]

export const aiReportTabs = ['일간 리포트', '주간 전망', '섹터 분석', '커스텀']