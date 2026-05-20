# ALB（Application Load Balancer）
# CloudFront 前段で HTTPS 化（issue #185 / C 案）。
# ALB〜CloudFront 間は HTTP（B-3 受容・ADR-0007 記録）、カスタムヘッダ + プレフィックスリストで CloudFront 経由を強制。
resource "aws_lb" "main" {
  name               = "${local.prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]

  # 2 AZ 必須（ALB 仕様。public-a と public-c）
  subnets = [
    aws_subnet.public_a.id,
    aws_subnet.public_c.id,
  ]

  idle_timeout               = 60
  enable_deletion_protection = false

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-alb"
  })
}

# ターゲットグループ（EC2 の 8080 ポートへ転送）
resource "aws_lb_target_group" "app" {
  name        = "${local.prefix}-tg"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    path                = "/health"
    protocol            = "HTTP"
    port                = "8080"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-tg"
  })
}

# ターゲット登録（EC2 インスタンス）
resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 8080
}

# リスナー（HTTP:80）
# B-1-b: デフォルトアクションを 403 fixed-response に設定。
# X-Origin-Verify ヘッダが一致した場合のみ、リスナールールでターゲットグループへ転送する。
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # CloudFront 経由以外（カスタムヘッダなし・不一致）は 403 を返す
  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-http-listener"
  })
}

# リスナールール（B-1-b）: X-Origin-Verify ヘッダ一致時のみターゲットグループへ転送
# 優先度 1（最高）で評価し、ヘッダ一致時に forward する。
resource "aws_lb_listener_rule" "cloudfront_verify" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1

  condition {
    http_header {
      http_header_name = "X-Origin-Verify"
      values           = [var.cloudfront_origin_verify_secret]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-cloudfront-verify-rule"
  })
}

# NOTE: HTTPS リスナー(443) / ACM 証明書 / Route53 は CloudFront デフォルト証明書で代替（issue #185 C 案）。
# 独自ドメインへ移行する場合は以下のリソースを追加する:
#   - aws_acm_certificate
#   - aws_route53_record (ACM 検証 CNAME)
#   - aws_acm_certificate_validation
#   - aws_lb_listener (port=443, protocol=HTTPS)
