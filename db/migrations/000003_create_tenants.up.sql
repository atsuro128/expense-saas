-- [TNT-001] テナント境界の基本単位
-- [AUTH-F01] サインアップ時にテナント（企業）を新規作成
CREATE TABLE tenants (
    tenant_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(200) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- [DAT-004]
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()   -- [DAT-004]
);

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [TNT-005] テナント間のデータ参照は一切不可
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON tenants
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_update ON tenants
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- INSERT / DELETE は業務用ロールでは不要（テナント作成はサインアップ時にオーナーロールで実行）
