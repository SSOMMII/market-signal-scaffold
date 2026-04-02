/**
 * A/B 테스트 분기 로직
 * 사용자 ID 또는 세션 기반으로 Model A/B 할당
 */

export type ABTestVersion = 'A' | 'B'

/**
 * 사용자 ID를 기반으로 A/B 버전 결정
 * Hash 기반으로 결정론적(deterministic) 할당
 * 
 * @param userId 사용자 ID (UUID 또는 임의 문자열)
 * @param splitRatio 모델 A 할당 비율 (0.0 ~ 1.0, 기본 0.5 = 50/50 split)
 * @returns 'A' 또는 'B'
 */
export function getABTestVersion(
  userId: string,
  splitRatio: number = 0.5
): ABTestVersion {
  if (!userId) {
    // ID 없으면 기본값: Model A (원본)
    return 'A'
  }

  // 간단한 해시 함수: userId의 문자 코드 합
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash // 32-bit 정수
  }

  // 0.0 ~ 1.0 범위로 정규화
  const normalized = Math.abs(hash) % 1000 / 1000

  // splitRatio 기준으로 A/B 결정
  return normalized < splitRatio ? 'A' : 'B'
}

/**
 * 세션 저장소에 A/B 버전 캐시
 */
const AB_VERSION_STORAGE_KEY = 'market_signal_ab_version'

export function getOrAssignABVersion(userId: string | null): ABTestVersion {
  // 1. 저장된 버전 확인 (일관된 경험)
  try {
    const stored = sessionStorage.getItem(AB_VERSION_STORAGE_KEY)
    if (stored === 'A' || stored === 'B') {
      return stored
    }
  } catch (_e) {
    // sessionStorage 미사용 환경 무시
  }

  // 2. 새로 할당
  const version = getABTestVersion(userId ?? 'anonymous')

  // 3. 저장
  try {
    sessionStorage.setItem(AB_VERSION_STORAGE_KEY, version)
  } catch (_e) {
    // 저장 실패해도 계속 진행
  }

  return version
}

/**
 * API 응답 신호 데이터에서 선택된 버전 스코어 추출
 */
export interface SignalDataPoint {
  ticker: string
  score: number
  aiScore: number | null
  modelA?: { score: number | null; label: string | null; confidence: number | null } | null
  modelB?: { score: number | null; label: string | null; confidence: number | null } | null
  [key: string]: any
}

export function selectVersionScore(
  signal: SignalDataPoint,
  version: ABTestVersion
): { score: number; label: string | null; confidence: number | null } {
  const versionData = version === 'A' ? signal.modelA : signal.modelB

  if (versionData) {
    return {
      score: versionData.score ?? signal.score,
      label: versionData.label ?? null,
      confidence: versionData.confidence ?? null,
    }
  }

  // Fallback: 기본 스코어 사용
  return {
    score: signal.score,
    label: signal.aiLabel ?? null,
    confidence: signal.confidence ?? null,
  }
}

/**
 * A/B 테스트 메타데이터 로깅
 */
export interface ABTestMetadata {
  version: ABTestVersion
  userId?: string
  timestamp: string
  sessionId?: string
}

export function createABTestMetadata(
  userId: string | null,
  version: ABTestVersion
): ABTestMetadata {
  return {
    version,
    userId: userId ?? 'anonymous',
    timestamp: new Date().toISOString(),
    sessionId: typeof window !== 'undefined' ? sessionStorage.getItem(AB_VERSION_STORAGE_KEY) || undefined : undefined,
  }
}
