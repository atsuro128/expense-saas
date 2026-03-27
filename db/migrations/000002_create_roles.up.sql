-- [TNT-004] RLS を適用する業務用ロールとバイパス用オーナーロールの分離

-- expense_owner ロール作成（テーブルオーナー、RLS バイパス）
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'expense_owner') THEN
        CREATE ROLE expense_owner WITH LOGIN PASSWORD 'localdev';
    END IF;
END
$$;

-- expense_app ロール作成（業務用、RLS 適用）
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'expense_app') THEN
        CREATE ROLE expense_app WITH LOGIN PASSWORD 'localdev';
    END IF;
END
$$;

-- expense_app への権限付与
GRANT USAGE ON SCHEMA public TO expense_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;

-- 将来作成されるテーブルへのデフォルト権限設定
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;
