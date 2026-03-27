-- [ITM-005] カテゴリは固定6種類（MVP）。Phase 3 でカスタムカテゴリに拡張
-- [ITM-003] 明細にはカテゴリが必須（本テーブルがマスタ）
CREATE TABLE categories (
    category_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID        REFERENCES tenants(tenant_id),  -- NULL = グローバル（システム定義）
    code        VARCHAR(50) NOT NULL,
    name_ja     VARCHAR(100) NOT NULL,
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),   -- [DAT-004]
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()    -- [DAT-004]
);

-- [ITM-005] グローバルカテゴリの一意性（tenant_id IS NULL）
CREATE UNIQUE INDEX categories_global_code_unique
    ON categories (code) WHERE tenant_id IS NULL;

-- テナント固有カテゴリの一意性（Phase 3）
CREATE UNIQUE INDEX categories_tenant_code_unique
    ON categories (tenant_id, code) WHERE tenant_id IS NOT NULL;

-- [TNT-004] RLS でアプリ層の保証を二重化
-- [ITM-005] グローバルカテゴリ（tenant_id IS NULL）は全テナントから参照可能
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- グローバルカテゴリ（tenant_id IS NULL）は全テナントから参照可能
-- テナント固有カテゴリ（Phase 3）は自テナントのみ
CREATE POLICY categories_select ON categories
    FOR SELECT
    USING (
        tenant_id IS NULL
        OR tenant_id = current_setting('app.current_tenant')::uuid
    );

-- INSERT / UPDATE / DELETE は Phase 3 でテナント固有カテゴリ用に追加

-- [ITM-005] カテゴリ一覧取得（テナント固有 + グローバル）
CREATE INDEX idx_categories_tenant_active
    ON categories (tenant_id, is_active, sort_order);

-- [ITM-005] MVP の固定6カテゴリをシードデータとして投入
INSERT INTO categories (category_id, tenant_id, code, name_ja, sort_order, is_active) VALUES
    (gen_random_uuid(), NULL, 'transportation',  '交通費',   1, true),
    (gen_random_uuid(), NULL, 'accommodation',   '宿泊費',   2, true),
    (gen_random_uuid(), NULL, 'food',             '飲食費',   3, true),
    (gen_random_uuid(), NULL, 'supplies',         '消耗品費', 4, true),
    (gen_random_uuid(), NULL, 'communication',    '通信費',   5, true),
    (gen_random_uuid(), NULL, 'other',            'その他',   6, true);
