# Terraform IaC — expense-saas portfolio 環境

チケット: `dev-journal/progress-management/tickets/step11/11-E-deploy.md`
対象環境: `portfolio`（ADR-0004 準拠。環境名を `prod` ではなく `portfolio` とする）

## 1. 前提条件

- Terraform >= 1.6 がローカルにインストール済み
  - Windows: `winget install HashiCorp.Terraform` または `scoop install terraform`（[Terraform 公式](https://developer.hashicorp.com/terraform/install) 参照）
  - Linux/macOS: [Terraform 公式インストール手順](https://developer.hashicorp.com/terraform/install) を参照
- AWS CLI が設定済み（`~/.aws/credentials` に `[expense-saas-portfolio]` プロファイル）
- IAM ユーザー `terraform-deployer`（AdministratorAccess）のアクセスキーが設定済み（Q4 確定）
- キーペア `expense-saas-portfolio.pem` が AWS コンソールで作成済み・ローカルに保存済み（chmod 400）
- JWT 鍵ペアが生成済み（下記 §6 参照）

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

## 3. Terraform init / plan / apply（USER が実施）

```bash
cd expense-saas/infra/terraform

# 初期化（backend が設定済みであること）
terraform init
# .terraform.lock.hcl が USER の Windows ホストで生成される。
# Phase 2-2 完了後に git add して PR にコミット推奨（HashiCorp ベストプラクティス）。

# tfvars 作成
cp terraform.tfvars.example terraform.tfvars
# エディタで編集: allowed_ssh_cidr 等を埋める

# sensitive 変数を環境変数で渡す（推奨）
export TF_VAR_db_password='<master_password>'
export TF_VAR_expense_owner_db_password='<owner_password>'
export TF_VAR_expense_app_db_password='<app_password>'
export TF_VAR_jwt_private_key_pem="$(cat /tmp/expense-saas-keys/private.pem)"
export TF_VAR_jwt_public_key_pem="$(cat /tmp/expense-saas-keys/public.pem)"
export TF_VAR_allowed_ssh_cidr="$(curl -s ifconfig.me)/32"

# 計画確認（必ず確認してから apply する）
terraform plan -out=tfplan

# apply（RDS 作成で 10-15 分かかる）
terraform apply tfplan

# 出力確認
terraform output
# alb_dns_name  = "expense-saas-portfolio-alb-xxxxxxxx.ap-northeast-1.elb.amazonaws.com"
# ec2_public_ip = "xx.xx.xx.xx"
# rds_endpoint  = (sensitive)
# s3_bucket_name = "expense-saas-portfolio-receipts-<s3_bucket_suffix>"
```

## 4. 既知の差分（env_config.md prod 仕様との乖離）

| 項目 | env_config.md prod | 本 portfolio 環境 | 理由 |
|------|-------------------|-------------------|------|
| TLS | ACM 証明書 + HTTPS 強制 | HTTP のみ（Q2 案1） | ポートフォリオ簡易構成。ALB DNS 直接使用 |
| シークレット管理 | Secrets Manager | Terraform variable + EC2 ファイル（`/etc/expense-saas/`） | Secrets Manager 無料枠外 |
| RDS | Multi-AZ 推奨 | Single-AZ（Q3） | 無料枠（750h/月）内に収めるため |
| S3 versioning | 無効（backup_restore.md §3.2 準拠） | 無効（F-117 上流追換） | MVP は誤削除復旧不可の設計方針に従う |
| S3_BUCKET 名 | `expense-saas-receipts-prod` 固定 | ランダムサフィックス付き | グローバル名前空間衝突回避（I-04） |

## 5. DB マイグレーション手順（チケット §5.7.3 c 案の完全手順）

apply 完了後、EC2 に SSH して以下を実施する。詳細手順は `11-E-deploy.md §5.7.3` を参照。

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

- 両ロールのパスワードを prod 値に上書き（000002 が `PASSWORD 'localdev'` で作成しているため必須）
- `GRANT CREATE, USAGE ON SCHEMA public TO expense_owner`（PostgreSQL 15+ で public への CREATE が制限されるため）
- `ALTER TABLE schema_migrations OWNER TO expense_owner`（Step 4 で expense_owner 接続から migrate 継続するために必須）

```bash
export PGPASSWORD="$MASTER_PW"
psql -h "$RDS_HOST" -U "$DB_MASTER_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
ALTER ROLE expense_owner WITH LOGIN PASSWORD '${OWNER_DB_PW}';
ALTER ROLE expense_app   WITH LOGIN PASSWORD '${APP_DB_PW}';

-- PG15+ 対応: expense_owner が public スキーマに CREATE TABLE できるよう権限付与
GRANT CREATE, USAGE ON SCHEMA public TO expense_owner;

-- schema_migrations の owner を expense_owner に移管（F-115 残課題）
ALTER TABLE schema_migrations OWNER TO expense_owner;

\du expense_owner
\du expense_app
\dt schema_migrations
SQL
unset PGPASSWORD

# ゲート確認: schema_migrations の tableowner が expense_owner であること
PGPASSWORD="$MASTER_PW" psql -h "$RDS_HOST" -U "$DB_MASTER_USER" -d "$DB_NAME" <<'SQL'
SELECT tablename, tableowner
  FROM pg_tables
 WHERE schemaname = 'public' AND tablename = 'schema_migrations';
-- expected: tableowner = expense_owner
SQL
```

### Step 3: expense_owner 接続で default privileges を仕込む（F-118 一次対策）

000002 のマスター実行版 `ALTER DEFAULT PRIVILEGES` は expense_owner が作成するテーブルには効かない（PostgreSQL 仕様）。
003 以降の migrate（CREATE TABLE）前に投入することで、expense_app への DML が自動付与される。

```bash
export PGPASSWORD="$OWNER_DB_PW"
psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
ALTER DEFAULT PRIVILEGES FOR ROLE expense_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO expense_app;

-- シーケンスは MVP では未使用（全テーブル UUID 主キー）だが将来用保険として追加
ALTER DEFAULT PRIVILEGES FOR ROLE expense_owner IN SCHEMA public
    GRANT USAGE ON SEQUENCES TO expense_app;

\ddp
SQL
unset PGPASSWORD
```

### Step 4: expense_owner で残り migration（000003 以降）を実行

これにより 000003〜最終の全テーブル owner が expense_owner になり、Step 3 の default privileges 経由で expense_app への DML も自動付与される。

```bash
export MIGRATE_DB_URL_OWNER="postgres://expense_owner:${OWNER_DB_PW}@${RDS_HOST}:5432/${DB_NAME}?sslmode=require"
migrate -path db/migrations -database "$MIGRATE_DB_URL_OWNER" up

# ゲート確認: 最終バージョン到達 / 全テーブル owner = expense_owner
PGPASSWORD="$OWNER_DB_PW" psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" \
  -c 'SELECT version, dirty FROM schema_migrations;'
PGPASSWORD="$OWNER_DB_PW" psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" <<'SQL'
SELECT schemaname, tablename, tableowner
  FROM pg_tables
 WHERE schemaname = 'public'
 ORDER BY tablename;
-- expected: 全行 tableowner = expense_owner（schema_migrations を含む）
SQL
```

### Step 5（保険）: expense_owner で既存テーブルへの明示 GRANT（F-118 二重ガード）

Step 3 が漏れた場合でも埋まるよう、本番 9 テーブル全件に expense_app の DML を明示付与する。

```bash
export PGPASSWORD="$OWNER_DB_PW"
psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO expense_app;  -- 現在は対象 0 件、将来用保険

-- ゲート確認: tenants テーブルへの 4 種権限が expense_app に付与されているか
SELECT grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name = 'tenants'
   AND grantee = 'expense_app'
 ORDER BY privilege_type;
-- expected: SELECT / INSERT / UPDATE / DELETE の 4 行
SQL
unset PGPASSWORD
```

### Step 6（疎通確認）: 両ロールの接続確認と DML 権限の実地検証（F-119 対応 2 段階）

```bash
PGPASSWORD="$OWNER_DB_PW" psql -h "$RDS_HOST" -U expense_owner -d "$DB_NAME" -c 'SELECT 1;'
PGPASSWORD="$APP_DB_PW"   psql -h "$RDS_HOST" -U expense_app   -d "$DB_NAME" -c 'SELECT 1;'

# (a) メタデータ検証: has_table_privilege() で 9 テーブル × 4 権限を確認
#     RLS 非依存のため tenant context なしで安全に検証できる
PGPASSWORD="$APP_DB_PW" psql -h "$RDS_HOST" -U expense_app -d "$DB_NAME" <<'SQL'
SELECT
    table_name,
    has_table_privilege('expense_app', 'public.' || table_name, 'SELECT') AS has_select,
    has_table_privilege('expense_app', 'public.' || table_name, 'INSERT') AS has_insert,
    has_table_privilege('expense_app', 'public.' || table_name, 'UPDATE') AS has_update,
    has_table_privilege('expense_app', 'public.' || table_name, 'DELETE') AS has_delete
FROM (VALUES
    ('tenants'), ('tenant_memberships'), ('categories'),
    ('users'), ('expense_reports'), ('expense_items'), ('attachments'),
    ('refresh_tokens'), ('password_reset_tokens')
) AS t(table_name)
ORDER BY table_name;
-- 全 9 テーブルで全列が t（true）であること。f が 1 つでもあれば Step 3 / Step 5 を再実行
SQL

# (b) ライブ実地検証: RLS 非対象の users への live SELECT
#     users / refresh_tokens / password_reset_tokens は RLS 非対象（tenant_id 持たず）
#     tenant context 未設定でも SELECT が成立するため false negative にならない
PGPASSWORD="$APP_DB_PW" psql -h "$RDS_HOST" -U expense_app -d "$DB_NAME" -c 'SELECT count(*) FROM users;'
# 0 行（seed 前）が返ること。permission denied が出たら工程失敗
```

### Step 7: terraform.tfvars / app.env を実値で更新してアプリ再起動

```bash
# terraform.tfvars の DATABASE_URL / APP_DATABASE_URL を確定値に更新後:
sudo systemctl restart expense-saas
```

## 6. JWT 鍵ペア生成

```bash
mkdir -p /tmp/expense-saas-keys
openssl genrsa -out /tmp/expense-saas-keys/private.pem 2048
openssl rsa -in /tmp/expense-saas-keys/private.pem -pubout -out /tmp/expense-saas-keys/public.pem
```

## 7. Docker イメージ配布（Q1 案B: EC2 上でビルド）

```bash
ssh -i ~/.ssh/expense-saas-portfolio.pem ec2-user@<ec2_public_ip>

# git clone して docker build
sudo dnf install -y git
git clone https://github.com/<user>/expense-saas.git ~/expense-saas
cd ~/expense-saas
sudo docker build -t expense-saas:portfolio .

# systemd で起動
sudo systemctl enable --now expense-saas
```

## 8. ヘルスチェック確認

```bash
# ALB 経由
curl -i http://<alb_dns_name>/health
# 期待: HTTP/1.1 200 OK, {"status":"ok",...}
```

## 9. terraform destroy（UAT 終了後、費用節約のため）

Q5 確定値: 13 ヶ月目以降に terraform destroy で全リソースを削除する。

```bash
cd expense-saas/infra/terraform
terraform destroy
```

ALB が最大支出ドライバ（無料枠終了後 ~$20/月恒常）のため、UAT 期間が終わったら速やかに destroy すること。
