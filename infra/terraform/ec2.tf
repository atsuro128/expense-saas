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
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.micro"
  key_name               = var.key_pair_name
  subnet_id              = aws_subnet.public_a.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name

  root_block_device {
    volume_type = "gp3"
    volume_size = 8 # 無料枠 30GB まで、8GB で十分
    encrypted   = true
  }

  # user_data: Docker インストール + swap 設定 + アプリ起動の準備
  # §11 Q1 案B（EC2 上で docker build）確定済み。
  # image_tag が空文字（デフォルト）なら docker pull をスキップし、EC2 上で git clone + docker build する。
  # image_tag が指定されていれば GHCR/ECR 等から docker pull する（将来の案A/C 用分岐）。
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    project_name              = var.project_name
    environment               = var.environment
    image_tag                 = var.image_tag
    jwt_private_key_pem       = var.jwt_private_key_pem
    jwt_public_key_pem        = var.jwt_public_key_pem
    cors_allowed_origins      = var.cors_allowed_origins
    expense_owner_db_password = var.expense_owner_db_password
    expense_app_db_password   = var.expense_app_db_password
  })

  user_data_replace_on_change = false

  tags = merge(local.common_tags, {
    Name = "${local.prefix}-app"
  })
}
