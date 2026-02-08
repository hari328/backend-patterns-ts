variable "project" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (stage, prod)"
  type        = string
}

variable "services" {
  description = "Map of service name to service configuration"
  type = map(object({
    container_port    = number
    cpu               = number
    memory            = number
    desired_count     = number
    path_patterns     = list(string)
    health_check_path = string
    priority          = number
    environment       = map(string)
    ssm_secrets       = map(string)
    sqs_publish_arns  = list(string)
    sqs_consume_arns  = list(string)
  }))
}

################################################################################
# Shared infra inputs (from base-data dependency)
################################################################################

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "cluster_arn" {
  description = "ECS cluster ARN"
  type        = string
}

variable "alb_listener_arn" {
  description = "ALB HTTPS listener ARN"
  type        = string
}

variable "alb_security_group_id" {
  description = "ALB security group ID - used for ECS task SG ingress"
  type        = string
}

################################################################################
# ECR inputs (from ecr dependency)
################################################################################

variable "repository_urls" {
  description = "Map of service name to ECR repository URL"
  type        = map(string)
}

################################################################################
# Optional overrides
################################################################################

variable "capacity_provider_name" {
  description = "ECS capacity provider name"
  type        = string
  default     = "ec2-ondemand"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "log_retention_days" {
  description = "CloudWatch log group retention in days"
  type        = number
  default     = 30
}
