################################################################################
# Lambda — Bootstrap DB roles
# Runs once after RDS creation to create app_readwrite and app_readonly roles.
################################################################################

################################################################################
# Build: install deps + zip
################################################################################

resource "null_resource" "lambda_build" {
  triggers = {
    source_hash = filesha256("${path.module}/lambda/index.mjs")
    deps_hash   = filesha256("${path.module}/lambda/package.json")
  }

  provisioner "local-exec" {
    command     = "cd ${path.module}/lambda && npm install --omit=dev"
    interpreter = ["bash", "-c"]
  }
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/lambda_dist/bootstrap.zip"

  depends_on = [null_resource.lambda_build]
}

################################################################################
# IAM Role
################################################################################

resource "aws_iam_role" "lambda" {
  name = "${var.project}-${var.environment}-rds-bootstrap"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "rds-bootstrap-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

################################################################################
# Security Group — Lambda needs outbound to RDS on 5432
################################################################################

resource "aws_security_group" "lambda" {
  name        = "${var.project}-${var.environment}-rds-bootstrap-lambda"
  description = "Lambda bootstrap - outbound to RDS"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project}-${var.environment}-rds-bootstrap-lambda"
  }
}

resource "aws_security_group_rule" "lambda_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.lambda.id
  description       = "Allow all outbound"
}

################################################################################
# Lambda Function
################################################################################

resource "aws_lambda_function" "bootstrap" {
  function_name = "${var.project}-${var.environment}-rds-bootstrap"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"
  timeout       = 30
  memory_size   = 128

  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  tags = {
    Name = "${var.project}-${var.environment}-rds-bootstrap"
  }
}

################################################################################
# Invoke Lambda after RDS is ready
################################################################################

resource "aws_lambda_invocation" "bootstrap" {
  function_name = aws_lambda_function.bootstrap.function_name

  input = jsonencode({
    host              = aws_db_instance.this.address
    port              = aws_db_instance.this.port
    database          = var.db_name
    masterUser        = var.master_username
    masterPassword    = random_password.master.result
    readwriteUser     = "app_readwrite"
    readwritePassword = random_password.readwrite.result
    readonlyUser      = "app_readonly"
    readonlyPassword  = random_password.readonly.result
  })

  depends_on = [
    aws_db_instance.this,
    aws_lambda_function.bootstrap
  ]
}

