-- デフォルト権限の取り消し
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM expense_app;

-- expense_app の権限取り消し
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM expense_app;
REVOKE USAGE ON SCHEMA public FROM expense_app;

-- ロール削除
DROP ROLE IF EXISTS expense_app;
DROP ROLE IF EXISTS expense_owner;
