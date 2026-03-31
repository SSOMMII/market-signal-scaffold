/**
 * 지정학적 리스크 키워드 룰 테이블
 * 뉴스 헤드라인에서 키워드를 감지 → 섹터 영향 태깅
 *
 * TODO: OpenAI gpt-4o-mini 연동 시 이 룰 로직을 LLM 호출로 교체
 */

export type Direction = 'up' | 'down' | 'neutral'

export interface SectorImpact {
  name: string
  direction: Direction
}

export interface GeoRule {
  id: string
  label: string          // 이슈 유형 이름 (한글)
  type: 'war' | 'trade' | 'monetary' | 'energy' | 'china' | 'sanctions' | 'recession'
  keywords: string[]     // 영어 키워드 (소문자)
  keywordsKr: string[]   // 한국어 키워드
  sectors: SectorImpact[]
  reason: string         // 영향 근거 요약 (한글)
}

export interface GeoSignal {
  ruleId: string
  label: string
  type: GeoRule['type']
  sectors: SectorImpact[]
  reason: string
  matchedKeywords: string[]
  newsCount: number      // 해당 이슈 관련 뉴스 수
  severity: 'high' | 'medium' | 'low'
}

export const GEO_RULES: GeoRule[] = [
  {
    id: 'war_conflict',
    label: '전쟁·분쟁',
    type: 'war',
    keywords: ['war', 'conflict', 'attack', 'missile', 'strike', 'troops', 'invasion', 'ceasefire', 'military', 'bomb', 'explosion', 'combat', 'battlefield'],
    keywordsKr: ['전쟁', '분쟁', '공격', '미사일', '폭격', '침공', '군사'],
    sectors: [
      { name: '방산·군수', direction: 'up' },
      { name: '에너지·유가', direction: 'up' },
      { name: '반도체', direction: 'down' },
      { name: '항공·여행', direction: 'down' },
      { name: '금·안전자산', direction: 'up' },
    ],
    reason: '전쟁 발발 시 에너지·방산 수요 급증, 글로벌 공급망 차질로 반도체·항공 타격',
  },
  {
    id: 'tariff_trade',
    label: '관세·무역전쟁',
    type: 'trade',
    keywords: ['tariff', 'trade war', 'import duty', 'trade deficit', 'trade deal', 'protectionism', 'customs', 'export ban', 'trade restriction'],
    keywordsKr: ['관세', '무역전쟁', '수입관세', '무역적자', '보호무역'],
    sectors: [
      { name: '반도체·기술주', direction: 'down' },
      { name: '자동차', direction: 'down' },
      { name: '소비재', direction: 'down' },
      { name: '달러', direction: 'up' },
      { name: '신흥국 ETF', direction: 'down' },
    ],
    reason: '관세 확대로 수출 기업 마진 압박, 달러 강세 유발해 신흥국 자금 이탈 가속',
  },
  {
    id: 'trump',
    label: '트럼프 리스크',
    type: 'trade',
    keywords: ['trump', 'maga', 'white house executive order', 'trump administration', 'trump tariff', 'trump policy'],
    keywordsKr: ['트럼프'],
    sectors: [
      { name: '달러·채권', direction: 'up' },
      { name: '신흥국·한국증시', direction: 'down' },
      { name: '친환경·EV', direction: 'down' },
      { name: '에너지·전통연료', direction: 'up' },
    ],
    reason: '트럼프 정책은 달러 강세·관세 확대 기조, 친환경 규제 완화로 신재생 약세',
  },
  {
    id: 'fed_rate',
    label: '금리·연준',
    type: 'monetary',
    keywords: ['federal reserve', 'fed rate', 'interest rate', 'rate hike', 'rate cut', 'inflation', 'cpi', 'fomc', 'powell', 'monetary policy', 'rate decision'],
    keywordsKr: ['연준', '금리', '인플레이션', '기준금리'],
    sectors: [
      { name: '기술·성장주', direction: 'down' },
      { name: '금융·은행', direction: 'up' },
      { name: '부동산 REITs', direction: 'down' },
      { name: '채권', direction: 'down' },
    ],
    reason: '금리 인상 시 성장주 밸류에이션 하락, 은행 예대마진 개선으로 금융주 수혜',
  },
  {
    id: 'china_risk',
    label: '중국·대만 리스크',
    type: 'china',
    keywords: ['china', 'taiwan', 'beijing', 'prc', 'ccp', 'chinese military', 'taiwan strait', 'export control', 'chip ban', 'huawei', 'decoupling'],
    keywordsKr: ['중국', '대만', '반도체 수출', '디커플링'],
    sectors: [
      { name: '반도체·소재', direction: 'down' },
      { name: '전기차 배터리', direction: 'down' },
      { name: '방산', direction: 'up' },
      { name: '한국수출주', direction: 'down' },
    ],
    reason: '미중 긴장 고조 시 반도체 공급망 타격, 한국 대중 수출 의존도 높아 직접 영향',
  },
  {
    id: 'energy_oil',
    label: '유가·에너지',
    type: 'energy',
    keywords: ['oil price', 'crude oil', 'opec', 'natural gas', 'energy crisis', 'pipeline', 'brent', 'wti', 'oil supply', 'petroleum'],
    keywordsKr: ['유가', '원유', '에너지', 'OPEC', '천연가스'],
    sectors: [
      { name: '에너지·정유', direction: 'up' },
      { name: '항공·운송', direction: 'down' },
      { name: '화학·소재', direction: 'down' },
      { name: '친환경·태양광', direction: 'up' },
    ],
    reason: '유가 상승은 에너지주 수혜, 항공·운송 비용 급등으로 수익성 악화',
  },
  {
    id: 'sanctions',
    label: '제재·금수조치',
    type: 'sanctions',
    keywords: ['sanction', 'embargo', 'ban on export', 'blacklist', 'asset freeze', 'ofac', 'restricted entity'],
    keywordsKr: ['제재', '금수', '수출금지', '블랙리스트'],
    sectors: [
      { name: '에너지', direction: 'up' },
      { name: '금융·결제', direction: 'down' },
      { name: '반도체 장비', direction: 'down' },
    ],
    reason: '제재 대상국 자원 공급 차질로 에너지 상승, 금융거래 동결로 관련 기업 타격',
  },
  {
    id: 'recession',
    label: '경기침체 우려',
    type: 'recession',
    keywords: ['recession', 'gdp decline', 'economic slowdown', 'unemployment', 'layoffs', 'job cuts', 'bankruptcy', 'credit crisis', 'debt ceiling', 'default'],
    keywordsKr: ['경기침체', 'GDP 하락', '실업', '감원', '파산'],
    sectors: [
      { name: '경기방어주(필수소비재)', direction: 'up' },
      { name: '성장·기술주', direction: 'down' },
      { name: '금·채권', direction: 'up' },
      { name: '소비재', direction: 'down' },
    ],
    reason: '경기침체 우려 시 안전자산 선호, 필수소비재 방어적 상승 — 성장주·소비주 약세',
  },
]

const SEVERITY_THRESHOLD = { high: 5, medium: 2, low: 1 }

export function applyGeoRules(headlines: string[]): GeoSignal[] {
  const lowerHeadlines = headlines.map(h => h.toLowerCase())
  const signals: GeoSignal[] = []

  for (const rule of GEO_RULES) {
    const matchedKeywords = new Set<string>()
    let newsCount = 0

    for (const headline of lowerHeadlines) {
      const matched = rule.keywords.filter(kw => headline.includes(kw))
      const matchedKr = rule.keywordsKr.filter(kw => headline.includes(kw))
      if (matched.length > 0 || matchedKr.length > 0) {
        newsCount++
        matched.forEach(k => matchedKeywords.add(k))
        matchedKr.forEach(k => matchedKeywords.add(k))
      }
    }

    if (newsCount === 0) continue

    const severity: GeoSignal['severity'] =
      newsCount >= SEVERITY_THRESHOLD.high ? 'high'
      : newsCount >= SEVERITY_THRESHOLD.medium ? 'medium'
      : 'low'

    signals.push({
      ruleId: rule.id,
      label: rule.label,
      type: rule.type,
      sectors: rule.sectors,
      reason: rule.reason,
      matchedKeywords: Array.from(matchedKeywords).slice(0, 4),
      newsCount,
      severity,
    })
  }

  // 뉴스 수 많은 순으로 정렬
  return signals.sort((a, b) => b.newsCount - a.newsCount)
}
