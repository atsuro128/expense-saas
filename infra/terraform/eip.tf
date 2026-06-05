# Elastic IP（EC2 インスタンスへの固定 IP 割り当て）
# issue #197: ALB 除去に伴い、CloudFront origin を EIP の public_dns へ直結する。
# EIP を使用することで stop/start 後もパブリック IP・DNS が不変となり、
# CloudFront origin の再設定が不要になる（受入基準 5）。
#
# 注意: EIP は EC2 インスタンスが停止中（stop）でも課金される（~$3.6/月）。
# 最大コスト削減は ALB 削除（~$18-20/月）であり、EIP 追加のネット増減は小さい。
# 詳細は ADR-0004 コスト節を参照。
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-eip"
  })
}
