################################################################################
# SSM Parameters - Redis endpoint and connection details
################################################################################

resource "aws_ssm_parameter" "redis_endpoint" {
  name  = "/app/redis-endpoint"
  type  = "String"
  value = aws_elasticache_cluster.this.cache_nodes[0].address

  tags = {
    Name = "${var.project}-${var.environment}-redis-endpoint"
  }
}

resource "aws_ssm_parameter" "redis_port" {
  name  = "/app/redis-port"
  type  = "String"
  value = tostring(var.port)

  tags = {
    Name = "${var.project}-${var.environment}-redis-port"
  }
}

resource "aws_ssm_parameter" "redis_url" {
  name  = "/app/redis-url"
  type  = "String"
  value = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:${var.port}"

  tags = {
    Name = "${var.project}-${var.environment}-redis-url"
  }
}

