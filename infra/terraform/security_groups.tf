# CloudFront マネージドプレフィックスリスト参照（issue #197）
# CloudFront のオリジン向け IP レンジからのみ EC2 ポート 8080 へのアクセスを許可する。
# ALB を除去したため、EC2 SG が CloudFront prefix list を直接参照する構成に変更。
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# EC2 セキュリティグループ
# issue #197 lean 化: ALB SG を廃止し、CloudFront prefix list から直接 EC2:8080 を許可する。
# X-Origin-Verify カスタムヘッダによる 2 層防御を廃止し、SG 一枚に簡素化。
# オリジン保護の安全網はアプリのレート制限（RateLimitByIP / RateLimitByUser）。
# 判断の詳細は ADR-0007 を参照。
resource "aws_security_group" "ec2" {
  # name_prefix + create_before_destroy: SG 置換時に新 SG を先に作成し、参照元（RDS SG・EC2）を
  # 新 SG へ切り替えてから旧 SG を削除する。固定 name だと新旧同名で衝突するため name_prefix を使う。
  # （issue #197 の apply 失敗 = 旧 SG 先行削除による DependencyViolation の修正）
  name_prefix = "${local.prefix}-ec2-sg-"
  description = "Security group for EC2 app instance (8080 from CloudFront prefix list only; issue #197)"
  vpc_id      = aws_vpc.main.id

  # アプリポート: CloudFront マネージドプレフィックスリストからのみ許可
  # prefix list 外（直接アクセス等）からの :8080 はここで遮断される
  ingress {
    description     = "App port 8080 from CloudFront origin-facing prefix list only (issue #197)"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
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

  lifecycle {
    create_before_destroy = true
  }
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
