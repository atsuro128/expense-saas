# CloudFront マネージドプレフィックスリスト参照（B-1-b）
# CloudFront のオリジン向け IP レンジのみ ALB へのアクセスを許可する
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ALB セキュリティグループ
# issue #185 / C 案: CloudFront 前段で HTTPS 化。
# B-1-b（2 層防御）:
#   1 層目（常時有効）: ALB リスナーでカスタムヘッダ X-Origin-Verify を検証。
#                      ヘッダ不一致は即 403。variables.tf の restrict_alb_to_cloudfront の
#                      値に関わらず常に有効なため、SG が 0.0.0.0/0 でもセキュリティギャップは生じない。
#   2 層目（可変）:     restrict_alb_to_cloudfront=true で inbound 80 を
#                      CloudFront マネージドプレフィックスリスト限定に絞る。
#
# ─── 推奨 apply 手順（2 段階）────────────────────────────────────────────────
#   apply 1 回目（初回構築）:
#     restrict_alb_to_cloudfront = false（デフォルト値）のまま apply する。
#     CloudFront + ALB が作成される。SG は 0.0.0.0/0 開放だが、
#     カスタムヘッダ検証（1 層目）が常時有効なため保護されている。
#
#   待機:
#     CloudFront ディストリビューションが "Deployed" ステータスになるまで待つ（5〜15 分）。
#     確認: aws cloudfront get-distribution --id <id> --query 'Distribution.Status'
#
#   apply 2 回目（SG 絞り込み）:
#     restrict_alb_to_cloudfront = true を設定して apply する。
#     ALB SG の inbound 80 が CloudFront プレフィックスリスト限定に切り替わる（2 層目有効化）。
#
# 注意: -target=aws_cloudfront_distribution.main は使わないこと。
#       aws_cloudfront_distribution.main は aws_lb.main（→ aws_security_group.alb）に依存するため
#       -target apply でも SG 変更が先行して実行されうる（Terraform の依存解決の動作）。
#       変数による段階制御（上記 2 段階手順）を使うこと。
# SG と CloudFront の間に Terraform 依存エッジを付けると
# alb_sg → cloudfront → alb → alb_sg の循環依存になるため depends_on は付けない。
# ────────────────────────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "${local.prefix}-alb-sg"
  description = "Security group for ALB (HTTP 80 ingress controlled by restrict_alb_to_cloudfront; issue #185 B-1-b)"
  vpc_id      = aws_vpc.main.id

  # restrict_alb_to_cloudfront=false（初回 apply）: 0.0.0.0/0 開放
  dynamic "ingress" {
    for_each = var.restrict_alb_to_cloudfront ? [] : [1]
    content {
      description = "HTTP from anywhere (初回 apply 用。カスタムヘッダ検証で保護済み。CloudFront Deployed 確認後に restrict_alb_to_cloudfront=true で絞ること)"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  # restrict_alb_to_cloudfront=true（2 回目 apply）: CloudFront プレフィックスリスト限定
  dynamic "ingress" {
    for_each = var.restrict_alb_to_cloudfront ? [1] : []
    content {
      description     = "HTTP from CloudFront origin-facing prefix list only (B-1-b 2 層目)"
      from_port       = 80
      to_port         = 80
      protocol        = "tcp"
      prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
    }
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-alb-sg"
  })
}

# EC2 セキュリティグループ
resource "aws_security_group" "ec2" {
  name        = "${local.prefix}-ec2-sg"
  description = "Security group for EC2 app instance"
  vpc_id      = aws_vpc.main.id

  # アプリポート: ALB SG からのみ許可
  ingress {
    description     = "App port 8080 from ALB"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSH 22 番 ingress は削除済み（issue #187 / issue #186 UD-1=A: SSH 廃止 → SSM Session Manager）
  # SSM エンドポイント疎通用の 443 outbound は egress の 0.0.0.0/0 でカバーされている

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-ec2-sg"
  })
}

# RDS セキュリティグループ
resource "aws_security_group" "rds" {
  name        = "${local.prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL (5432 from EC2 only)"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-rds-sg"
  })
}
