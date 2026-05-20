#!/bin/bash
# EC2 user_data: Docker インストール + swap 設定 + シークレット配置
# §11 Q1 案B（EC2 上で docker build）採用時の雛形
# image_tag が空文字の場合: docker pull をスキップ（EC2 上でビルド）
# image_tag が非空の場合: docker pull <image_tag> を実行（案A/C の将来用）

set -e
exec > /var/log/user-data.log 2>&1

# ─────────────────────────────────────────
# swap 設定（t3.micro メモリ 1GB。docker build OOM 回避）
# ─────────────────────────────────────────
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# ─────────────────────────────────────────
# Docker インストール
# ─────────────────────────────────────────
dnf install -y docker git
systemctl enable --now docker

# ─────────────────────────────────────────
# シークレット・設定ファイル配置
# JWT 鍵と環境変数ファイルを /etc/expense-saas/ に root:600 で配置
# ─────────────────────────────────────────
mkdir -p /etc/expense-saas/keys
chmod 700 /etc/expense-saas

# JWT 秘密鍵（Terraform variable から user_data に展開）
cat > /etc/expense-saas/keys/private.pem <<'PRIVATE_KEY_EOF'
${jwt_private_key_pem}
PRIVATE_KEY_EOF
chmod 600 /etc/expense-saas/keys/private.pem

# JWT 公開鍵
cat > /etc/expense-saas/keys/public.pem <<'PUBLIC_KEY_EOF'
${jwt_public_key_pem}
PUBLIC_KEY_EOF
chmod 600 /etc/expense-saas/keys/public.pem

# アプリ環境変数（DATABASE_URL のプレースホルダを含む。
# 実際の RDS endpoint / DB パスワードは §5.7 の migration 完了後に手動で更新する）
# ※ expense_owner_db_password / expense_app_db_password の値はここでは書き出さない。
#   §5.7.3 Step 7 で ALTER ROLE + systemctl restart expense-saas 後に手動で /etc/expense-saas/app.env を更新する。
cat > /etc/expense-saas/app.env <<'APP_ENV_EOF'
PORT=8080
LOG_LEVEL=info
DATABASE_URL=postgres://expense_owner:CHANGEME_AFTER_MIGRATE@CHANGEME_RDS_HOST:5432/expense_saas?sslmode=require
APP_DATABASE_URL=postgres://expense_app:CHANGEME_AFTER_MIGRATE@CHANGEME_RDS_HOST:5432/expense_saas?sslmode=require
JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/public.pem
S3_BUCKET=CHANGEME_S3_BUCKET
AWS_REGION=ap-northeast-1
CORS_ALLOWED_ORIGINS=${cors_allowed_origins}
TRUSTED_PROXY_COUNT=${trusted_proxy_count}
APP_ENV_EOF
chmod 600 /etc/expense-saas/app.env

# ─────────────────────────────────────────
# systemd unit 配置（アプリ起動はシークレット設定完了後に手動で有効化）
# §11 Q1 案B: image_tag = "" の場合は docker build が必要なため、
# systemd の enable / start は手動で実施する（§5.6 参照）
# ─────────────────────────────────────────
cat > /etc/systemd/system/expense-saas.service <<'SYSTEMD_EOF'
[Unit]
Description=Expense SaaS API
After=docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f expense-saas
ExecStart=/usr/bin/docker run --name expense-saas \
  --env-file /etc/expense-saas/app.env \
  -v /etc/expense-saas/keys:/app/keys:ro \
  -p 8080:8080 \
  expense-saas:portfolio
ExecStop=/usr/bin/docker stop expense-saas

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
# image_tag が空の場合はビルドが必要なため自動起動しない
%{ if image_tag != "" ~}
# image_tag が指定された場合（案A/C）: docker pull して起動
docker pull "${image_tag}"
docker tag "${image_tag}" expense-saas:portfolio
systemctl enable --now expense-saas
%{ endif ~}

echo "user_data completed: $(date)"
