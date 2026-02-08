# Networking
output "vpc_id" {
  value     = data.aws_ssm_parameter.vpc_id.value
  sensitive = true
}

output "public_subnet_ids" {
  value     = split(",", data.aws_ssm_parameter.public_subnet_ids.value)
  sensitive = true
}

output "private_subnet_ids" {
  value     = split(",", data.aws_ssm_parameter.private_subnet_ids.value)
  sensitive = true
}

# ECS Cluster
output "cluster_arn" {
  value     = data.aws_ssm_parameter.cluster_arn.value
  sensitive = true
}

output "cluster_name" {
  value     = data.aws_ssm_parameter.cluster_name.value
  sensitive = true
}

# ALB
output "alb_arn" {
  value     = data.aws_ssm_parameter.alb_arn.value
  sensitive = true
}

output "alb_dns_name" {
  value     = data.aws_ssm_parameter.alb_dns_name.value
  sensitive = true
}

output "alb_security_group_id" {
  value     = data.aws_ssm_parameter.alb_security_group_id.value
  sensitive = true
}

output "alb_listener_arn" {
  value     = data.aws_ssm_parameter.alb_listener_arn.value
  sensitive = true
}

# DNS / SSL
output "hosted_zone_id" {
  value     = data.aws_ssm_parameter.hosted_zone_id.value
  sensitive = true
}

output "acm_cert_arn" {
  value     = data.aws_ssm_parameter.acm_cert_arn.value
  sensitive = true
}

