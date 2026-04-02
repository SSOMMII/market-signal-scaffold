/**
 * GET /api/geo-risk
 * 지정학적 리스크 분석
 * - Finnhub 일반 뉴스 + RSS 수집
 * - OPENAI_API_KEY 설정 시: gpt-4o-mini LLM 분석
 * - 미설정 시: 키워드 룰 기반 분석 (fallback)
 */

import { NextResponse } from 'next/server'
import { getFinnhubMarketNews } from '@/lib/collectors/us/finnhub'
import { fetchRssNews } from '@/lib/collectors/common/rssNews'
import { applyGeoRules, type GeoSignal } from '@/lib/collectors/common/geoRules'

export const revalidate = 3600 // 1시간 캐시

async function analyzeWithOpenAI(headlines: string[]): Promise<GeoSignal[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const prompt = `You are a financial geopolitical risk analyst. Analyze the following news headlines and identify active geopolitical risk signals that could impact financial markets.

Headlines (${headlines.length} total):
${headlines.slice(0, 80).join('\n')}

Return a JSON array of risk signals. Each signal must follow this exact schema:
{
  "ruleId": string (snake_case id like "war_conflict", "tariff_trade", "fed_rate", "china_risk", "energy_oil", "sanctions", "recession", "trump"),
  "label": string (Korean label, e.g. "전쟁·분쟁", "관세·무역전쟁"),
  "type": one of ["war","trade","monetary","energy","china","sanctions","recession"],
  "sectors": [{"name": string (Korean), "direction": "up"|"down"|"neutral"}],
  "reason": string (Korean, 1-2 sentences explaining market impact),
  "matchedKeywords": string[] (up to 4 matching keywords from headlines),
  "newsCount": number (count of related headlines),
  "severity": "high"|"medium"|"low"
}

Only include signals with clear evidence in the headlines. Return [] if no significant risks found.
Return ONLY valid JSON array, no markdown, no explanation.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1500,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error: ${res.status} ${err}`)
  }

  const json = await res.json()
  const text = json.choices?.[0]?.message?.content ?? '[]'

  try {
    const signals = JSON.parse(text)
    if (!Array.isArray(signals)) throw new Error('Not an array')
    return signals as GeoSignal[]
  } catch {
    throw new Error(`Failed to parse OpenAI response: ${text.slice(0, 200)}`)
  }
}

export async function GET() {
  try {
    // Finnhub + RSS 병렬 수집
    const [finnhubResult, rssResult] = await Promise.allSettled([
      getFinnhubMarketNews('general'),
      fetchRssNews(),
    ])

    const headlines: string[] = []

    if (finnhubResult.status === 'fulfilled') {
      finnhubResult.value.forEach(n => headlines.push(n.headline))
    }

    if (rssResult.status === 'fulfilled') {
      rssResult.value.forEach(n => headlines.push(n.title))
    }

    if (headlines.length === 0) {
      return NextResponse.json({ signals: [], totalHeadlines: 0 })
    }

    let signals: GeoSignal[]
    let analysisMethod: 'openai' | 'rules' = 'rules'

    if (process.env.OPENAI_API_KEY) {
      try {
        signals = await analyzeWithOpenAI(headlines)
        analysisMethod = 'openai'
      } catch (err) {
        console.error('[geo-risk] OpenAI 분석 실패, 키워드 룰로 fallback:', err)
        signals = applyGeoRules(headlines)
      }
    } else {
      signals = applyGeoRules(headlines)
    }

    return NextResponse.json({
      signals,
      totalHeadlines: headlines.length,
      analysisMethod,
      sources: {
        finnhub: finnhubResult.status === 'fulfilled' ? finnhubResult.value.length : 0,
        rss: rssResult.status === 'fulfilled' ? rssResult.value.length : 0,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
