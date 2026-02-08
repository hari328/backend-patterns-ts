################################################################################
# SSM Parameters — credentials and endpoints for downstream consumers
################################################################################

resource "aws_ssm_parameter" "db_endpoint" {
  name  = "/app/db-endpoint"
  type  = "String"
  value = aws_db_instance.this.address

  tags = {
    Name = "${var.project}-${var.environment}-db-endpoint"
  }
}

resource "aws_ssm_parameter" "db_port" {
  name  = "/app/db-port"
  type  = "String"
  value = tostring(aws_db_instance.this.port)

  tags = {
    Name = "${var.project}-${var.environment}-db-port"
  }
}

resource "aws_ssm_parameter" "db_name" {
  name  = "/app/db-name"
  type  = "String"
  value = var.db_name

  tags = {
    Name = "${var.project}-${var.environment}-db-name"
  }
}

resource "aws_ssm_parameter" "db_master_password" {
  name  = "/app/db-master-password"
  type  = "SecureString"
  value = random_password.master.result

  tags = {
    Name = "${var.project}-${var.environment}-db-master-password"
  }
}

resource "aws_ssm_parameter" "db_readwrite_url" {
  name  = "/app/db-readwrite-url"
  type  = "SecureString"
  value = "postgres://app_readwrite:${urlencode(random_password.readwrite.result)}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"

  depends_on = [aws_lambda_invocation.bootstrap]

  tags = {
    Name = "${var.project}-${var.environment}-db-readwrite-url"
  }
}

resource "aws_ssm_parameter" "db_readonly_url" {
  name  = "/app/db-readonly-url"
  type  = "SecureString"
  value = "postgres://app_readonly:${urlencode(random_password.readonly.result)}@${aws_db_instance.this.address}:${aws_db_instance.this.port}/${var.db_name}"

  depends_on = [aws_lambda_invocation.bootstrap]

  tags = {
    Name = "${var.project}-${var.environment}-db-readonly-url"
  }
}

