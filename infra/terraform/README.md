# Terraform IaC — expense-saas portfolio 環境

チケット: `dev-journal/progress-management/tickets/step11/11-E-deploy.md`
対象環境: `portfolio`（ADR-0004 準拠。環境名を `prod` ではなく `portfolio` とする）

## 1. 前提条件

- Terraform >= 1.6 がローカルにインストール済み
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
| S3 versioning | 無効（backup_restore.md §3.2 準拠） | 無効（F-117 上流追従） | MVP は誤削除復旧不可の設計方針に従う |
| S3_BUCKET 名 | `expense-saas-receipts-prod` 固定 | ランダムサフィックス付き | グローバル名前空間衝突回避（I-04） |

## 5. DB マイグレーション手順（チケット §5.7 の要約）

apply 完了後、EC2 に SSH して以下を実施する。詳細手順は `11-E-deploy.md §5.7.3` を参照。

1. golang-migrate と psql を EC2 にインストール
2. `migrate up 2`（RDS マスターユーザーで 000001/000002 のみ実行）
3. `ALTER ROLE expense_owner/expense_app WITH PASSWORD '...'`（prod パスワードで上書き）
4. `ALTER TABLE schema_migrations OWNER TO expense_owner`
5. `migrate up`（expense_owner で 000003 以降を実行）
6. `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO expense_app`

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
