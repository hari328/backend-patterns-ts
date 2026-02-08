# Networking
output "vpc_id" {
  value = data.aws_ssm_parameter.vpc_id.value
}

output "public_subnet_ids" {
  value = split(",", data.aws_ssm_parameter.public_subnet_ids.value)
}

output "private_subnet_ids" {
  value = split(",", data.aws_ssm_parameter.private_subnet_ids.value)
}

# ECS Cluster
output "cluster_arn" {
  value = data.aws_ssm_parameter.cluster_arn.value
}

output "cluster_name" {
  value = data.aws_ssm_parameter.cluster_name.value
}

# ALB
output "alb_arn" {
  value = data.aws_ssm_parameter.alb_arn.value
}

output "alb_dns_name" {
  value = data.aws_ssm_parameter.alb_dns_name.value
}

output "alb_security_group_id" {
  value = data.aws_ssm_parameter.alb_security_group_id.value
}

output "alb_listener_arn" {
  value = data.aws_ssm_parameter.alb_listener_arn.value
}

# DNS / SSL
output "hosted_zone_id" {
  value = data.aws_ssm_parameter.hosted_zone_id.value
}

output "acm_cert_arn" {
  value = data.aws_ssm_parameter.acm_cert_arn.value
}

