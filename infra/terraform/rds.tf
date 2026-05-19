# RDS DB サブネットグループ（private-a/c の 2 AZ。RDS 仕様上 2 AZ 必須）
# §11 Q3: Single-AZ デプロイ（multi_az = false）
resource "aws_db_subnet_group" "main" {
  name        = "${local.prefix}-db-subnet-group"
  description = "DB subnet group for ${local.prefix} (private-a and private-c)"
  subnet_ids  = [aws_subnet.private_a.id, aws_subnet.private_c.id]

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-db-subnet-group"
  })
}

# RDS パラメータグループ
resource "aws_db_parameter_group" "main" {
  name        = "${local.prefix}-pg16"
  family      = "postgres16"
  description = "Parameter group for ${local.prefix} PostgreSQL 16"

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-pg16"
  })
}

# RDS インスタンス
resource "aws_db_instance" "main" {
  identifier = "${local.prefix}-db"

  # エンジン設定
  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro"

  # ストレージ（無料枠: 20GB まで。超過禁止。autoscaling 無効のため max_allocated_storage は設定しない）
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  # DB 設定
  db_name  = "expense_saas"
  username = var.db_master_user
  password = var.db_password

  # ネットワーク設定
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false # public アクセス禁止（§2.1 構成図）

  # パラメータグループ
  parameter_group_name = aws_db_parameter_group.main.name

  # 可用性設定（§11 Q3: Single-AZ）
  multi_az = false

  # バックアップ設定
  # AWS Free Tier アカウントの制約により backup_retention_period の上限が 1 日。
  # NFR-AVAIL-003 は portfolio 仕様として 1 日保持に緩和済み（issue #181 解決済み）。
  backup_retention_period = 1
  backup_window           = "18:00-19:00" # JST 03:00-04:00

  # メンテナンスウィンドウ
  maintenance_window = "Mon:19:00-Mon:20:00" # JST 月曜 04:00-05:00

  # スナップショット設定
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.prefix}-db-final-snapshot"
  copy_tags_to_snapshot     = true

  # 削除保護（apply 後に手動で無効化してから destroy する）
  deletion_protection = false

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-db"
  })
}
