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
