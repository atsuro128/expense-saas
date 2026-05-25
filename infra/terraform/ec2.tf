# Amazon Linux 2023 最新 AMI の取得
data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }

  filter {
    name   = "architecture"
    values = ["x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 インスタンス
resource "aws_instance" "app" {
  ami           = data.aws_ami.al2023.id
  instance_type = "t3.micro"
  # key_name 削除: issue #187 / issue #186 UD-1=A で SSH 廃止 → SSM Session Manager 接続に移行
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  root_block_device {
    volume_type = "gp3"
    volume_size = 8 # 無料枠 30GB まで、8GB で十分
    encrypted   = true
  }

  # user_data: SSM Parameter Store からシークレット取得 + Docker + systemd 設定（issue #187）
  # P-6=B 採用: 非機密項目（cors_allowed_origins / trusted_proxy_count）は Terraform variable から埋め込み
  # 機密項目（jwt_*_pem）は SSM Parameter Store 経由のため templatefile 引数から削除
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    environment               = var.environment
    ssm_parameter_path_prefix = var.ssm_parameter_path_prefix
    aws_region                = var.aws_region
    image_tag                 = var.image_tag
    cors_allowed_origins      = var.cors_allowed_origins
    trusted_proxy_count       = var.trusted_proxy_count
    s3_bucket                 = aws_s3_bucket.receipts.bucket
    log_group_name            = aws_cloudwatch_log_group.app.name # issue #188: awslogs ドライバ転送先（これ 1 個のみ追加。aws_region は既存）
  })

  # true に設定: user_data 変更時に EC2 を再作成する（P-3=A / R-3 対策）
  # false のままだと SSM 移行スクリプトが既存インスタンスに反映されない
  user_data_replace_on_change = true

  # B-06 対策: policy attachment 完了前に EC2 が起動し user_data の aws ssm get-parameters が
  # IAM 付与前に走る競合を防ぐ。Terraform は role/profile 作成後、attachment と EC2 作成を
  # 並列化できるため、明示的な依存を宣言して attachment 完了を待つ。
  # ec2_kms_decrypt は B-05 で削除済み（alias/aws/ssm の自動 grant に依存するため不要）。
  # B-06 対策 + issue #188: policy attachment および LogGroup 完了前に EC2 が起動する競合を防ぐ。
  # ec2_cloudwatch_logs: awslogs ドライバが IAM 付与前に書き込もうとする競合回避（R-2）
  # app (LogGroup): awslogs-create-group=false 指定のため LogGroup 先行作成が必須（R-3）
  depends_on = [
    aws_iam_role_policy_attachment.ec2_ssm_core,
    aws_iam_role_policy.ec2_ssm_parameters,
    aws_iam_role_policy.ec2_cloudwatch_logs,
    aws_cloudwatch_log_group.app,
  ]

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-app"
  })
}
