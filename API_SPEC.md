# Market Signal Scaffold API & Secret Management

## 1. 현재 사용 중인 데이터 API (Supabase)
- `lib/supabaseClient.ts`에서 Supabase 클라이언트 생성 및 DB 호출을 관리합니다.
- 현재 지원 함수:
  - `getMarketMasters()`
    - 설명: `market_master` 테이블에서 전체 시장 마스터 데이터를 가져옵니다.
    - 반환: 전체 row 목록
  - `getDailyIndicators(marketMasterId, date?)`
    - 설명: `daily_indicators` 테이블에서 market_master_id 기준 필터 조회
    - 파라미터:
      - `marketMasterId` (number, 필수)
      - `date` (string, 선택, `YYYY-MM-DD`)

## 2. 제안 API 엔드포인트 (백엔드 확장 시)
1. `GET /api/market-masters`
   - 기능: `getMarketMasters()` 호출
   - 응답: `{ data: MarketMaster[] }`
2. `GET /api/daily-indicators?marketMasterId={id}&date={YYYY-MM-DD}`
   - 기능: `getDailyIndicators` 호출
   - 응답: `{ data: DailyIndicator[] }`
3. `GET /api/krx/etf/list`
   - 기능: 국장 ETF 목록 제공
   - 응답: `{ data: ETFInfo[] }`
4. `GET /api/us/market?symbol={symbol}&range={1d,5d,1mo}`
   - 기능: 미국 시장 가격/변동성 데이터
   - 응답: `{ data: USMarketQuote }`
5. `GET /api/economic/indicators?type={cpi,gdp,interest}`
   - 기능: 거시 지표(물가, GDP, 금리) 데이터
   - 응답: `{ data: EconomicIndicator[] }`
6. `POST /api/market-masters` (관리자)
   - Body: `{ name, ticker, category, ... }`
   - 인증: 서버 전용 API 키 또는 JWT 토큰
7. `POST /api/daily-indicators` (관리자)
   - Body: `{ marketMasterId, asOfDate, open, high, low, close, volume }`
   - 인증 필수
8. `GET /api/statistics/summary` (선택)
   - 권장: 캐시된 요약 데이터

## 2-1. 필요 API 목록 (국장/미장)
- `KRX`:
  - 시가/고가/저가/종가/거래량
  - 업종지수, 외인/기관/개인 순매수
  - ETF 시그널, 배당, 펀드 순위
- `미장`:
  - S&P500, NASDAQ100, Dow Jones
  - 종목별 OHLC, 선물/옵션 (ES, NQ, YM)
  - 달러인덱스, 국채 10년 금리
- 매칭/시차데이터:
  - `국장 마감 + 미장 개장` / `미장 마감 + 국장 개장`
  - 환율(원/달러), 금리, 국제유가, 반도체 지수
- 서브 데이터:
  - 뉴스 취합(네이버/다음/Reuters), 공시, 실적
  - Sentiment (키워드, 바이럴 지표)

## 2-2. 필요한 외부 API와 키
- KRX Open API (국내 지수/ETF)
  - `KRX_API_KEY` (또는 별도 인증 방식)
- Alpha Vantage / Finnhub / Yahoo Finance (미국 시장)
  - `ALPHAVANTAGE_API_KEY`
  - `FINNHUB_API_KEY`
- OpenAI (리포트, 요약)
  - `OPENAI_API_KEY`
- Supabase
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- 인증/세션
  - `JWT_SECRET`
  - `NEXTAUTH_URL`

## 3. 키/환경 변수 목록
### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` (public, 클라이언트 코드에서만 사용)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public 익명 키)

### 향후 백엔드에 추가할 항목
- `SUPABASE_SERVICE_ROLE_KEY` (서버 사이드 전용, 권한 높은 키)
- `DATABASE_URL` (Postgres/기타 DB 연결 문자열)
- `NEXTAUTH_URL` (인증 서버 URL)
- `JWT_SECRET` (토큰 서명 비밀)
- `OPENAI_API_KEY` (AI 리포트 필요 시)

## 4. 키 관리 가이드
1. 로컬
   - `.env.local`에 저장 (절대 커밋 금지, `.gitignore` 이미 적용됨)
   - 샘플 파일 `.env.example` 생성 후 공유
2. CI/CD
   - GitHub Actions: `Secrets`에 추가 후 workflow에서 `secrets.NEXT_PUBLIC_SUPABASE_URL` 사용
   - Vercel: 환경 변수 설정에 동일 키 등록
3. 서버 사이드 키는 `NEXT_PUBLIC_` 접두어 없이 사용
   - 클라이언트로 절대 노출되지 않도록 주의
4. 키 교체/롤링
   - 실제 서비스 중인 키를 변경 시 기존 키 만료 전 새로운 키를 미리 추가
   - 1회성 유출 시 즉시 키 무효화

## 5. 환경 변수 예시
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-jwt-secret
OPENAI_API_KEY=your-openai-key
```
