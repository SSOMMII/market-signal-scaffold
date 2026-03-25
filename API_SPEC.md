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
3. `POST /api/market-masters` (관리자)
   - Body: `{ name, ticker, category, ... }`
   - 인증: 서버 전용 API 키 또는 JWT 토큰
4. `POST /api/daily-indicators` (관리자)
   - Body: `{ marketMasterId, asOfDate, open, high, low, close, volume }`
   - 인증 필수
5. `GET /api/statistics/summary` (선택)
   - 권장: 캐시된 요약 데이터

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
