output "redis_endpoint" {
  description = "Redis primary endpoint address"
  value       = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "redis_port" {
  description = "Redis port"
  value       = var.port
}

output "redis_security_group_id" {
  description = "Redis security group ID - use to allow inbound from ECS tasks"
  value       = aws_security_group.redis.id
}

output "redis_url_ssm_arn" {
  description = "ARN of the SSM parameter storing the Redis URL"
  value       = aws_ssm_parameter.redis_url.arn
}

output "redis_url_ssm_name" {
  description = "Name of the SSM parameter storing the Redis URL"
  value       = aws_ssm_parameter.redis_url.name
}

