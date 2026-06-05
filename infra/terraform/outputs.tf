output "cloudfront_domain_name" {
  description = "CloudFront ディストリビューションのドメイン名。エンドユーザーはこの URL でアクセスする（例: https://<cloudfront_domain_name>/）"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "eip_public_ip" {
  description = "EC2 に割り当てた EIP のパブリック IP アドレス。stop/start 後も不変。CloudFront origin に使用（public_dns 経由）"
  value       = aws_eip.app.public_ip
}

output "eip_public_dns" {
  description = "EC2 に割り当てた EIP の public DNS ホスト名。CloudFront origin の domain_name に設定している"
  value       = aws_eip.app.public_dns
}

output "ec2_public_ip" {
  description = "EC2 インスタンスのパブリック IP（EIP と同値。参照用。SSH は廃止済み。接続は SSM Session Manager 経由: aws ssm start-session --target <ec2_instance_id>）"
  value       = aws_instance.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 インスタンス ID。SSM Session Manager 接続時の --target 引数に使用する（aws ssm start-session --target <value>）"
  value       = aws_instance.app.id
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
