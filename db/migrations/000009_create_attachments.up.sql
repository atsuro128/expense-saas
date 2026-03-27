-- [ATT-F01] ファイルアップロード（メタデータ管理）
-- [ATT-001] 添付ファイルは経費明細に紐づく
-- [ATT-005] ファイルは S3、メタデータは DB に保存
CREATE TABLE attachments (
    attachment_id UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID         NOT NULL REFERENCES expense_items(item_id),      -- [ATT-001] 所属明細
    report_id     UUID         NOT NULL REFERENCES expense_reports(report_id),   -- 冗長保持
    tenant_id     UUID         NOT NULL REFERENCES tenants(tenant_id),           -- [TNT-001] テナント分離（冗長保持: RLS + S3パス）
    file_name     VARCHAR(255) NOT NULL,
    file_size     INTEGER      NOT NULL,                                         -- [ATT-003] サイズ上限 5MB
    mime_type     VARCHAR(50)  NOT NULL,                                         -- [ATT-013] MIMEタイプ検証
    s3_key        VARCHAR(500) NOT NULL,                                         -- [ATT-014] S3パスにテナントIDを含む
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),                           -- [DAT-004]
    deleted_at    TIMESTAMPTZ,                                                   -- [DAT-002] 論理削除

    -- [ATT-003] 1ファイルのサイズ上限: 5MB (5 * 1024 * 1024 = 5242880)
    CONSTRAINT attachments_file_size_check
        CHECK (file_size > 0 AND file_size <= 5242880),

    -- [ATT-002] 許可するファイル形式: JPEG, PNG, PDF
    CONSTRAINT attachments_mime_type_check
        CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf'))
);

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [TNT-005] テナント間のデータ参照は一切不可
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON attachments
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_insert ON attachments
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_delete ON attachments
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- [DAT-002] 論理削除（deleted_at の設定）用。データ更新ではなく削除フラグの設定に限定
CREATE POLICY tenant_isolation_update ON attachments
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

-- [ATT-F02] 明細に属する添付ファイル一覧取得
CREATE INDEX idx_attachments_item
    ON attachments (tenant_id, item_id)
    WHERE deleted_at IS NULL;

-- [RPT-F03] レポート詳細取得時の全添付一覧
CREATE INDEX idx_attachments_report
    ON attachments (tenant_id, report_id)
    WHERE deleted_at IS NULL;
