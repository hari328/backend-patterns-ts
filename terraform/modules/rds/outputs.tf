output "db_endpoint" {
  description = "RDS instance endpoint (hostname)"
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "RDS instance port"
  value       = aws_db_instance.this.port
}

output "db_security_group_id" {
  description = "RDS security group ID — use to allow inbound from ECS tasks"
  value       = aws_security_group.rds.id
}

output "db_readwrite_ssm_arn" {
  description = "ARN of the SSM parameter storing the readwrite DATABASE_URL"
  value       = aws_ssm_parameter.db_readwrite_url.arn
}

output "db_readonly_ssm_arn" {
  description = "ARN of the SSM parameter storing the readonly DATABASE_URL"
  value       = aws_ssm_parameter.db_readonly_url.arn
}

output "db_readwrite_ssm_name" {
  description = "Name of the SSM parameter storing the readwrite DATABASE_URL"
  value       = aws_ssm_parameter.db_readwrite_url.name
}

output "db_readonly_ssm_name" {
  description = "Name of the SSM parameter storing the readonly DATABASE_URL"
  value       = aws_ssm_parameter.db_readonly_url.name
}

