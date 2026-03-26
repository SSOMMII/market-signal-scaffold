# 서비스 기획서: Global Market Bridge AI (v1.0)

- 작성일: 2026-03-25
- 문서 상태: 초안

## 1. 서비스 개요

Global Market Bridge AI는 국내(국장)/미국(미장) 시장 데이터를 통합 분석하여 시차 기반 최적 투자 시나리오와 ETF 시그널을 제공하는 AI 플랫폼입니다.

- 핵심 가치: "잠들지 않는 시장의 연결"
- 타겟: ETF/개인 투자자, 글로벌 거시+기술 분석 사용자

## 2. 핵심 기능

1. 메인 대시보드
  - Night Insight (미장 → 국장)
  - Day Insight (국장 → 미장)
  - Today's Signal Top ETF
  - Global Dashboard (S&P500, NASDAQ, VIX, WTI, USD/KRW)

2. 상세 페이지
  - Insight Detail: 예측 근거 + AI 리포트
  - ETF Signal Lab: 매수/매도/관망, 백테스트
  - My Portfolio: 관심종목 관리 + 알림

3. 예측 이력
  - 예측 데이터 및 적중률 트래킹

4. 알림
  - 조건형 푸시: 가격, 지표, AI 시그널

## 3. KPI

- 예측 정확도 90%+ (방향성)
- ETF 시그널 성공률 75%+
- 세션 5분 이상
- 주간 재방문률 60%+
- API 응답 1초 미만

## 4. 아키텍처 (현재 구현)

- Frontend: Next.js 14 + TypeScript + Tailwind
- Data Layer: `db/schema.sql`, Supabase
- Context: `MarketContext` (KR/US)
- 공통 컴포넌트: `components/icons`, `components/MiniChart`
- Data 모듈: `lib/detailData`, `lib/historyData`, `lib/marketData`
- Supabase util: `lib/supabaseClient`

## 5. DB 설계 (PRD 기반)

- table: market_master, daily_indicators, ai_signals, user_alerts, global_indicators, users
- 지표: RSI, MACD, SMA, 선물, 환율, 외인수급
- key: market_master_id + as_of_date

## 6. 서비스 흐름

1. 로그인/메인 진입
2. 국장/미장 토글
3. Today's Signal 확인
4. 상세 예측상세 이동
5. 관심 종목 alert 설정

## 7. 로드맵

- MVP: UI + 모의 데이터 + Supabase 기본
- Phase1: 실시간 API + AI 리포트 + 알림
- Phase2: 계좌 연동 + 포트폴리오 진단
- Phase3: 커뮤니티 + 예측 리그

## 8. 향후 작업

- `supabase` CRUD 확장
- `/api` 라우트 모듈화
- AI 모델 파이프라인
- UI/UX 고도화
