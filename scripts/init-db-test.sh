#!/bin/bash
set -e

# このスクリプトは docker-compose の db-test サービス初回起動時に
# /docker-entrypoint-initdb.d/ 経由で自動実行される。
# テスト用 expense_owner / expense_app ロールを作成し、必要な権限を付与する。

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- expense_owner ロール作成（RLS バイパス用）
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'expense_owner') THEN
            CREATE ROLE expense_owner WITH LOGIN PASSWORD 'testpass';
        END IF;
    END
    \$\$;

    -- expense_app ロール作成（業務用、RLS 適用）
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'expense_app') THEN
            CREATE ROLE expense_app WITH LOGIN PASSWORD 'testpass';
        END IF;
    END
    \$\$;

    -- expense_app への権限付与
    GRANT USAGE ON SCHEMA public TO expense_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;

    -- 将来作成されるテーブルへのデフォルト権限設定
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;

    -- expense_owner への全権限付与
    GRANT ALL PRIVILEGES ON DATABASE "$POSTGRES_DB" TO expense_owner;
    GRANT ALL PRIVILEGES ON SCHEMA public TO expense_owner;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT ALL PRIVILEGES ON TABLES TO expense_owner;
EOSQL
