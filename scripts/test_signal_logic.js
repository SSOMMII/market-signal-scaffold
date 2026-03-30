#!/usr/bin/env node
/**
 * Confidence Threshold & SignalStrength 로직 단위 테스트
 * 
 * 기존 AI 데이터 부족 상황에서도, 로직 자체가 올바르게 작동하는지 검증
 * Mock 데이터로 모든 엣지 케이스를 테스트합니다.
 */

console.log(`\n🧪 신호 로직 단위 테스트 (Mock 데이터)`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// Constants
const CONFIDENCE_THRESHOLD_SELL = 0.40;
const CONFIDENCE_THRESHOLD_BUY = 0.60;

/**
 * Confidence 기반 액션 필터링 함수 (수정됨)
 */
function applyConfidenceFilter(action, lgbm_prob) {
  if (lgbm_prob === null) return action;

  // 신뢰도 0.60 이상일 때만 강한 신호 유지
  // 그렇지 않으면 불확실하니 관망으로 다운그레이드
  if ((action === '매수' || action === '매도') && lgbm_prob < 0.60) {
    return '관망';
  }

  return action;
}

/**
 * 신호 강도 분류 함수
 */
function getSignalStrength(score, confidence, aiLabel) {
  const hasHighConfidence = confidence !== null && confidence >= 0.60;
  const hasAILabel = aiLabel && ['STRONG_BUY', 'STRONG_SELL'].includes(aiLabel);

  if (score >= 75 && (hasHighConfidence || hasAILabel)) {
    return '🚀 강한 매수';
  }
  if (score >= 60) {
    return '📈 매수';
  }
  if (score >= 40) {
    return '➡️ 관망';
  }
  if (score >= 20) {
    return '📉 매도';
  }
  if (hasHighConfidence || hasAILabel) {
    return '🔴 강한 매도';
  }
  return '📉 매도';
}

/**
 * 액션 계산 함수 (기본 로직)
 */
function hybridScoreToAction(hybridScore) {
  if (hybridScore >= 60) return '매수';
  if (hybridScore <= 40) return '매도';
  return '관망';
}

/**
 * 통합 신호 계산
 */
function calculateSignal(score, confidence, aiLabel) {
  const action = hybridScoreToAction(score);
  const filteredAction = applyConfidenceFilter(action, confidence);
  const strength = getSignalStrength(score, confidence, aiLabel);
  return { action, filteredAction, strength };
}

// ────────────────────────────────
// 테스트 케이스
// ────────────────────────────────

const testCases = [
  // 테스트 1: High Confidence + 매수 신호
  {
    name: '고신뢰도 매수 (유지)',
    score: 75,
    confidence: 0.75,
    aiLabel: 'BUY',
    expected: { action: '매수', filteredAction: '매수', strength: '🚀 강한 매수' },
  },
  // 테스트 2: Low Confidence + 매수 신호 => 다운그레이드
  {
    name: '저신뢰도 매수 (다운그레이드)',
    score: 65,
    confidence: 0.30,
    aiLabel: 'BUY',
    expected: { action: '매수', filteredAction: '관망', strength: '🚀 강한 매수' },
  },
  // 테스트 3: Medium Confidence + 매도 신호
  {
    name: '중신뢰도 매도 (다운그레이드)',
    score: 25,
    confidence: 0.45,
    aiLabel: 'SELL',
    expected: { action: '매도', filteredAction: '관망', strength: '📉 매도' },
  },
  // 테스트 4: High Confidence + 매도 신호
  {
    name: '고신뢰도 매도 (유지)',
    score: 15,
    confidence: 0.75,
    aiLabel: 'STRONG_SELL',
    expected: { action: '매도', filteredAction: '매도', strength: '🔴 강한 매도' },
  },
  // 테스트 5: No AI 데이터
  {
    name: 'AI 데이터 없음 (기술적 스코어만)',
    score: 73,
    confidence: null,
    aiLabel: null,
    expected: { action: '매수', filteredAction: '매수', strength: '📈 매수' },
  },
  // 테스트 6: 관망 영역
  {
    name: '관망 신호 (불확실)',
    score: 50,
    confidence: 0.50,
    aiLabel: 'HOLD',
    expected: { action: '관망', filteredAction: '관망', strength: '➡️ 관망' },
  },
  // 테스트 7: 경계값 - confidence 정확히 0.60
  {
    name: 'Confidence 경계값 0.60 (유지)',
    score: 70,
    confidence: 0.60,
    aiLabel: 'BUY',
    expected: { action: '매수', filteredAction: '매수', strength: '📈 매수' },
  },
  // 테스트 8: 경계값 - confidence 정확히 0.40
  {
    name: 'Confidence 경계값 0.40 (다운)',
    score: 30,
    confidence: 0.40,
    aiLabel: 'SELL',
    expected: { action: '매도', filteredAction: '관망', strength: '📉 매도' },
  },
  // 테스트 9: 극단적 고신뢰도
  {
    name: '극단적 고신뢰도 매수',
    score: 88,
    confidence: 0.95,
    aiLabel: 'STRONG_BUY',
    expected: { action: '매수', filteredAction: '매수', strength: '🚀 강한 매수' },
  },
  // 테스트 10: 극단적 저신뢰도
  {
    name: '극단적 저신뢰도 매도',
    score: 5,
    confidence: 0.05,
    aiLabel: 'STRONG_SELL',
    expected: { action: '매도', filteredAction: '매도', strength: '🔴 강한 매도' },
  },
];

// ────────────────────────────────
// 테스트 실행
// ────────────────────────────────

console.log(`📋 Confidence Threshold & SignalStrength 로직 검증\n`);

let passCount = 0;
let failCount = 0;

testCases.forEach((tc, idx) => {
  const result = calculateSignal(tc.score, tc.confidence, tc.aiLabel);
  const pass = JSON.stringify(result) === JSON.stringify(tc.expected);

  const statusIcon = pass ? '✅' : '❌';
  console.log(`${statusIcon} Test ${idx + 1}: ${tc.name}`);
  console.log(`   Input: score=${tc.score}, confidence=${tc.confidence}, aiLabel=${tc.aiLabel}`);
  console.log(
    `   Result: action="${result.action}" -> "${result.filteredAction}" [${result.strength}]`
  );

  if (!pass) {
    console.log(
      `   Expected: action="${tc.expected.action}" -> "${tc.expected.filteredAction}" [${tc.expected.strength}]`
    );
    failCount++;
  } else {
    passCount++;
  }
  console.log();
});

// ────────────────────────────────
// 요약
// ────────────────────────────────

console.log(`${'━'.repeat(50)}`);
console.log(`✅ PASSED: ${passCount}/${testCases.length}`);
console.log(`❌ FAILED: ${failCount}/${testCases.length}`);

if (failCount === 0) {
  console.log(`\n🎉 모든 테스트 통과! 로직이 올바르게 작동합니다.\n`);
} else {
  console.log(`\n⚠️  일부 테스트 실패. 로직 수정이 필요합니다.\n`);
  process.exit(1);
}
