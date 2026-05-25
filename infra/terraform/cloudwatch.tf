# CloudWatch Logs: アプリログの転送先（Docker awslogs ドライバから書き込み）
# - retention 30 日（ADR-0005、monitoring.md §9.1）
# - 命名: /${var.project_name}/${var.environment}/api（P-1=b、env_config.md §5.3.2 と階層整合）
# - local.prefix は "-" 区切りのフラット命名規約のため "/" 階層を要する LogGroup 名には流用しない（I-01）
#   SSM Parameter Store の命名 /expense-saas/{env}/... と階層を揃えるため明示的に "/" 区切りで構築する
resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.project_name}/${var.environment}/api"
  retention_in_days = 30

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-app-logs"
  })
}
