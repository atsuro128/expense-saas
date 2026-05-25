# EC2 インスタンス用 IAM ロール
resource "aws_iam_role" "ec2_role" {
  name        = "${local.prefix}-ec2-role"
  description = "IAM role for ${local.prefix} EC2 app instance (S3 receipts access)"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-ec2-role"
  })
}

# IAM インスタンスプロファイル
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${local.prefix}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-ec2-profile"
  })
}

# SSM Session Manager 基本機能ポリシーのアタッチ（issue #187: SSH 廃止 + SSM 接続移行）
# AmazonSSMManagedInstanceCore: SSM Agent の AWS API 認証・セッション確立に必要なマネージドポリシー
resource "aws_iam_role_policy_attachment" "ec2_ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# SSM Parameter Store 読み取り用カスタムポリシー（issue #187: シークレットを SSM から取得）
# Action は GetParameters のみ（jq + --output json 方式で単一 API 呼び出し）
# Resource: /expense-saas/* で全 env 共通発行。env_config.md §5.3.5 は prod 固定だが、
#           本 Terraform 構成は env 追加時の IAM 修正不要を優先して /* で広げる（§6.5 差分注記）
resource "aws_iam_role_policy" "ec2_ssm_parameters" {
  name = "${local.prefix}-ec2-ssm-parameters-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter${var.ssm_parameter_path_prefix}/*"
        ]
      }
    ]
  })
}

# S3 アクセスポリシー（領収書バケットへの GetObject / PutObject / DeleteObject / ListBucket）
# テナント prefix による IAM レベルの制限は MVP スコープ外。アプリ層で担保する（§3.2 iam.tf 注記）。
resource "aws_iam_role_policy" "ec2_s3_policy" {
  name = "${local.prefix}-ec2-s3-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.receipts.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
        ]
        Resource = aws_s3_bucket.receipts.arn
      }
    ]
  })
}
