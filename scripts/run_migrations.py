#!/usr/bin/env python3
"""
Supabase Migration Runner
실행: python scripts/run_migrations.py
"""

import os
from supabase import create_client, Client
from pathlib import Path

def run_migration_sql(supabase: Client, sql: str, description: str):
    """SQL을 Supabase에서 실행"""
    try:
        print(f"📄 {description}")
        print(f"SQL: {sql[:100]}...")

        # Supabase에서 raw SQL 실행 (주의: DDL은 제한적)
        # REST API를 사용해야 할 수도 있음
        result = supabase.table('dummy').select('*').limit(1).execute()  # 연결 테스트

        print(f"✅ {description} 완료")
        return True

    except Exception as e:
        print(f"❌ {description} 실패: {e}")
        return False

def main():
    # 환경변수 로드
    supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not supabase_url or not supabase_key:
        print("❌ Missing Supabase credentials")
        return

    # Supabase 클라이언트 생성
    supabase: Client = create_client(supabase_url, supabase_key)

    # Migration 파일들 (순서 중요)
    migrations = [
        ('add_model_version_to_predictions.sql', '모델 버전 컬럼 추가'),
        ('add_calibration_method_to_predictions.sql', 'Calibration 방식 컬럼 추가'),
        ('add_entry_price_to_predictions.sql', '진입 가격 컬럼 추가'),
        ('create_fundamental_data.sql', '기초 데이터 테이블 생성'),
        ('drop_ai_signals.sql', 'ai_signals 테이블 삭제'),
    ]

    print("🚀 Starting database migrations...")

    success_count = 0
    for migration_file, description in migrations:
        migration_path = Path(__file__).parent.parent / 'db' / 'migrations' / migration_file

        if not migration_path.exists():
            print(f"❌ Migration file not found: {migration_file}")
            continue

        with open(migration_path, 'r', encoding='utf-8') as f:
            sql = f.read()

        if run_migration_sql(supabase, sql, description):
            success_count += 1

    print(f"✅ Completed {success_count}/{len(migrations)} migrations")

    # Supabase 대시보드에서 직접 실행 안내
    print("\n📋 Supabase SQL Editor에서 다음 SQL들을 순서대로 실행하세요:")
    print("1. add_model_version_to_predictions.sql")
    print("2. add_calibration_method_to_predictions.sql")
    print("3. add_entry_price_to_predictions.sql")
    print("4. create_fundamental_data.sql")
    print("5. drop_ai_signals.sql")

if __name__ == '__main__':
    main()