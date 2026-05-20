output "cloudfront_domain_name" {
  description = "CloudFront ディストリビューションのドメイン名。エンドユーザーはこの URL でアクセスする（例: https://<cloudfront_domain_name>/）"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "alb_dns_name" {
  description = "ALB の DNS 名（直アクセス不可。CloudFront 経由でのみ到達可能。B-1-b プレフィックスリスト + カスタムヘッダで CloudFront 外からの 80 番アクセスを遮断）"
  value       = aws_lb.main.dns_name
}

output "ec2_public_ip" {
  description = "EC2 インスタンスのパブリック IP（SSH アクセス用）"
  value       = aws_instance.app.public_ip
}

output "rds_endpoint" {
  description = "RDS インスタンスのエンドポイント（ホスト:ポート形式）。DATABASE_URL / APP_DATABASE_URL に使用する"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "領収書保存用 S3 バケット名。S3_BUCKET 環境変数に設定する"
  value       = aws_s3_bucket.receipts.bucket
}
