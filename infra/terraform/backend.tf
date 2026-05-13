terraform {
  backend "s3" {
    # S3 バケットとDynamoDBテーブルは事前に AWS CLI で作成が必要（chicken-and-egg 問題）。
    # 手順は README.md §2 を参照。
    #
    # 使用前に以下の値を実際の値に書き換えること（または -backend-config= オプションで渡す）:
    #   bucket         = "expense-saas-tfstate-<8桁ランダムサフィックス>"
    #   dynamodb_table = "expense-saas-tflock"
    bucket         = "expense-saas-tfstate-CHANGEME"
    key            = "portfolio/terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "expense-saas-tflock"
    encrypt        = true
  }
}
