# infra/terraform/Makefile
# expense-saas portfolio 環境向け Terraform 操作コマンド集（issue #197）
#
# 使用前提:
#   - AWS CLI が設定済み（export AWS_PROFILE=expense-saas-portfolio）
#   - terraform.tfvars が配置済み（cp terraform.tfvars.example terraform.tfvars して編集）
#   - sensitive 変数は TF_VAR_* 環境変数で渡す

.PHONY: plan apply destroy seed-remote

# terraform plan: 変更内容を確認する（apply 前に必ず実行）
plan:
	terraform plan -out=tfplan

# terraform apply: リソースを作成・更新する（plan で確認してから実行）
# 注意: trusted_proxy_count=1 を含む lean 構成が単一 apply で適用される。
# ALB 除去と EC2 SG 変更は同一 apply 内で不可分（順序誤りで EC2 閉塞を防ぐ）。
# apply 実行時は数分のダウンタイムが発生する（EC2 再作成 + CloudFront Deployed 待ち）。
# アクセスの少ない時間帯に実行すること。
apply:
	terraform apply tfplan

# terraform destroy: 全リソースを削除する（長期不在時・クレジット枯渇回避用）
# RDS は skip_final_snapshot=true・deletion_protection=false のため即削除される。
# 注意: SSM パラメータ（JWT 鍵・DB URL 等）は destroy では削除されない。
#       RDS 再作成後はエンドポイントが変わるため database/url と database/app_url の再投入が必要。
# 注意: EventBridge Scheduler の stop/start が動いている場合でも destroy は実行可能。
#       destroy 後は Scheduler の対象リソースが存在しないため空振りエラーとなるが無害。
destroy:
	terraform destroy

# seed-remote: 本番 RDS へ seed データを投入する
# RDS は private subnet のため、EC2 上で実行するか SSM port forwarding を経由する必要がある。
#
# 方法 A（推奨）: EC2 上での実行
#   aws ssm start-session --target <ec2_instance_id> --region ap-northeast-1
#   EC2 上で: DATABASE_URL=<owner_url> S3_BUCKET=<bucket> go run ./cmd/seed/...
#
# 方法 B: SSM port forwarding 経由（ローカル実行）
#   aws ssm start-session \
#     --target <ec2_instance_id> \
#     --document-name AWS-StartPortForwardingSessionToRemoteHost \
#     --parameters '{"host":["<rds-endpoint>"],"portNumber":["5432"],"localPortNumber":["5432"]}' \
#     --region ap-northeast-1
#   別ターミナルで: DATABASE_URL=postgres://expense_owner:<pw>@localhost:5432/expense_saas?sslmode=disable \
#                    S3_BUCKET=<bucket> go run ./cmd/seed/...
#
# DATABASE_URL は SSM Parameter Store から取得する:
#   aws ssm get-parameter \
#     --name "/expense-saas/portfolio/database/url" \
#     --with-decryption \
#     --query 'Parameter.Value' \
#     --output text \
#     --region ap-northeast-1
#
# S3_BUCKET は terraform output s3_bucket_name で確認する。
seed-remote:
	@echo "seed-remote は RDS private subnet のため EC2 上または SSM port forwarding 経由で実行してください。"
	@echo ""
	@echo "DATABASE_URL の取得:"
	@echo "  aws ssm get-parameter --name \"/expense-saas/portfolio/database/url\" --with-decryption --query 'Parameter.Value' --output text --region ap-northeast-1"
	@echo ""
	@echo "S3_BUCKET の取得:"
	@echo "  terraform output s3_bucket_name"
	@echo ""
	@echo "EC2 上での実行例:"
	@echo "  DATABASE_URL=<owner_url> S3_BUCKET=<bucket> go run ./cmd/seed/..."
