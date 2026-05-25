# Terraform IaC — expense-saas portfolio 環境

チケット: `dev-journal/progress-management/tickets/step11/11-E-deploy.md`
対象環境: `portfolio`（ADR-0004 準拠。環境名を `prod` ではなく `portfolio` とする）

## 1. 前提条件

- Terraform >= 1.6 がローカルにインストール済み
  - Windows: `winget install HashiCorp.Terraform` または `scoop install terraform`（[Terraform 公式](https://developer.hashicorp.com/terraform/install) 参照）
  - Linux/macOS: [Terraform 公式インストール手順](https://developer.hashicorp.com/terraform/install) を参照
- AWS CLI が設定済み（`~/.aws/credentials` に `[expense-saas-portfolio]` プロファイル）
- IAM ユーザー `terraform-deployer`（AdministratorAccess）のアクセスキーが設定済み（Q4 確定）
- SSM Parameter Store に 4 件のパラメータが手動投入済み（**apply 前に必ず実施。§6 参照**）
  - `/expense-saas/portfolio/database/url`
  - `/expense-saas/portfolio/database/app_url`
  - `/expense-saas/portfolio/jwt/private_key`
  - `/expense-saas/portfolio/jwt/public_key`

> **注**: SSH キーペア（`expense-saas-portfolio.pem`）は issue #187 で廃止済み。EC2 接続は SSM Session Manager を使用する（§7 参照）。

## 2. Terraform state バックエンド初期化（一回限り、USER が実施）

S3 バケットと DynamoDB テーブルは chicken-and-egg 問題のため Terraform 外で事前作成が必要。

```bash
export AWS_PROFILE=expense-saas-portfolio

# S3 state バケット作成（ランダムサフィックスで一意化）
SUFFIX=$(openssl rand -hex 4)
aws s3api create-bucket \
  --bucket "expense-saas-tfstate-${SUFFIX}" \
  --region ap-northeast-1 \
  --create-bucket-configuration LocationConstraint=ap-northeast-1

# state バケットには versioning を有効化（領収書バケットとは別物。F-117 の対象外）
aws s3api put-bucket-versioning \
  --bucket "expense-saas-tfstate-${SUFFIX}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "expense-saas-tfstate-${SUFFIX}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# DynamoDB lock テーブル作成
aws dynamodb create-table \
  --table-name expense-saas-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1

echo "State bucket: expense-saas-tfstate-${SUFFIX}"
echo "Lock table:   expense-saas-tflock"
```

`backend.tf` の `bucket` を上で作成したバケット名に書き換える（または `-backend-config=bucket=...` で渡す）。

## 3. SSM Parameter Store への事前投入（apply 前に必須）

EC2 起動時の user_data が SSM から 4 件のパラメータを取得する。**terraform apply の前に必ずこの手順を完了すること**。投入前に apply すると user_data の `aws ssm get-parameters` が失敗し EC2 が起動不可になる。

```bash
export AWS_PROFILE=expense-saas-portfolio

# DATABASE_URL（オーナーロール）
aws ssm put-parameter \
  --name "/expense-saas/portfolio/database/url" \
  --type SecureString \
  --key-id alias/aws/ssm \
  --value "postgres://expense_owner:<password>@<rds-endpoint>:5432/expense_saas?sslmode=require" \
  --region ap-northeast-1

# APP_DATABASE_URL（アプリロール）
aws ssm put-parameter \
  --name "/expense-saas/portfolio/database/app_url" \
  --type SecureString \
  --key-id alias/aws/ssm \
  --value "postgres://expense_app:<password>@<rds-endpoint>:5432/expense_saas?sslmode=require" \
  --region ap-northeast-1

# JWT 秘密鍵（PEM 全文）
aws ssm put-parameter \
  --name "/expense-saas/portfolio/jwt/private_key" \
  --type SecureString \
  --key-id alias/aws/ssm \
  --value "$(cat /path/to/private.pem)" \
  --region ap-northeast-1

# JWT 公開鍵（PEM 全文）
aws ssm put-parameter \
  --name "/expense-saas/portfolio/jwt/public_key" \
  --type SecureString \
  --key-id alias/aws/ssm \
  --value "$(cat /path/to/public.pem)" \
  --region ap-northeast-1
```

投入確認:

```bash
aws ssm describe-parameters \
  --parameter-filters "Key=Path,Option=Recursive,Values=/expense-saas/portfolio" \
  --region ap-northeast-1 \
  --query 'Parameters[].Name'
# 期待: 4 件すべて表示される
```

## 4. Terraform init / plan / apply（USER が実施）

```bash
cd expense-saas/infra/terraform

# 初期化（backend が設定済みであること）
terraform init

# tfvars 作成
cp terraform.tfvars.example terraform.tfvars
# エディタで編集: cors_allowed_origins / s3_bucket_suffix 等を埋める

# sensitive 変数を環境変数で渡す（推奨）
export TF_VAR_db_password='<master_password>'
export TF_VAR_expense_owner_db_password='<owner_password>'
export TF_VAR_expense_app_db_password='<app_password>'
export TF_VAR_cloudfront_origin_verify_secret='<secret>'

# 計画確認（必ず確認してから apply する）
terraform plan -out=tfplan

# apply（RDS 作成で 10-15 分かかる）
terraform apply tfplan

# 出力確認
terraform output
# alb_dns_name      = "expense-saas-portfolio-alb-xxxxxxxx.ap-northeast-1.elb.amazonaws.com"
# cloudfront_domain_name = "xxxxxxxxxx.cloudfront.net"
# ec2_public_ip     = "xx.xx.xx.xx"
# ec2_instance_id   = "i-xxxxxxxxxxxxxxxxx"  ← SSM Session Manager 接続時に使用
# rds_endpoint      = (sensitive)
# s3_bucket_name    = "expense-saas-portfolio-receipts-<s3_bucket_suffix>"
```

## IAM ポリシー補足

**`kms:Decrypt` は明示ポリシー不要（B-05）**

EC2 が SSM Parameter Store の SecureString を復号する際に使用する AWS マネージドキー
`alias/aws/ssm` は、`ssm:GetParameters` を呼び出した時点でデフォルト grant が自動付与される。
alias ARN は KMS の IAM ポリシーで key 操作（`kms:Decrypt` 等）の Resource に使用できず、
alias 操作（CreateAlias/UpdateAlias 等）にしか適用されない。
そのため `aws_iam_role_policy.ec2_kms_decrypt` は削除し、自動 grant に依存している。

## 5. 既知の差分（env_config.md prod 仕様との乖離）

| 項目 | env_config.md prod | 本 portfolio 環境 | 理由 |
|------|-------------------|-------------------|------|
| TLS | ACM 証明書 + HTTPS 強制 | CloudFront デフォルト証明書（ADR-0007、issue #185 C 案） | ポートフォリオ簡易構成 |
| RDS | Multi-AZ 推奨 | Single-AZ（Q3） | 無料枠（750h/月）内に収めるため |
| S3 versioning | 無効（backup_restore.md §3.2 準拠） | 無効（F-117 上流追換） | MVP は誤削除復旧不可の設計方針に従う |
| S3_BUCKET 名 | `expense-saas-receipts-prod` 固定 | ランダムサフィックス付き | グローバル名前空間衝突回避（I-04） |
| SSM IAM Resource | `/expense-saas/<env>/*`（env_config.md §5.3.5 prod 固定） | `/expense-saas/*`（全 env 共通） | env 追加時の IAM 修正不要を優先（§2.1 差分注記） |

## 6. JWT 鍵ペア生成

```bash
mkdir -p /tmp/expense-saas-keys
openssl genrsa -out /tmp/expense-saas-keys/private.pem 2048
openssl rsa -in /tmp/expense-saas-keys/private.pem -pubout -out /tmp/expense-saas-keys/public.pem
```

生成後は §3 の手順で SSM Parameter Store に投入する。ローカルファイルは Terraform 変数として渡す必要はない（issue #187 P-0=A で jwt_*_pem 変数を削除済み）。

## 7. EC2 への接続（SSM Session Manager 経由）

SSH 接続は廃止済み（issue #187 / issue #186 UD-1=A）。EC2 への接続は SSM Session Manager を使用する。

```bash
# ec2_instance_id は terraform output ec2_instance_id で確認
aws ssm start-session \
  --target i-xxxxxxxxxxxxxxxxx \
  --region ap-northeast-1 \
  --profile expense-saas-portfolio
```

接続後の操作例:

```bash
# EC2 内で実行
# user_data ログ確認
sudo cat /var/log/user-data.log

# app.env の内容確認（DB URL 等が SSM から正しく取得されているか）
sudo cat /etc/expense-saas/app.env

# systemd サービス状態確認
sudo systemctl status expense-saas
```

## 8. DB マイグレーション手順（チケット §5.7.3 c 案の完全手順）

apply 完了後、EC2 に SSM Session Manager で接続して以下を実施する。詳細手順は `11-E-deploy.md §5.7.3` を参照。

### 事前準備（EC2 上）

```bash
sudo dnf install -y postgresql16
GOMIG_VER=v4.17.0
curl -L https://github.com/golang-migrate/migrate/releases/download/${GOMIG_VER}/migrate.linux-amd64.tar.gz \
  | tar xz
sudo mv migrate /usr/local/bin/

# パスワードを export（履歴に残らないよう read -s を使う）
read -s -p "OWNER_DB_PW: " OWNER_DB_PW; echo
read -s -p "APP_DB_PW:   " APP_DB_PW;   echo
read -s -p "MASTER_PW:   " MASTER_PW;   echo

RDS_HOST="<rds-endpoint>"      # terraform output rds_endpoint で確認
DB_NAME="expense_saas"
DB_MASTER_USER="postgres"      # tfvar db_master_user の既定値

cd ~/expense-saas
```

### Step 1: 000001 / 000002 のみマスターで実行

RDS マスターユーザーで 000001（CREATE EXTENSION pgcrypto）と 000002（CREATE ROLE）のみ進める。
superuser 権限が必須のため expense_owner では実行不可。この時点で `schema_migrations` がマスター owner として作成される。

```bash
export MIGRATE_DB_URL_MASTER="postgres://${DB_MASTER_USER}:${MASTER_PW}@${RDS_HOST}:5432/${DB_NAME}?sslmode=require"
migrate -path db/migrations -database "$MIGRATE_DB_URL_MASTER" up 2

# ゲート確認: version=2 / dirty=false であること
PGPASSWORD="$MASTER_PW" psql -h "$RDS_HOST" -U "$DB_MASTER_USER" -d "$DB_NAME" \
  -c 'SELECT version, dirty FROM schema_migrations;'
```

### Step 2: マスターでロール / スキーマ権限 / 管理テーブル owner を整備

```bash
export PGPASSWORD="$MASTER_PW"
psql -h "$RDS_HOST" -U "$DB_MASTER_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
ALTER ROLE expense_owner WITH LOGIN PASSWORD '${OWNER_DB_PW}';
ALTER ROLE expense_app   WITH LOGIN PASSWORD '${APP_DB_PW}';
GRANT CREATE, USAGE ON SCHEMA public TO expense_owner;
ALTER TABLE schema_migrations OWNER TO expense_owner;
\du expense_owner
\du expense_app
\dt schema_migrations
SQL
unset PGPASSWORD
```

### Step 3: expense_owner 接続で default privileges を仕込む（F-118 一次対策）

```bash
export PGPASSWORD="$OWNER_DB_PW"
psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER DEFAULT PRIVILEGES FOR ROLE expense_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;
ALTER DEFAULT PRIVILEGES FOR ROLE expense_owner IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO expense_app;
\ddp
SQL
unset PGPASSWORD
```

### Step 4: expense_owner で残り migration（000003 以降）を実行

```bash
export MIGRATE_DB_URL_OWNER="postgres://expense_owner:${OWNER_DB_PW}@${RDS_HOST}:5432/${DB_NAME}?sslmode=require"
migrate -path db/migrations -database "$MIGRATE_DB_URL_OWNER" up

# ゲート確認
PGPASSWORD="$OWNER_DB_PW" psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" \
  -c 'SELECT version, dirty FROM schema_migrations;'
```

### Step 5（保険）: expense_owner で既存テーブルへの明示 GRANT（F-118 二重ガード）

```bash
export PGPASSWORD="$OWNER_DB_PW"
psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO expense_app;
SQL
unset PGPASSWORD
```

### Step 6（疎通確認）

```bash
PGPASSWORD="$OWNER_DB_PW" psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -c 'SELECT 1;'
PGPASSWORD="$APP_DB_PW"   psql -h "$RDS_HOST" -U expense_app   -d "$DB_NAME" -c 'SELECT 1;'
```

## 9. Docker イメージ配布（Q1 案B: EC2 上でビルド）

```bash
# SSM Session Manager で EC2 に接続
aws ssm start-session --target i-xxxxxxxxxxxxxxxxx --region ap-northeast-1

# EC2 上で実行（git は user_data で install 済み）
sudo dnf install -y git
git clone https://github.com/<user>/expense-saas.git ~/expense-saas
cd ~/expense-saas
sudo docker build -t expense-saas:portfolio .
sudo systemctl enable --now expense-saas
```

## 10. ヘルスチェック確認

```bash
# CloudFront 経由（issue #185 C 案: PR #151 以降は CloudFront 経由でアクセスする）
# alb_dns_name への直アクセスは ALB リスナーのデフォルトアクションで 403 になる
curl -i https://<cloudfront_domain_name>/health
# 期待: HTTP/2 200, {"status":"ok",...}
# cloudfront_domain_name は `terraform output cloudfront_domain_name` で確認する
```

## 11. terraform destroy（UAT 終了後、費用節約のため）

Q5 確定値: 13 ヶ月目以降に terraform destroy で全リソースを削除する。

```bash
cd expense-saas/infra/terraform
terraform destroy
```

ALB が最大支出ドライバ（無料枠終了後 ~$20/月恒常）のため、UAT 期間が終わったら速やかに destroy すること。
