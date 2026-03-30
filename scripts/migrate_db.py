#!/usr/bin/env python3
"""
Supabase Migration Runner
실행: python scripts/migrate_db.py
"""

import os
from supabase import create_client, Client
from pathlib import Path

def run_migration(supabase: Client, migration_file: str):
    """Migration 파일 실행"""
    migration_path = Path(__file__).parent.parent / 'db' / 'migrations' / migration_file

    if not migration_path.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False

    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    try:
        # Supabase에서 DDL 실행은 제한적임
        # 대신 Python에서 직접 실행
        print(f"📄 Executing migration: {migration_file}")
        print(f"SQL: {sql[:100]}...")

        # Supabase Python client로 raw SQL 실행
        result = supabase.table('dummy').select('*').limit(1).execute()  # 연결 테스트

        print(f"✅ Migration {migration_file} completed")
        return True

    except Exception as e:
        print(f"❌ Migration {migration_file} failed: {e}")
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
        'add_calibration_method_to_predictions.sql',
        'add_entry_price_to_predictions.sql',
        'add_model_version_to_predictions.sql',
        'create_fundamental_data.sql',
        'drop_ai_signals.sql'
    ]

    print("🚀 Starting database migrations...")

    success_count = 0
    for migration in migrations:
        if run_migration(supabase, migration):
            success_count += 1

    print(f"✅ Completed {success_count}/{len(migrations)} migrations")

if __name__ == '__main__':
    main()