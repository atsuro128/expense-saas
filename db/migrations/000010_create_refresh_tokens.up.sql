-- [SEC-003] リフレッシュトークン有効期間: 7日
-- [SEC-005] ログアウト時にリフレッシュトークンを無効化
-- [AUTH-F03] トークンリフレッシュ / [AUTH-F04] ログアウト
CREATE TABLE refresh_tokens (
    jti        UUID        PRIMARY KEY,                         -- JWT の jti クレーム
    user_id    UUID        NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,                            -- JWT の SHA-256 ハッシュ
    is_revoked BOOLEAN     NOT NULL DEFAULT false,              -- [SEC-005] 無効化フラグ
    expires_at TIMESTAMPTZ NOT NULL,                            -- [SEC-003] 有効期限
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()               -- [DAT-004]
);

-- RLS は適用しない（tenant_id がないため）
-- アクセスは認証エンドポイント（expense_owner ロール）経由に限定される

-- [SEC-005] ユーザーの有効なリフレッシュトークン検索（ログアウト時の一括無効化）
CREATE INDEX idx_refresh_tokens_user
    ON refresh_tokens (user_id, is_revoked)
    WHERE is_revoked = false;

-- [SEC-003] 期限切れトークンの定期削除用
CREATE INDEX idx_refresh_tokens_expires
    ON refresh_tokens (expires_at)
    WHERE is_revoked = false;
