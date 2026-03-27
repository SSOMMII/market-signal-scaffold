"""
KIS API 토큰 발급 테스트
실행: python scripts/test_kis_token.py
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")

APP_KEY = os.getenv("KIS_APP_KEY")
APP_SECRET = os.getenv("KIS_APP_SECRET")

if not APP_KEY or not APP_SECRET:
    print("❌ .env.local에 KIS_APP_KEY / KIS_APP_SECRET 없음")
    exit(1)

url = "https://openapi.koreainvestment.com:9443/oauth2/tokenP"
body = {
    "grant_type": "client_credentials",
    "appkey": APP_KEY,
    "appsecret": APP_SECRET,
}

print("토큰 발급 요청 중...")
res = requests.post(url, json=body)
data = res.json()

if res.status_code == 200 and data.get("access_token"):
    token = data["access_token"]
    expires = data.get("access_token_token_expired", "")
    print(f"✅ 토큰 발급 성공!")
    print(f"   만료: {expires}")
    print(f"   토큰 앞 20자: {token[:20]}...")
else:
    print(f"❌ 실패 (HTTP {res.status_code})")
    print(f"   응답: {data}")
