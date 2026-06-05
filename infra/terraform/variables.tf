# §3.3 変数化すべき値（9 変数 + §5.7.2 追加変数）

variable "aws_region" {
  description = "AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "プロジェクト名（リソース名のプレフィックスに使用）"
  type        = string
  default     = "expense-saas"
}

variable "environment" {
  description = "環境名。env_config.md の prod は使わず portfolio とする（ADR-0004）"
  type        = string
  default     = "portfolio"
}

# key_pair_name / allowed_ssh_cidr は削除済み（issue #187 P-5=A）
# SSH 廃止（issue #186 UD-1=A）により不要。接続は SSM Session Manager 経由に移行

variable "db_password" {
  description = "RDS マスターユーザー（postgres）のパスワード"
  type        = string
  sensitive   = true
}

variable "db_master_user" {
  description = "RDS マスターユーザー名"
  type        = string
  default     = "postgres"
}

variable "expense_owner_db_password" {
  description = "expense_owner ロールの DB パスワード（migrate 後に RDS マスターユーザーで ALTER ROLE で投入）"
  type        = string
  sensitive   = true
}

variable "expense_app_db_password" {
  description = "expense_app ロールの DB パスワード（migrate 後に RDS マスターユーザーで ALTER ROLE で投入）"
  type        = string
  sensitive   = true
}

# jwt_private_key_pem / jwt_public_key_pem は削除済み（issue #187 P-0=A）
# JWT PEM は SSM Parameter Store（SecureString）に移行。aws ssm put-parameter で手動投入する（P-1=B）

variable "cors_allowed_origins" {
  description = "CORS 許可オリジン。issue #185 C 案適用後は CloudFront ドメイン（例: https://xxxxxxxxxx.cloudfront.net）を設定する。apply 後に cloudfront_domain_name output が判明してから設定する 2 段階デプロイ可"
  type        = string
  default     = "https://CHANGEME"

  validation {
    # "CHANGEME" を含む任意の文字列を拒否する（"https://CHANGEME_CLOUDFRONT" 等の example 値も含む）
    condition     = !can(regex("CHANGEME", var.cors_allowed_origins))
    error_message = "cors_allowed_origins contains 'CHANGEME' placeholder. Set the actual CloudFront domain (e.g., https://xxxxxxxxxx.cloudfront.net)."
  }
}

# cloudfront_origin_verify_secret は削除済み（issue #197 lean 化）
# X-Origin-Verify カスタムヘッダによるオリジン保護は廃止。
# 代替: EC2 SG を CloudFront managed prefix list 限定に設定（security_groups.tf 参照）。
# 判断の詳細は ADR-0007 を参照。

variable "trusted_proxy_count" {
  description = "信頼するリバースプロキシ段数（B-2-c）。実クライアント IP = XFF[len - trusted_proxy_count]。prod=1（CloudFront 1 段経由）、dev=0。ALB 除去（issue #197）により prod は 2→1 に変更"
  type        = number
  default     = 0
}

variable "s3_bucket_suffix" {
  description = "領収書バケット名のサフィックス（S3 グローバル名前空間衝突回避、I-04）。apply 前に openssl rand -hex 4 等で生成した 8 桁の値を設定する"
  type        = string
  default     = "CHANGEME"

  validation {
    condition     = var.s3_bucket_suffix != "CHANGEME" && can(regex("^[a-f0-9]{8}$", var.s3_bucket_suffix))
    error_message = "s3_bucket_suffix must be a unique 8-character hex string (e.g., openssl rand -hex 4). The default 'CHANGEME' is not allowed."
  }
}

# restrict_alb_to_cloudfront は削除済み（issue #197 lean 化）
# ALB 除去に伴い不要。EC2 SG が CloudFront prefix list を直接参照する構成に変更。

# §11 Q1: 案B（EC2 上で docker build）確定。
# image_tag は default = "" の optional 変数として定義し、
# user_data 側で空文字なら docker pull をスキップしてビルド分岐へ進む（W-01 対応）。
variable "image_tag" {
  description = "Docker イメージタグ。空文字（デフォルト）の場合は EC2 上で docker build を実行（Q1 案B）。GHCR/ECR を使う場合は git SHA または latest を指定"
  type        = string
  default     = ""
}

variable "ssm_parameter_path_prefix" {
  description = "SSM Parameter Store のパス接頭辞（env_config.md §5.3.2）。例: /expense-saas"
  type        = string
  default     = "/expense-saas"
}
