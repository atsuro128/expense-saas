-- [RPT-F01] 経費レポートの作成・管理
-- [RPT-005] レポートは必ず1つのテナントに属する
-- [WFL-001] 状態遷移はドメイン層で一元管理
CREATE TABLE expense_reports (
    report_id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id            UUID         NOT NULL REFERENCES tenants(tenant_id),   -- [TNT-001] テナント分離
    user_id              UUID         NOT NULL REFERENCES users(user_id),       -- [RPT-004] 作成者に紐づく
    title                VARCHAR(200) NOT NULL,                                 -- [RPT-001] タイトル必須
    period_start         DATE         NOT NULL,                                 -- [RPT-002] 対象期間必須
    period_end           DATE         NOT NULL,                                 -- [RPT-002] 対象期間必須
    status               VARCHAR(20)  NOT NULL DEFAULT 'draft',                 -- [WFL-001] 状態遷移はドメイン層で一元管理
    total_amount         INTEGER      NOT NULL DEFAULT 0,                       -- [RPT-006] 明細の合計から自動計算
    reference_report_id  UUID         REFERENCES expense_reports(report_id),    -- [RPT-016] 再申請元レポートへの参照
    submitted_by         UUID         REFERENCES users(user_id),                -- [WFL-010] 提出者
    submitted_at         TIMESTAMPTZ,                                           -- [WFL-010] 提出日時
    approved_by          UUID         REFERENCES users(user_id),                -- [WFL-011] 承認者
    approved_at          TIMESTAMPTZ,                                           -- [WFL-011] 承認日時
    approval_comment     VARCHAR(1000),                                         -- [WFL-011] 承認コメント（任意）
    rejected_by          UUID         REFERENCES users(user_id),                -- [WFL-012] 却下者
    rejected_at          TIMESTAMPTZ,                                           -- [WFL-012] 却下日時
    rejection_reason     VARCHAR(1000),                                         -- [WFL-012] 却下理由（却下時必須）
    paid_by              UUID         REFERENCES users(user_id),                -- [WFL-013] 支払処理者
    paid_at              TIMESTAMPTZ,                                           -- [WFL-013] 支払完了日時
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),                   -- [DAT-004]
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),                   -- [DAT-004]
    deleted_at           TIMESTAMPTZ,                                           -- [DAT-002] 論理削除

    -- [WFL-002] 許可される遷移のみ実行可能（DB 層では値の範囲制約のみ）
    CONSTRAINT expense_reports_status_check
        CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'paid')),

    -- [RPT-003] 対象期間の開始日は終了日以前
    CONSTRAINT expense_reports_period_check
        CHECK (period_start <= period_end),

    -- [RPT-006] 合計金額は 0 以上
    CONSTRAINT expense_reports_total_amount_check
        CHECK (total_amount >= 0)
);

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [TNT-005] テナント間のデータ参照は一切不可
ALTER TABLE expense_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_select ON expense_reports
    FOR SELECT
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_insert ON expense_reports
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_update ON expense_reports
    FOR UPDATE
    USING (tenant_id = current_setting('app.current_tenant')::uuid)
    WITH CHECK (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation_delete ON expense_reports
    FOR DELETE
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- [RPT-F02] [RPT-F07] テナント内のレポート一覧（ステータス別、作成日時降順）
CREATE INDEX idx_expense_reports_tenant_status
    ON expense_reports (tenant_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

-- [RPT-F02] テナント内の特定ユーザーのレポート一覧（自分のレポート一覧）
CREATE INDEX idx_expense_reports_tenant_user
    ON expense_reports (tenant_id, user_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- [WFL-F04] 承認待ち一覧（Approver 向け: submitted 状態）
CREATE INDEX idx_expense_reports_tenant_submitted
    ON expense_reports (tenant_id, submitted_at DESC)
    WHERE status = 'submitted' AND deleted_at IS NULL;

-- [WFL-F05] 支払待ち一覧（Accounting 向け: approved 状態）
CREATE INDEX idx_expense_reports_tenant_approved
    ON expense_reports (tenant_id, approved_at DESC)
    WHERE status = 'approved' AND deleted_at IS NULL;

-- [DASH-005] ダッシュボード: 月別サマリー（N ヶ月分集計）
CREATE INDEX idx_expense_reports_tenant_period
    ON expense_reports (tenant_id, period_start, period_end)
    WHERE deleted_at IS NULL;

-- [DASH-005] ダッシュボード: 月別支出サマリー用（paid レポートの period_start 範囲検索）
CREATE INDEX idx_expense_reports_tenant_paid_period
    ON expense_reports (tenant_id, period_start)
    WHERE status = 'paid' AND deleted_at IS NULL;
