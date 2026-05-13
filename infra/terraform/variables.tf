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

variable "key_pair_name" {
  description = "EC2 インスタンスに使用する AWS キーペア名（AWS コンソールで事前作成が必要）"
  type        = string
  default     = "expense-saas-portfolio"
}

variable "allowed_ssh_cidr" {
  description = "EC2 SSH アクセスを許可する CIDR（自宅 IP 等。例: xxx.xxx.xxx.xxx/32）"
  type        = string
}

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

variable "jwt_private_key_pem" {
  description = "JWT 署名に使用する RSA 秘密鍵（PEM 形式）。openssl genrsa で生成し TF_VAR_jwt_private_key_pem 環境変数で渡す"
  type        = string
  sensitive   = true
}

variable "jwt_public_key_pem" {
  description = "JWT 検証に使用する RSA 公開鍵（PEM 形式）。openssl rsa -pubout で生成し TF_VAR_jwt_public_key_pem 環境変数で渡す"
  type        = string
  sensitive   = true
}

variable "cors_allowed_origins" {
  description = "CORS 許可オリジン（例: http://<alb-dns>）。apply 後に ALB DNS が判明してから設定する 2 段階デプロイ or プレースホルダで代替可"
  type        = string
  default     = "http://CHANGEME"

  validation {
    # "CHANGEME" を含む任意の文字列を拒否する（"http://CHANGEME_ALB_DNS" 等の example 値も含む）
    condition     = !can(regex("CHANGEME", var.cors_allowed_origins))
    error_message = "cors_allowed_origins contains 'CHANGEME' placeholder. Set the actual ALB DNS (e.g., http://expense-saas-alb-xxxx.ap-northeast-1.elb.amazonaws.com)."
  }
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

# §11 Q1: 案B（EC2 上で docker build）確定。
# image_tag は default = "" の optional 変数として定義し、
# user_data 側で空文字なら docker pull をスキップしてビルド分岐へ進む（W-01 対応）。
variable "image_tag" {
  description = "Docker イメージタグ。空文字（デフォルト）の場合は EC2 上で docker build を実行（Q1 案B）。GHCR/ECR を使う場合は git SHA または latest を指定"
  type        = string
  default     = ""
}
