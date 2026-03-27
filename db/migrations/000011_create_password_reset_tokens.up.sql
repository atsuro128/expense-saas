-- [SEC-006] パスワードリセット: リセットトークン（1時間有効）を発行
-- [AUTH-F06] パスワードリセット
CREATE TABLE password_reset_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,                            -- トークンの SHA-256 ハッシュ
    expires_at TIMESTAMPTZ NOT NULL,                            -- [SEC-006] 1時間有効
    used_at    TIMESTAMPTZ,                                     -- [SEC-006] 1回使用で無効化
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()               -- [DAT-004]
);

-- RLS は適用しない（tenant_id がないため）
-- アクセスはパスワードリセットエンドポイント（expense_owner ロール）経由に限定される

-- [AUTH-F06] ユーザーのリセットトークン検索
CREATE INDEX idx_password_reset_tokens_user
    ON password_reset_tokens (user_id, created_at DESC);

-- [SEC-006] トークン検証時の検索（token_hash でのルックアップ、1回使用で無効化）
CREATE INDEX idx_password_reset_tokens_hash
    ON password_reset_tokens (token_hash)
    WHERE used_at IS NULL;

-- [SEC-006] 期限切れトークンの定期削除用
CREATE INDEX idx_password_reset_tokens_expires
    ON password_reset_tokens (expires_at)
    WHERE used_at IS NULL;
