---
name: project_status
description: 실데이터 연동 현황 및 다음 단계 계획 (2026-04-02 기준)
type: project
---

## 완료된 작업

- 공모주 캘린더: 실데이터 (38.co.kr 크롤링)
- 상세분석 배너·ETF·기술지표: 실데이터 (API 실패 시 hardcoded fallback)
- 상세분석 섹터 히트맵: 실데이터 (market_master.sector 컬럼 필요)
- Geo-Risk: OpenAI gpt-4o-mini 연동 (키워드 룰 fallback)
- KIS 외국인/기관/개인 수급 파이프라인: inquire-investor 방식으로 구축 완료
- AI 어시스턴트: 국내 종목 투자자별 순매수 카드 추가
- Supabase daily_indicators: orgn_net_flow, prsn_net_flow 컬럼 추가

## 앞으로 할 일 (우선순위 순)

1. **상세분석 탭 콘텐츠 재정의** (현재 같은 데이터 레이아웃만 바꾸는 상태 → 의미 없음)
   - 일간: 당일 ETF 신호 + 외국인 수급 요약
   - 주간: 5일치 지표 추세 차트
   - 섹터별: 섹터 점수 + 대표 종목
   - 커스텀: 사용자 지정 필터 (포트폴리오 연동 후)

2. **예측이력 자동 저장 크론** — ai_predictions 데이터 1건뿐, 이력 페이지 빈 화면
   - 옵션 A: Vercel Cron + /api/cron/predict (JS 포팅)
   - 옵션 B: GitHub Actions로 Python LGBM 매일 실행

3. **포트폴리오 기능 활성화** — 사용자 인증 + DB 설계 필요

4. **market_master.sector 컬럼 확인** — 없으면 섹터 히트맵 fallback만 표시

5. **AI 리포트 자동화** — 현재 hardcoded, OpenAI 비용 발생 → 마지막 적용

**Why:** 실서비스 목표, 데이터 파이프라인 우선 완성 후 UI 고도화 순서
**How to apply:** 새 작업 시작 전 이 목록 참조
