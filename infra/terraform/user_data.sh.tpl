#!/bin/bash
# EC2 user_data: SSM Parameter Store からシークレット取得 + Docker + systemd 設定
# issue #187: SSH 廃止 + SSM Session Manager 接続 + SSM Parameter Store SecureString 移行
# B-03 対策（防御 2 段）:
#   (1) /var/log/user-data.log を最初に 0600 root:root で touch して permission を絞る
#       （cloud-init のデフォルト 0644 を上書き）
#   (2) 機密フェッチ・書き出し区間のみ /dev/null にリダイレクトし、平文出力を残さない
set -euo pipefail

install -m 0600 -o root -g root /dev/null /var/log/user-data.log
exec > /var/log/user-data.log 2>&1

ENV_NAME="${environment}"
REGION="${aws_region}"
PARAM_PREFIX="${ssm_parameter_path_prefix}"
SECRET_DIR="/etc/expense-saas"
KEY_DIR="$${SECRET_DIR}/keys"

# 1. swap 設定（t3.micro OOM 回避）
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2. Docker / jq インストール
#    jq は SSM SecureString（PEM 多行値含む）の JSON parse に必須（B-01=案a）
#    git は user_data 内で使用しないため削除（I-01 対応）
#    SSM Agent は Amazon Linux 2023 にプリインストール済み（追加 install 不要）
dnf install -y docker jq
systemctl enable --now docker
# SSM Agent を明示 enable（idempotent。AL2023 デフォルト有効だが環境差吸収のため明示）
systemctl enable --now amazon-ssm-agent

# 3. ディレクトリ準備
mkdir -p "$${KEY_DIR}"
chmod 750 "$${SECRET_DIR}" "$${KEY_DIR}"
getent group appgroup >/dev/null || groupadd -r appgroup

# 4. SSM Parameter Store から SecureString を一括取得（KMS 復号付き）
#    --output json + jq -r でパラメータ取得（B-01=案a: PEM 多行値を無傷で取り出せる）
#    fail-fast: aws ssm 取得失敗時は set -e で user_data 全体が失敗する
#    B-03 対策: 機密値が PARAMS / KEY 変数に乗る区間は /dev/null にリダイレクトし
#               万一 set -x が混入しても /var/log/user-data.log に平文が残らないようにする
exec 3>&1 4>&2
exec > /dev/null 2>&1

PARAMS=$(aws ssm get-parameters \
  --names \
    "$${PARAM_PREFIX}/$${ENV_NAME}/database/url" \
    "$${PARAM_PREFIX}/$${ENV_NAME}/database/app_url" \
    "$${PARAM_PREFIX}/$${ENV_NAME}/jwt/private_key" \
    "$${PARAM_PREFIX}/$${ENV_NAME}/jwt/public_key" \
  --with-decryption \
  --region "$${REGION}" \
  --output json)

# jq で Name -> Value を引く（PEM の改行を含む多行 SecureString も無傷で取り出せる）
get_param() {
  printf '%s' "$${PARAMS}" | jq -r --arg n "$1" '.Parameters[] | select(.Name == $n) | .Value'
}

DATABASE_URL=$(get_param "$${PARAM_PREFIX}/$${ENV_NAME}/database/url")
APP_DATABASE_URL=$(get_param "$${PARAM_PREFIX}/$${ENV_NAME}/database/app_url")
JWT_PRIVATE_KEY=$(get_param "$${PARAM_PREFIX}/$${ENV_NAME}/jwt/private_key")
JWT_PUBLIC_KEY=$(get_param "$${PARAM_PREFIX}/$${ENV_NAME}/jwt/public_key")

# 5. 取得値の空判定（I-02 対応: get_param 直後、ファイル書き出し前に実施）
missing=()
for v in DATABASE_URL APP_DATABASE_URL JWT_PRIVATE_KEY JWT_PUBLIC_KEY; do
  if [ -z "$${!v}" ]; then
    missing+=("$${v}")
  fi
done

# 6. JWT 鍵ペアをファイルに書き出し（PEM の多行は printf '%s\n' で完全保持）
printf '%s\n' "$${JWT_PRIVATE_KEY}" > "$${KEY_DIR}/private.pem"
printf '%s\n' "$${JWT_PUBLIC_KEY}"  > "$${KEY_DIR}/public.pem"
chmod 600 "$${KEY_DIR}"/*.pem
chown root:appgroup "$${KEY_DIR}"/*.pem

# 7. /etc/expense-saas/app.env を生成（systemd EnvironmentFile）
#    CORS / TRUSTED_PROXY_COUNT は非機密のため Terraform variable から直接埋め込み（P-6=B）
cat > "$${SECRET_DIR}/app.env" <<EOF
PORT=8080
LOG_LEVEL=info
DATABASE_URL=$${DATABASE_URL}
APP_DATABASE_URL=$${APP_DATABASE_URL}
JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/public.pem
S3_BUCKET=expense-saas-receipts-$${ENV_NAME}
AWS_REGION=$${REGION}
CORS_ALLOWED_ORIGINS=${cors_allowed_origins}
TRUSTED_PROXY_COUNT=${trusted_proxy_count}
EOF
chmod 640 "$${SECRET_DIR}/app.env"
chown root:appgroup "$${SECRET_DIR}/app.env"

# 8. 機密値を環境からクリア
unset PARAMS DATABASE_URL APP_DATABASE_URL JWT_PRIVATE_KEY JWT_PUBLIC_KEY

# 9. ログ出力を /var/log/user-data.log に復帰（機密区間終了）
exec 1>&3 2>&4
exec 3>&- 4>&-

# fail-fast のエラー出力は復帰後の log に書き出す
if [ "$${#missing[@]}" -gt 0 ]; then
  echo "ERROR: SSM parameter(s) empty: $${missing[*]}" >&2
  exit 1
fi

# 10. systemd unit 配置
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
%{ if image_tag != "" ~}
docker pull "${image_tag}"
docker tag "${image_tag}" expense-saas:portfolio
systemctl enable --now expense-saas
%{ endif ~}

echo "user_data completed: $(date)"
