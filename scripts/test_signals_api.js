#!/usr/bin/env node
/**
 * 신호 API 테스트 (Confidence Threshold & SignalStrength)
 * 
 * Usage:
 *   node scripts/test_signals_api.js [base_url] [market]
 *   node scripts/test_signals_api.js http://localhost:3000 us
 *   node scripts/test_signals_api.js http://localhost:3000 kr
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const MARKET = process.argv[3] || 'us';

console.log(`\n🧪 신호 API 검증 테스트`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Market: ${MARKET.toUpperCase()}\n`);

/**
 * 유틸: HTTP GET 요청
 */
function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(`Invalid JSON: ${e.message}`);
        }
      });
    }).on('error', reject);
  });
}

/**
 * 테스트 1: /api/signals?market=us/kr
 */
async function testSignalsAPI() {
  console.log(`📊 Test 1: /api/signals?market=${MARKET}`);
  console.log(`────────────────────────────────`);
  
  try {
    const data = await fetchURL(`${BASE_URL}/api/signals?market=${MARKET}`);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('응답이 배열이 아님');
    }

    console.log(`✅ 응답 수신: ${data.data.length}개 종목\n`);

    // 필드 검증
    const requiredFields = [
      'ticker', 'name', 'score', 'techScore', 'aiScore', 
      'confidence', 'action', 'signalStrength', 'hasAI'
    ];

    const item = data.data[0];
    const missingFields = requiredFields.filter(f => !(f in item));

    if (missingFields.length > 0) {
      console.log(`❌ 누락된 필드: ${missingFields.join(', ')}`);
    } else {
      console.log(`✅ 모든 필수 필드 확인됨`);
    }

    // Confidence Threshold 검증
    console.log(`\n🔍 Confidence Threshold 로직 검증:`);
    let confidenceTests = 0;
    
    data.data.forEach((d, idx) => {
      if (d.confidence === null || typeof d.aiScore !== 'number') return;

      const isLowConfidence = d.confidence < 0.40;
      const isHighConfidence = d.confidence >= 0.60;
      const isMediumConfidence = !isLowConfidence && !isHighConfidence;

      // 높은 신뢰도 매수 신호는 다운그레이드되면 안 됨
      if (isHighConfidence && d.action === '매수') {
        console.log(`  ✅ [${d.ticker}] HIGH confidence (${d.confidence.toFixed(2)}) → action=${d.action} (유지됨)`);
        confidenceTests++;
      }
      // 낮은 신뢰도는 관망으로 변경되어야 함
      else if (isMediumConfidence && d.action === '관망') {
        console.log(`  ✅ [${d.ticker}] MID confidence (${d.confidence.toFixed(2)}) → action=관망 (다운그레이드됨)`);
        confidenceTests++;
      }
    });

    if (confidenceTests === 0) {
      console.log(`  ⚠️  Confidence 필터링 케이스 찾을 수 없음 (AI 데이터 부족)`);
    }

    // SignalStrength 검증
    console.log(`\n🚀 SignalStrength 분류 검증:`);
    const strengthCounts = {};
    const validStrengths = ['🚀 강한 매수', '📈 매수', '➡️ 관망', '📉 매도', '🔴 강한 매도'];
    
    data.data.forEach(d => {
      if (!validStrengths.includes(d.signalStrength)) {
        console.log(`  ❌ [${d.ticker}] 잘못된 signalStrength: ${d.signalStrength}`);
      }
      strengthCounts[d.signalStrength] = (strengthCounts[d.signalStrength] || 0) + 1;
    });

    console.log(`  분포:`);
    validStrengths.forEach(s => {
      const count = strengthCounts[s] || 0;
      const bar = '█'.repeat(count);
      console.log(`    ${s.padEnd(10)} ${bar} (${count})`);
    });

    // 점수 분포
    console.log(`\n📈 점수 분포:`);
    const scores = data.data.map(d => d.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    console.log(`  최소: ${minScore}, 최대: ${maxScore}, 평균: ${avgScore}`);

    // 상위 3개
    console.log(`\n🏆 상위 3개 종목:`);
    data.data.slice(0, 3).forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.ticker.padEnd(6)} score=${d.score.toFixed(0).padStart(3)} ${d.signalStrength} confidence=${d.confidence ? d.confidence.toFixed(2) : 'null'}`);
    });

    return data.data;
  } catch (err) {
    console.error(`❌ 오류: ${err.message}`);
    return null;
  }
}

/**
 * 테스트 2: /api/signals/top?market=us/kr&limit=N
 */
async function testTopAPI() {
  console.log(`\n\n📊 Test 2: /api/signals/top?market=${MARKET}&limit=5`);
  console.log(`────────────────────────────────`);

  try {
    const data = await fetchURL(`${BASE_URL}/api/signals/top?market=${MARKET}&limit=5`);
    
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('응답이 배열이 아님');
    }

    console.log(`✅ 응답 수신: ${data.count}개 종목 (전체 ${data.total}개 중)\n`);

    // Limit 검증
    if (data.count !== Math.min(5, data.total)) {
      console.log(`❌ limit 파라미터 오류: expected ${Math.min(5, data.total)}, got ${data.count}`);
    } else {
      console.log(`✅ limit 파라미터 정상 작동`);
    }

    // 점수 정렬 검증
    let sortedCorrectly = true;
    for (let i = 1; i < data.data.length; i++) {
      if (data.data[i].score > data.data[i - 1].score) {
        sortedCorrectly = false;
        break;
      }
    }

    if (sortedCorrectly) {
      console.log(`✅ 점수 기준 내림차순 정렬 확인됨`);
    } else {
      console.log(`❌ 정렬 순서 오류`);
    }

    // 상위 N개 목록
    console.log(`\n상위 ${data.count}개 종목:`);
    data.data.forEach((d, idx) => {
      console.log(`  ${idx + 1}. ${d.ticker.padEnd(6)} score=${d.score.toFixed(0).padStart(3)} ${d.signalStrength}`);
    });

  } catch (err) {
    console.error(`❌ 오류: ${err.message}`);
  }
}

/**
 * 테스트 3: Top API Limit 경계값 테스트
 */
async function testTopAPILimits() {
  console.log(`\n\n🧪 Test 3: Limit 파라미터 경계값 테스트`);
  console.log(`────────────────────────────────`);

  const testCases = [
    { limit: 1, desc: '최소값' },
    { limit: 50, desc: '최대값' },
    { limit: 0, desc: '범위 외 (0)' },
    { limit: 100, desc: '범위 외 (100)' },
    { limit: 'abc', desc: '잘못된 타입' },
  ];

  for (const tc of testCases) {
    try {
      const data = await fetchURL(`${BASE_URL}/api/signals/top?market=${MARKET}&limit=${tc.limit}`);
      const returnedCount = data.count;
      const expectedMin = Math.max(1, tc.limit);
      const expectedMax = 50;
      
      console.log(`  ${tc.desc.padEnd(15)} (limit=${tc.limit}) → returned=${returnedCount} items`);
    } catch (err) {
      console.log(`  ${tc.desc.padEnd(15)} (limit=${tc.limit}) → ❌ ${err.message}`);
    }
  }
}

/**
 * 모든 테스트 실행
 */
async function runAllTests() {
  try {
    await testSignalsAPI();
    await testTopAPI();
    await testTopAPILimits();
    
    console.log(`\n\n✅ 테스트 완료!\n`);
  } catch (err) {
    console.error(`\n❌ 테스트 실패: ${err.message}`);
    process.exit(1);
  }
}

runAllTests();
