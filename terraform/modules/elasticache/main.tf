################################################################################
# Subnet Group
################################################################################

resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.project}-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project}-${var.environment}"
  }
}

################################################################################
# Security Group - inbound 6379 from VPC CIDR
################################################################################

resource "aws_security_group" "redis" {
  name        = "${var.project}-${var.environment}-redis"
  description = "ElastiCache Redis - inbound 6379 from VPC"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.project}-${var.environment}-redis"
  }
}

resource "aws_security_group_rule" "redis_ingress" {
  type              = "ingress"
  from_port         = var.port
  to_port           = var.port
  protocol          = "tcp"
  cidr_blocks       = [var.vpc_cidr]
  security_group_id = aws_security_group.redis.id
  description       = "Redis from VPC"
}

resource "aws_security_group_rule" "redis_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.redis.id
  description       = "Allow all outbound"
}

################################################################################
# ElastiCache Redis Cluster
################################################################################

resource "aws_elasticache_cluster" "this" {
  cluster_id           = "${var.project}-${var.environment}"
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_nodes      = var.num_cache_nodes
  port                 = var.port
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = {
    Name = "${var.project}-${var.environment}"
  }
}

