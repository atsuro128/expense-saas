#!/bin/bash
set -e

# このスクリプトは docker-compose の db サービス初回起動時に
# /docker-entrypoint-initdb.d/ 経由で自動実行される。
# expense_app ロールを作成し、必要な権限を付与する。

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- expense_app ロール作成（存在しない場合のみ）
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'expense_app') THEN
            CREATE ROLE expense_app WITH LOGIN PASSWORD 'localdev';
        END IF;
    END
    \$\$;

    -- スキーマ権限付与
    GRANT USAGE ON SCHEMA public TO expense_app;

    -- 既存テーブルへの権限付与
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;

    -- 将来作成されるテーブルへのデフォルト権限設定
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;
EOSQL
