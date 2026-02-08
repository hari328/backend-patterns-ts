# Reads all SSM parameters written by Layer 1 (infra-backend-patterns-ts)
# Other modules depend on this to get VPC, ECS, ALB, DNS details.

# Networking
data "aws_ssm_parameter" "vpc_id" {
  name = "/infra/vpc-id"
}

data "aws_ssm_parameter" "public_subnet_ids" {
  name = "/infra/public-subnet-ids"
}

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "/infra/private-subnet-ids"
}

# ECS Cluster
data "aws_ssm_parameter" "cluster_arn" {
  name = "/infra/cluster-arn"
}

data "aws_ssm_parameter" "cluster_name" {
  name = "/infra/cluster-name"
}

# ALB
data "aws_ssm_parameter" "alb_arn" {
  name = "/infra/alb-arn"
}

data "aws_ssm_parameter" "alb_dns_name" {
  name = "/infra/alb-dns-name"
}

data "aws_ssm_parameter" "alb_security_group_id" {
  name = "/infra/alb-security-group-id"
}

data "aws_ssm_parameter" "alb_listener_arn" {
  name = "/infra/alb-listener-arn"
}

# DNS / SSL
data "aws_ssm_parameter" "hosted_zone_id" {
  name = "/infra/hosted-zone-id"
}

data "aws_ssm_parameter" "acm_cert_arn" {
  name = "/infra/acm-cert-arn"
}

