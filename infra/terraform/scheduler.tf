# EventBridge Scheduler: EC2/RDS の深夜 stop・朝 start 自動化（issue #197）
# コスト最適化: 夜間停止により EC2(~$10/月) と RDS(~$20/月) の稼働時間分を削減する。
# 注意: EIP($3.6/月) と EBS/RDS ストレージは stop 中も課金継続で削減不可。
# 最大コスト削減は ALB 削除（~$18-20/月）であり、stop/start はその補完施策。
#
# start 順序: RDS を先に起動し、その後 EC2 を起動する。
# EC2 の systemd サービスは RestartSec=30 + StartLimitIntervalSec=0 の設定により RDS が
# available になるまで 30 秒間隔で無制限に再試行する（user_data.sh.tpl 参照）。

# アカウント ID 取得（IAM ポリシーの Resource ARN を完全修飾するため）
data "aws_caller_identity" "current" {}

# ─── IAM ロール（EventBridge Scheduler → EC2/RDS API 実行用）───────────────

resource "aws_iam_role" "scheduler" {
  name               = "${local.prefix}-scheduler-role"
  description        = "EventBridge Scheduler が EC2/RDS を stop/start するための IAM ロール（issue #197）"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-scheduler-role"
  })
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "scheduler_ec2_rds" {
  name   = "${local.prefix}-scheduler-ec2-rds-policy"
  role   = aws_iam_role.scheduler.id
  policy = data.aws_iam_policy_document.scheduler_ec2_rds.json
}

data "aws_iam_policy_document" "scheduler_ec2_rds" {
  # EC2 stop/start: 対象インスタンス ARN に限定
  statement {
    effect = "Allow"
    actions = [
      "ec2:StopInstances",
      "ec2:StartInstances",
    ]
    resources = [
      "arn:aws:ec2:${var.aws_region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.app.id}",
    ]
  }

  # RDS stop/start: 対象 DB インスタンス ARN に限定
  statement {
    effect = "Allow"
    actions = [
      "rds:StopDBInstance",
      "rds:StartDBInstance",
    ]
    resources = [
      aws_db_instance.main.arn,
    ]
  }
}

# ─── スケジュール定義 ────────────────────────────────────────────────────────

# RDS 停止（JST 01:00 = UTC 16:00 前日）
# RDS を先に停止する（start と対称）
resource "aws_scheduler_schedule" "rds_stop" {
  name                         = "${local.prefix}-rds-stop"
  description                  = "夜間 RDS 停止（JST 01:00）: コスト削減目的（issue #197）"
  schedule_expression          = "cron(0 16 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = aws_db_instance.main.identifier
    })
  }
}

# EC2 停止（JST 01:30 = UTC 16:30 前日）
# RDS 停止の 30 分後に EC2 を停止する
resource "aws_scheduler_schedule" "ec2_stop" {
  name                         = "${local.prefix}-ec2-stop"
  description                  = "夜間 EC2 停止（JST 01:30）: コスト削減目的（issue #197）"
  schedule_expression          = "cron(30 16 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      InstanceIds = [aws_instance.app.id]
    })
  }
}

# RDS 起動（JST 08:00 = UTC 23:00 前日）
# EC2 より先に RDS を起動して available になるまで待つ
resource "aws_scheduler_schedule" "rds_start" {
  name                         = "${local.prefix}-rds-start"
  description                  = "朝 RDS 起動（JST 08:00）: EC2 起動より先（issue #197）"
  schedule_expression          = "cron(0 23 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:startDBInstance"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      DbInstanceIdentifier = aws_db_instance.main.identifier
    })
  }
}

# EC2 起動（JST 08:15 = UTC 23:15 前日）
# RDS 起動の 15 分後に EC2 を起動する。
# EC2 の systemd サービスは RestartSec=30 + StartLimitIntervalSec=0 により 30 秒間隔で無制限に
# 再試行するため、RDS が available になるまで接続失敗しても問題ない（user_data.sh.tpl 参照）。
resource "aws_scheduler_schedule" "ec2_start" {
  name                         = "${local.prefix}-ec2-start"
  description                  = "朝 EC2 起動（JST 08:15）: RDS 起動の 15 分後（issue #197）"
  schedule_expression          = "cron(15 23 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:startInstances"
    role_arn = aws_iam_role.scheduler.arn

    input = jsonencode({
      InstanceIds = [aws_instance.app.id]
    })
  }
}
