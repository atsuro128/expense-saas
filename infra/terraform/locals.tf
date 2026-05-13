locals {
  # リソース命名プレフィックス（例: expense-saas-portfolio）
  prefix = "${var.project_name}-${var.environment}"

  # 共通タグ
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
