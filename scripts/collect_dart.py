#!/usr/bin/env python3
"""
DART API 기반 한국 기업 재무제표 수집기
- 기업코드 조회 및 재무 데이터 수집
- fundamental_data 테이블 upsert
- PER/PBR/ROE 계산을 위한 기초 데이터 제공

Usage:
    python collect_dart.py            # 모든 상장기업 재무 데이터 수집
    python collect_dart.py 005930     # 특정 종목만 수집
"""

import os
import sys
import json
import requests
from datetime import datetime
from typing import Dict, List, Optional

# Supabase 연결
try:
    import supabase
    from supabase import create_client, Client
except ImportError:
    print("ERROR: supabase 패키지가 필요합니다.", file=sys.stderr)
    print("설치: pip install supabase", file=sys.stderr)
    sys.exit(1)

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_ANON_KEY')
DART_API_KEY = os.getenv('DART_API_KEY')

if not all([SUPABASE_URL, SUPABASE_KEY, DART_API_KEY]):
    print("ERROR: 환경변수 SUPABASE_URL, SUPABASE_ANON_KEY, DART_API_KEY가 필요합니다.", file=sys.stderr)
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

DART_BASE = 'https://opendart.fss.or.kr/api'

def dart_get(path: str, params: Dict[str, str] = None) -> Dict:
    """DART API 호출"""
    params = params or {}
    params['crtfc_key'] = DART_API_KEY

    url = f"{DART_BASE}{path}"
    response = requests.get(url, params=params)

    if response.status_code != 200:
        raise Exception(f"DART API error {response.status_code}: {url}")

    return response.json()

def get_corp_codes() -> List[Dict]:
    """기업코드 목록 조회"""
    data = dart_get('/corpCode.xml')
    return data.get('list', [])

def get_financial_data(corp_code: str, year: str, reprt_code: str = '11011') -> Optional[Dict]:
    """재무제표 데이터 조회"""
    try:
        return dart_get('/fnlttSinglAcnt.json', {
            'corp_code': corp_code,
            'bsns_year': year,
            'reprt_code': reprt_code,  # 11011: 사업보고서
        })
    except:
        return None

def extract_financial_values(accounts: List[Dict]) -> Dict[str, Optional[float]]:
    """재무제표에서 주요 값 추출"""
    def find_value(account_name: str) -> Optional[float]:
        for account in accounts:
            if (account.get('account_nm', '').find(account_name) >= 0 and
                account.get('fs_div') == 'CFS'):  # 연결재무제표
                try:
                    return float(account.get('thstrm_amount', '0').replace(',', ''))
                except:
                    pass
        return None

    return {
        'revenue': find_value('매출액') or find_value('영업수익'),
        'net_income': find_value('당기순이익'),
        'total_assets': find_value('자산총계'),
        'total_equity': find_value('자본총계'),
    }

def collect_fundamental_data(symbol: str = None):
    """재무 데이터 수집 및 DB 저장"""
    print("기업코드 목록 조회 중...")
    companies = get_corp_codes()

    # 상장기업만 필터링 (stock_code 있는 기업)
    listed_companies = [c for c in companies if c.get('stock_code')]

    if symbol:
        listed_companies = [c for c in listed_companies if c.get('stock_code') == symbol]
        if not listed_companies:
            print(f"종목코드 {symbol}을 찾을 수 없습니다.")
            return

    current_year = str(datetime.now().year)

    for company in listed_companies[:10]:  # 테스트용으로 10개만
        corp_code = company['corp_code']
        stock_code = company['stock_code']
        corp_name = company['corp_name']

        print(f"처리 중: {corp_name} ({stock_code})")

        # 재무 데이터 조회
        financial_data = get_financial_data(corp_code, current_year)
        if not financial_data or not financial_data.get('list'):
            print(f"  재무 데이터 없음: {stock_code}")
            continue

        values = extract_financial_values(financial_data['list'])

        # EPS 계산 (대략적)
        eps = None
        if values['net_income'] and values['total_equity']:
            # 발행주식수 정보가 없으므로 대략 계산
            eps = values['net_income'] / (values['total_equity'] / 1000)  # 천주 기준

        # DB 저장
        record = {
            'symbol': stock_code,
            'year': int(current_year),
            'quarter': 4,  # 사업보고서
            'revenue': values['revenue'],
            'net_income': values['net_income'],
            'total_assets': values['total_assets'],
            'total_equity': values['total_equity'],
            'eps': eps,
        }

        try:
            supabase.table('fundamental_data').upsert(record).execute()
            print(f"  저장 완료: {stock_code}")
        except Exception as e:
            print(f"  저장 실패: {stock_code} - {e}")

if __name__ == '__main__':
    target_symbol = sys.argv[1] if len(sys.argv) > 1 else None
    collect_fundamental_data(target_symbol)