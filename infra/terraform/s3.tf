# 領収書保存用 S3 バケット
# §11 F-117 対応: versioning は採用しない（上流 backup_restore.md §3.2 / §4.2 に従い MVP は誤削除復旧不可）
# バケット名は S3 グローバル名前空間衝突回避のため、s3_bucket_suffix 変数でサフィックスを付与する（I-04）。
# apply 前に `openssl rand -hex 4` で 8 桁の hex 文字列を生成し、terraform.tfvars に設定すること。
# apply 後に terraform output s3_bucket_name で確認し、S3_BUCKET 環境変数に設定する。
resource "aws_s3_bucket" "receipts" {
  bucket = "${local.prefix}-receipts-${var.s3_bucket_suffix}"

  tags = merge(local.common_tags, {
    Name    = "${local.prefix}-receipts"
    Purpose = "expense-receipt-storage"
  })
}

# パブリックアクセスブロック（全面禁止）
resource "aws_s3_bucket_public_access_block" "receipts" {
  bucket = aws_s3_bucket.receipts.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# サーバーサイド暗号化（AES256）
resource "aws_s3_bucket_server_side_encryption_configuration" "receipts" {
  bucket = aws_s3_bucket.receipts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# versioning: 採用しない（F-117 対応）
# backup_restore.md §3.2 / §4.2 で MVP は S3 versioning 無効・誤削除復旧不可と定義されているため、
# portfolio 構成でも上流設計に合わせ versioning を有効化しない。
# b 案（versioning 有効）を採る場合は backup_restore.md §4.2 注の手順を参照のこと。
