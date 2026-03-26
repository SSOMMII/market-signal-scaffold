export const tabs = ['일간', '주간', '섹터별', '커스텀']

// ── 국장 (KR) 상세 데이터 ──────────────────────────────────────────
export const krDetailData = {
  predictionTitle: '나스닥 상승 확률 82%',
  predictionSub: '코스피 외국인 순매수 +2,340억 유입. 반도체·AI 섹터 강세가 미장 상승을 견인할 전망.\n달러인덱스(DXY) 104.2 안정, 국채금리 소폭 하락으로 기술주에 우호적 환경.',
  predictionPct: 82,
  stats: [
    { label: '코스피 외인',  value: '+2,340억' },
    { label: '환율',         value: '1,320원'  },
    { label: '나스닥 선물',  value: '+0.31%'   },
  ],
  gradientClass: 'from-indigo-600 via-indigo-700 to-purple-700',
  sectorData: [
    { name: '반도체',      score: 92, change: '+3.2%', up: true  },
    { name: '바이오',      score: 74, change: '+1.1%', up: true  },
    { name: '2차전지',     score: 58, change: '-0.4%', up: false },
    { name: '금융',        score: 65, change: '+0.7%', up: true  },
    { name: '철강/소재',   score: 42, change: '-1.2%', up: false },
    { name: '엔터/미디어', score: 81, change: '+2.1%', up: true  },
  ],
  etfDetailList: [
    { ticker: '360750', name: 'TIGER 미국S&P500',     price: '16,240', change: '+1.8%', volume: '2.3M', signal: '매수', score: 2.4,  up: true  },
    { ticker: '305720', name: 'KODEX 반도체',          price: '28,450', change: '+2.3%', volume: '5.1M', signal: '매수', score: 3.1,  up: true  },
    { ticker: '229200', name: 'KODEX 코스닥150',       price: '9,870',  change: '+1.1%', volume: '3.7M', signal: '매수', score: 1.5,  up: true  },
    { ticker: '069500', name: 'KODEX 200',             price: '35,120', change: '+0.8%', volume: '8.2M', signal: '보유', score: 0.9,  up: true  },
    { ticker: '114800', name: 'KODEX 인버스',          price: '3,180',  change: '-0.9%', volume: '4.1M', signal: '관망', score: -1.7, up: false },
    { ticker: '252670', name: 'KODEX 200선물인버스2X', price: '1,940',  change: '-1.8%', volume: '7.3M', signal: '관망', score: -2.3, up: false },
  ],
  indicatorDetail: [
    { label: 'RSI (14)',   value: 42.5, max: 100, badge: '중립', cls: 'badge-hold', desc: 'RSI가 중립 구간(30~70)에 위치합니다. 과매수/과매도 신호 없음.', color: 'bg-amber-400' },
    { label: 'MACD',       value: 12,   max: 30,  badge: '매수', cls: 'badge-up',   desc: 'MACD 선이 시그널선 위에 위치 (골든크로스). 단기 상승 모멘텀.', color: 'bg-emerald-500' },
    { label: '스토캐스틱', value: 68.3, max: 100, badge: '주의', cls: 'badge-hold', desc: '스토캐스틱 %K가 80에 근접. 과매수 구간 진입 임박. 단기 조정 가능.', color: 'bg-amber-400' },
    { label: '볼린저밴드', value: 50,   max: 100, badge: '중립', cls: 'badge-hold', desc: '가격이 밴드 중단부 근처. 변동성 수렴 중. 방향성 돌파 대기.', color: 'bg-amber-400' },
  ],
  reportContent: [
    { title: '📊 일간 시장 요약',   body: '코스피는 외국인 순매수 +2,340억을 기반으로 0.81% 상승 마감. 반도체·AI 관련주 강세가 두드러졌으며, 삼성전자와 SK하이닉스가 각각 1.2%, 2.1% 상승. 코스닥도 바이오·엔터주 주도로 1.07% 상승. 오늘 밤 나스닥은 82% 확률로 상승 전망.' },
    { title: '📅 주간 시장 전망',   body: '이번 주 FOMC 의사록 발표 예정. 금리 동결 기조 유지 전망으로 기술주 중심 상승 흐름 예상. 엔비디아 실적 발표(목)가 나스닥 방향성을 결정할 핵심 변수. 코스피는 2,700~2,750 박스권 전망.' },
    { title: '🏭 섹터 분석',        body: '반도체 섹터(Score 92) 최강세. HBM 수요 급증으로 SK하이닉스 목표가 상향 다수. 엔터 섹터(Score 81) 일본·동남아 팬덤 확장으로 하이브·JYP 매출 성장세 지속. 2차전지(Score 58) 전기차 수요 둔화 우려로 관망 권고.' },
    { title: '⚙️ 커스텀 분석',      body: '포트폴리오 기반 맞춤 분석: NVDA(30%) 비중이 높아 실적 발표 리스크 존재. 삼성전자(25%)는 단기 조정 후 반등 구간 진입. AAPL(25%)은 AI 피처 기대감으로 강보합. 전체 리스크 스코어 65/100 — 보통 수준, 분산투자 권장.' },
  ],
}

// ── 미장 (US) 상세 데이터 ──────────────────────────────────────────
export const usDetailData = {
  predictionTitle: '코스피 상승 확률 76%',
  predictionSub: '엔비디아 실적 서프라이즈 기대감. AI 인프라 투자 확대 기조 유지.\n10년물 국채금리 소폭 하락, 기술주 밸류에이션 부담 완화. 내일 코스피 상승 출발 전망.',
  predictionPct: 76,
  stats: [
    { label: 'S&P 500',  value: '+0.74%' },
    { label: 'NASDAQ',   value: '+1.12%' },
    { label: 'DXY',      value: '104.2'  },
  ],
  gradientClass: 'from-violet-600 via-violet-700 to-indigo-700',
  sectorData: [
    { name: 'Technology', score: 88, change: '+1.9%', up: true  },
    { name: 'Financials', score: 71, change: '+0.6%', up: true  },
    { name: 'Healthcare', score: 63, change: '+0.3%', up: true  },
    { name: 'Energy',     score: 49, change: '-0.8%', up: false },
    { name: 'Utilities',  score: 38, change: '-1.1%', up: false },
    { name: 'Consumer',   score: 75, change: '+1.2%', up: true  },
  ],
  etfDetailList: [
    { ticker: 'SPY',  name: 'SPDR S&P 500 ETF',     price: '$524.8', change: '+0.8%',  volume: '72.1M', signal: '매수', score: 1.9,  up: true  },
    { ticker: 'QQQ',  name: 'Invesco QQQ Trust',     price: '$448.2', change: '+1.2%',  volume: '43.5M', signal: '매수', score: 2.8,  up: true  },
    { ticker: 'SOXX', name: 'iShares Semiconductor', price: '$231.5', change: '+2.4%',  volume: '8.7M',  signal: '매수', score: 3.2,  up: true  },
    { ticker: 'ARKK', name: 'ARK Innovation ETF',    price: '$48.3',  change: '+1.7%',  volume: '22.4M', signal: '매수', score: 1.4,  up: true  },
    { ticker: 'TLT',  name: 'iShares 20Y Treasury',  price: '$93.2',  change: '+0.4%',  volume: '18.6M', signal: '보유', score: 0.5,  up: true  },
    { ticker: 'SOXS', name: 'Direxion Semi Bear 3X', price: '$6.4',   change: '-2.1%',  volume: '14.2M', signal: '관망', score: -2.5, up: false },
  ],
  indicatorDetail: [
    { label: 'RSI (14)',   value: 58.2, max: 100, badge: '중립', cls: 'badge-hold', desc: 'RSI 58 — 중립 구간 상단. 과매수 전환 가능성 주시 필요.', color: 'bg-amber-400' },
    { label: 'MACD',       value: 28,   max: 40,  badge: '매수', cls: 'badge-up',   desc: 'MACD 골든크로스 유지. 나스닥 기술주 중심 상승 모멘텀 지속.', color: 'bg-emerald-500' },
    { label: '스토캐스틱', value: 72.1, max: 100, badge: '주의', cls: 'badge-hold', desc: '스토캐스틱 %K 72 — 고평가 구간 진입. 단기 조정 신호 감시 필요.', color: 'bg-amber-400' },
    { label: '볼린저밴드', value: 80,   max: 100, badge: '강세', cls: 'badge-up',   desc: '가격이 상단 밴드 근처. 강한 상승 추세. 밴드 확장 중.', color: 'bg-emerald-500' },
  ],
  reportContent: [
    { title: '📊 일간 시장 요약',   body: 'S&P 500이 +0.74%, 나스닥이 +1.12% 상승. 빅테크(NVDA, MSFT, AAPL) 동반 강세. VIX 14.2까지 하락하며 시장 안정감 유지. 10년물 국채금리 소폭 하락 — 기술주 밸류에이션 부담 완화. 내일 코스피 상승 출발 전망.' },
    { title: '📅 주간 시장 전망',   body: 'FOMC 의사록(수), 엔비디아 실적(목) 등 빅이벤트 집중. 금리 동결 기조 유지 기대가 강세 모멘텀을 지지. PCE 물가 데이터가 추가 변수. S&P 500은 5,200~5,300 구간 박스권 예상.' },
    { title: '🏭 섹터 분석',        body: 'Technology(Score 88) 압도적 강세. AI 인프라 투자 테마 지속. Consumer Discretionary(Score 75) 아마존·테슬라 반등으로 회복세. Energy(Score 49) WTI 하락과 수요 둔화 우려로 약세. Healthcare(Score 63) 방어적 포지션 유지.' },
    { title: '⚙️ 커스텀 분석',      body: 'NVDA(35%) 비중 집중 리스크 — 실적 발표 전후 변동성 확대 예상. AAPL(25%)은 AI 피처 기대감으로 강보합 유지. MSFT(25%)는 Azure AI 성장 스토리 견고. META(15%)는 광고 매출 회복으로 상승세. 전체 리스크 스코어 62/100.' },
  ],
}

export const aiReportTabs = ['일간 리포트', '주간 전망', '섹터 분석', '커스텀']
