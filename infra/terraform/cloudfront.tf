# CloudFront ディストリビューション（issue #185 C 案）
# ALB を前段に置き、*.cloudfront.net デフォルト証明書で HTTPS 化。
# 独自ドメイン・ACM 不要で実質 $0（CloudFront 永久無料枠内）。
# CloudFront〜ALB 間は HTTP（B-3 で受容、ADR-0007 に記録）。

# AWS マネージドキャッシュポリシー ID の参照
# CachingOptimized: SPA 静的コンテンツ用
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# CachingDisabled: API エンドポイント用（キャッシュ無効）
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# AllViewerExceptHostHeader: API リクエストのヘッダ・Cookie・クエリをオリジンへ転送
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "main" {
  comment         = "${local.prefix} CloudFront distribution (issue #185 C案)"
  enabled         = true
  is_ipv6_enabled = true
  # SPA のルート `/` アクセス時に CloudFront が `/index.html` をオリジンから取得する。
  # ALB/アプリ側でのディープリンクフォールバックと役割は異なり、双方が機能して問題ない。
  # なお `/health` は `/api/*` パターンに合致しないためこのデフォルトビヘイビアに流れるが、
  # 機密情報を含まないため CloudFront エッジにキャッシュされても実害なし（W-A 参照）。
  default_root_object = "index.html"

  # コスト制御: PriceClass_200 以下で無料枠維持
  # PriceClass_200 = 北米・欧州・アジアパシフィック（日本含む）
  price_class = "PriceClass_200"

  # オリジン: 既存 ALB（HTTP:80 のみ。B-3 受容）
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "${local.prefix}-alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443 # origin_protocol_policy = "http-only" のため実際には参照されない（プロバイダ必須引数）
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # B-1-b カスタムヘッダ: CloudFront→ALB 間の秘密ヘッダ付与
    # ALB リスナールールでこのヘッダを検証し、不一致は 403 を返す（閉域強制）
    custom_header {
      name  = "X-Origin-Verify"
      value = var.cloudfront_origin_verify_secret
    }
  }

  # デフォルトビヘイビア: SPA 配信（GET/HEAD のみ、CachingOptimized）
  default_cache_behavior {
    target_origin_id       = "${local.prefix}-alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # /api/* ビヘイビア: API リクエスト（全メソッド許可、キャッシュ無効）
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "${local.prefix}-alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = false

    # 全 HTTP メソッドを許可（POST/PUT/PATCH/DELETE 等を含む）
    allowed_methods = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    # cached_methods は CloudFront の仕様上 GET/HEAD を必ず含む必要がある（allowed_methods の部分集合）。
    # cache_policy_id = CachingDisabled のため実際にはエッジキャッシュは発生しない。
    # 将来 cache_policy_id を別ポリシーに差し替えた場合は API レスポンスがキャッシュされる可能性があるため注意。
    cached_methods = ["GET", "HEAD"]

    # キャッシュ無効（API レスポンスをキャッシュしない）
    cache_policy_id = data.aws_cloudfront_cache_policy.caching_disabled.id

    # Authorization・Cookie・クエリをオリジンへ転送
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
  }

  # *.cloudfront.net デフォルト証明書（独自ドメイン・ACM 不要）
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  # 地理的制限なし
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-cloudfront"
  })
}
