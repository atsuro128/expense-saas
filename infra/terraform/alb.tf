# ALB（Application Load Balancer）
# §11 Q2 案1: HTTP のみ、ALB DNS 直接使用。ACM / HTTPS リスナー (443) は作らない。
# env_config.md prod 仕様（HTTPS 強制）との差分は README.md §4 に明記。
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

# リスナー（§11 Q2 案1: HTTP 80 のみ）
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-http-listener"
  })
}

# NOTE: §11 Q2 案1 採用のため HTTPS リスナー(443) / ACM 証明書 / Route53 は作成しない。
# 案2（Route53 + ACM + HTTPS）に移行する場合は以下のリソースを追加する:
#   - aws_acm_certificate
#   - aws_route53_record (ACM 検証 CNAME)
#   - aws_acm_certificate_validation
#   - aws_lb_listener (port=443, protocol=HTTPS)
# この差分は env_config.md prod 仕様（HTTPS 強制）との乖離として 11-F 引き継ぎに記録済み。
