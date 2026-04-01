import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/history?market=kr|us
 *
 * ai_predictions 테이블의 대표 종목 예측 이력 + 실제 지수 변동률을 조합해 반환.
 * - KR 대표: 069500.KS (KODEX 200)
 * - US 대표: SPY
 *
 * 반환:
 *   {
 *     data: {
 *       predictions: PredictionRecord[]
 *       statCards: StatCard[]
 *     }
 *   }
 */

type PredictionRecord = {
  date: string;
  direction: '상승' | '하락';
  confidence: number;
  actual: '상승' | '하락' | null;
  kospiActual: string;
  nasdaqActual: string;
  foreignBuy: string;
  hit: boolean | null;
  summary: string;
};

type StatCard = {
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
};

function fmtPct(
  curr: number | null | undefined,
  prev: number | null | undefined
): string {
  if (curr == null || prev == null || prev === 0) return '-';
  const chg = ((curr - prev) / prev) * 100;
  return (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%';
}

function formatForeignBuy(val: number | null | undefined): string {
  if (val == null) return '-';
  const eok = Math.round(val / 1e8);
  return (eok >= 0 ? '+' : '') + eok.toLocaleString('ko-KR') + '억';
}

/**
 * 날짜 배열을 ascending 정렬된 rows에서 이전날 close 를 찾는 유틸
 */
function getPrevClose(
  sortedRows: { as_of_date: string; close: number | null }[],
  date: string
): number | null {
  const idx = sortedRows.findIndex((r) => r.as_of_date === date);
  if (idx <= 0) return null;
  return sortedRows[idx - 1].close;
}

function buildSummary(
  signalLabel: string | null,
  kospiActual: string,
  nasdaqActual: string,
  hit: boolean | null
): string {
  const hitStr = hit === null ? '검증 대기.' : hit ? '예측 적중.' : '예측 빗나감.';
  if (!signalLabel)
    return `AI 시그널 분석. 코스피 ${kospiActual}, 나스닥 ${nasdaqActual}. ${hitStr}`;
  const upper = signalLabel.toUpperCase();
  if (upper.includes('BUY'))
    return `AI 매수 시그널. 코스피 ${kospiActual}, 나스닥 ${nasdaqActual}. ${hitStr}`;
  if (upper.includes('SELL'))
    return `AI 매도 시그널. 코스피 ${kospiActual}, 나스닥 ${nasdaqActual}. ${hitStr}`;
  return `AI 관망 시그널. 코스피 ${kospiActual}, 나스닥 ${nasdaqActual}. ${hitStr}`;
}

export async function GET(req: NextRequest) {
  try {
    const market = req.nextUrl.searchParams.get('market') ?? 'kr';
    const isKr = market === 'kr';
    const repTicker = isKr ? '069500.KS' : 'SPY';

    // 1. ai_predictions: 대표 종목 최근 30건
    const { data: aiPreds, error: predErr } = await supabase
      .from('ai_predictions')
      .select('ticker, date, signal_score, signal_label, lgbm_prob')
      .eq('ticker', repTicker)
      .order('date', { ascending: false })
      .limit(30);

    if (predErr) throw predErr;
    if (!aiPreds?.length) {
      return NextResponse.json({
        data: { predictions: [], statCards: buildEmptyStatCards() },
      });
    }

    const dates = aiPreds.map((p) => p.date);

    // 2. 대표 종목 market_master id 조회
    const { data: repMaster } = await supabase
      .from('market_master')
      .select('id')
      .eq('symbol', repTicker)
      .maybeSingle();

    // 3. KOSPI (^KS11), NASDAQ (^IXIC) market_master id 조회
    const [kospiMasterRes, nasdaqMasterRes] = await Promise.all([
      supabase
        .from('market_master')
        .select('id')
        .eq('symbol', '^KS11')
        .maybeSingle(),
      supabase
        .from('market_master')
        .select('id')
        .eq('symbol', '^IXIC')
        .maybeSingle(),
    ]);
    const kospiMaster = kospiMasterRes.data;
    const nasdaqMaster = nasdaqMasterRes.data;

    // 4. daily_indicators 조회 (LIMIT 충분히)
    const fetchIndicatorRows = async (masterId: number | undefined) => {
      if (!masterId) return [];
      const { data } = await supabase
        .from('daily_indicators')
        .select('as_of_date, close')
        .eq('market_master_id', masterId)
        .order('as_of_date', { ascending: false })
        .limit(90);
      const rows = (data ?? []) as {
        as_of_date: string;
        close: number | null;
      }[];
      return rows.sort((a, b) => a.as_of_date.localeCompare(b.as_of_date));
    };

    const [repRows, kospiRows, nasdaqRows] = await Promise.all([
      fetchIndicatorRows(repMaster?.id),
      fetchIndicatorRows(kospiMaster?.id),
      fetchIndicatorRows(nasdaqMaster?.id),
    ]);

    // as_of_date → close 맵 (빠른 조회용)
    const repByDate: Record<string, number | null> = {};
    const kospiByDate: Record<string, number | null> = {};
    const nasdaqByDate: Record<string, number | null> = {};
    for (const r of repRows) repByDate[r.as_of_date] = r.close;
    for (const r of kospiRows) kospiByDate[r.as_of_date] = r.close;
    for (const r of nasdaqRows) nasdaqByDate[r.as_of_date] = r.close;

    // 5. Foreign flow (KR only, 해당 날짜 포함)
    const ffByDate: Record<string, number> = {};
    if (isKr) {
      const { data: ffRows } = await supabase
        .from('foreign_flow')
        .select('as_of_date, net_buy')
        .eq('market', 'KRX')
        .in('as_of_date', dates);
      for (const row of ffRows ?? []) ffByDate[row.as_of_date] = row.net_buy;
    }

    // 6. 예측 레코드 구성
    const predictions: PredictionRecord[] = aiPreds.map((p) => {
      const date = p.date;
      const score = p.signal_score ?? 50;
      const confidence =
        p.lgbm_prob != null
          ? Math.round(p.lgbm_prob * 100)
          : Math.min(95, Math.max(5, Math.round(score)));

      // 예측 방향: score >= 50 → 상승
      const direction: '상승' | '하락' = score >= 50 ? '상승' : '하락';

      // 실제 방향: 대표 종목 당일 vs 전날 비교 (데이터 없으면 null — 통계 분모 제외)
      const repClose = repByDate[date];
      const repPrev = getPrevClose(repRows, date);
      const actual: '상승' | '하락' | null =
        repClose != null && repPrev != null
          ? repClose >= repPrev
            ? '상승'
            : '하락'
          : null;

      const hit: boolean | null = actual !== null ? direction === actual : null;

      const kospiActual = fmtPct(
        kospiByDate[date],
        getPrevClose(kospiRows, date)
      );
      const nasdaqActual = fmtPct(
        nasdaqByDate[date],
        getPrevClose(nasdaqRows, date)
      );
      const foreignBuy = isKr ? formatForeignBuy(ffByDate[date]) : '-';
      const summary = buildSummary(
        p.signal_label,
        kospiActual,
        nasdaqActual,
        hit
      );

      return {
        date,
        direction,
        confidence,
        actual,
        kospiActual,
        nasdaqActual,
        foreignBuy,
        hit,
        summary,
      };
    });

    // 7. Stat Cards 계산 (actual=null 인 미검증 레코드는 적중률 분모에서 제외)
    const total = predictions.length;
    const verifiable = predictions.filter((p) => p.hit !== null);
    const hits = verifiable.filter((p) => p.hit === true).length;
    const accuracy = verifiable.length > 0 ? Math.round((hits / verifiable.length) * 100) : 0;
    const avgConf =
      total > 0
        ? Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / total)
        : 0;

    let streak = 0;
    for (const p of predictions) {
      if (p.hit === true) streak++;
      else break;
    }

    const statCards: StatCard[] = [
      {
        label: '총 예측 횟수',
        value: `${total}회`,
        sub: '최근 30일',
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
      },
      {
        label: '예측 정확도',
        value: `${accuracy}%`,
        sub: '적중/전체',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
      },
      {
        label: '평균 신뢰도',
        value: `${avgConf}%`,
        sub: '이번 달 평균',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
      },
      {
        label: '연속 적중',
        value: `${streak}회`,
        sub: '현재 연속 기록',
        color: 'text-purple-600',
        bg: 'bg-purple-50',
      },
    ];

    return NextResponse.json({ data: { predictions, statCards } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildEmptyStatCards(): StatCard[] {
  return [
    {
      label: '총 예측 횟수',
      value: '0회',
      sub: '데이터 없음',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: '예측 정확도',
      value: '-',
      sub: '데이터 없음',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: '평균 신뢰도',
      value: '-',
      sub: '데이터 없음',
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: '연속 적중',
      value: '0회',
      sub: '데이터 없음',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ];
}
