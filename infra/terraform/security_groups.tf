# CloudFront マネージドプレフィックスリスト参照（B-1-b）
# CloudFront のオリジン向け IP レンジのみ ALB へのアクセスを許可する
data "aws_ec2_managed_prefix_list" "cloudfront_origin_facing" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ALB セキュリティグループ
# issue #185 / C 案: CloudFront 前段で HTTPS 化。
# B-1-b（完全閉域）: inbound 80 を CloudFront マネージドプレフィックスリスト限定に変更。
# 他者の自前 CloudFront 経由のアクセスはカスタムヘッダ検証（alb.tf）で遮断する。
resource "aws_security_group" "alb" {
  name        = "${local.prefix}-alb-sg"
  description = "Security group for ALB (HTTP 80 from CloudFront prefix list only; issue #185 B-1-b)"
  vpc_id      = aws_vpc.main.id

  # ─── 適用順序の注意 ───────────────────────────────────────────────────────
  # この ingress を有効化（0.0.0.0/0 → プレフィックスリスト限定）するには、
  # 先に aws_cloudfront_distribution.main が "Deployed" になっている必要がある。
  # CloudFront 作成には 5〜15 分かかるため、同一 apply で両リソースを作成すると
  # CloudFront が Deployed になる前に SG が切り替わり ALB が全遮断されうる。
  #
  # 推奨 apply 手順（2 段階）:
  #   Step 1: CloudFront のみを先に apply し、ステータスが Deployed になるまで待機
  #           例: terraform apply -target=aws_cloudfront_distribution.main
  #   Step 2: CloudFront の Deployed 確認後、残りのリソース（SG 含む）を apply
  #           例: terraform apply
  #
  # または初回環境構築（ダウンタイム許容）であれば 1 回の apply でも可。
  # SG と CloudFront の間に Terraform 依存エッジを付けると
  # alb_sg → cloudfront → alb → alb_sg の循環依存になるため depends_on は付けない。
  # ────────────────────────────────────────────────────────────────────────
  ingress {
    description     = "HTTP from CloudFront origin-facing prefix list (B-1-b)"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin_facing.id]
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

  # SSH: 自宅 IP のみ許可
  ingress {
    description = "SSH from allowed CIDR"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

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
