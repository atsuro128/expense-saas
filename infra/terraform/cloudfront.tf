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
  # default_root_object は設定しない (issue #190)
  # 過去 PR #151 で "index.html" を設定していたが、これは S3 オリジン向け機能で、
  # カスタムオリジン (ALB) + Go 製 SPA fallback ハンドラの組み合わせでは無限リダイレクトループを引き起こす:
  #   CloudFront が / を /index.html にリライト → Go FileServer が /index.html を Location: ./ で 301 → / に戻り無限ループ
  # SPA fallback handler (internal/spa/handler.go) はすでに / リクエストを正しく処理するため、
  # default_root_object なしで CloudFront はそのまま / を ALB に転送する経路で問題なく動作する。

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

  # *.cloudfront.net デフォルト証明書（独自ドメイン・ACM 不要、コスト $0）。
  #
  # 【設計逸脱・受容（issue #185 B-5）】
  # デフォルト証明書を使うと viewer 側 TLS の最小バージョンが TLSv1（1.0）に
  # 固定され、minimum_protocol_version で引き上げられない（AWS 仕様）。
  # security.md §11「TLS 1.2 以上」とは乖離するが、TLS 1.2+ を実際に強制するには
  # 独自ドメイン + ACM 証明書が必要でコストが発生するため、ポートフォリオ用途では
  # この逸脱を受容する。現代ブラウザは全て TLS 1.2/1.3 で接続するため実害は
  # 事実上ゼロ。受容理由の詳細は ADR-0007 を参照。
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
