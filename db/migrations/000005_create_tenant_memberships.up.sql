-- [RBC-002] 1ユーザーは1テナントにつき1つのロールのみ持つ
-- [TNT-001] ユーザーとテナントの関連を管理
CREATE TABLE tenant_memberships (
    tenant_id  UUID        NOT NULL REFERENCES tenants(tenant_id),
    user_id    UUID        NOT NULL REFERENCES users(user_id),
    role       VARCHAR(20) NOT NULL,                    -- [RBC-002] テナント内でのロール
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),      -- [DAT-004]
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),      -- [DAT-004]

    PRIMARY KEY (tenant_id, user_id),

    -- [RBC-002] MVP: 1 ユーザー = 1 テナント
    CONSTRAINT tenant_memberships_user_unique UNIQUE (user_id),

    -- [RBC-002] ロール値はドメインモデルの Role 値オブジェクトに対応
    CONSTRAINT tenant_memberships_role_check
        CHECK (role IN ('admin', 'approver', 'member', 'accounting'))
);

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [TNT-005] テナント間のデータ参照は一切不可
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON tenant_memberships
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_insert ON tenant_memberships
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_update ON tenant_memberships
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_delete ON tenant_memberships
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- [WFL-014] テナント内の Approver 存在確認（提出時の事前条件）
-- [RBC-002] テナント内のメンバー一覧（ロール別）
CREATE INDEX idx_tenant_memberships_role
    ON tenant_memberships (tenant_id, role);
