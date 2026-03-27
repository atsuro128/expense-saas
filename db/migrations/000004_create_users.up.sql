-- [AUTH-F01] サインアップ時にアカウント作成
-- [SEC-001] 認証方式はメール + パスワード
CREATE TABLE users (
    user_id       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(254) NOT NULL,                -- [SEC-001] メールアドレスによる認証
    name          VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,                -- [SEC-002] Argon2id ハッシュ
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),   -- [DAT-004]
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),   -- [DAT-004]

    CONSTRAINT users_email_unique UNIQUE (email)        -- システム全体で一意
);

-- RLS は適用しない（tenant_id がないため）
-- ユーザー情報へのアクセスは tenant_memberships の RLS を介して間接的に制御する
