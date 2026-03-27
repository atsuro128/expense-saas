-- [ITM-F01] 経費明細の追加・管理
-- [ITM-006] 明細は必ず1つのレポートに属する
CREATE TABLE expense_items (
    item_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    UUID         NOT NULL REFERENCES expense_reports(report_id),   -- [ITM-006] 所属レポート
    tenant_id    UUID         NOT NULL REFERENCES tenants(tenant_id),           -- [TNT-001] テナント分離（冗長保持: RLS 効率）
    expense_date DATE         NOT NULL,                                         -- [ITM-001] 日付必須
    amount       INTEGER      NOT NULL,                                         -- [ITM-002] 金額必須（正の整数）
    category_id  UUID         NOT NULL REFERENCES categories(category_id),      -- [ITM-003] カテゴリ必須
    description  VARCHAR(500) NOT NULL,                                         -- [ITM-004] 摘要必須
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),                           -- [DAT-004]
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),                           -- [DAT-004]
    deleted_at   TIMESTAMPTZ,                                                   -- [DAT-002] 論理削除

    -- [ITM-002] 金額は正の整数
    CONSTRAINT expense_items_amount_check
        CHECK (amount > 0)
);

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [TNT-005] テナント間のデータ参照は一切不可
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON expense_items
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_insert ON expense_items
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_update ON expense_items
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_delete ON expense_items
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- [RPT-F03] レポート詳細取得時の明細一覧
CREATE INDEX idx_expense_items_report
    ON expense_items (tenant_id, report_id, expense_date)
    WHERE deleted_at IS NULL;
