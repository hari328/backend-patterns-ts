output "repository_urls" {
  description = "Map of service name to ECR repository URL"
  value       = { for service in var.services : service => aws_ecr_repository.this[service].repository_url }
}

output "repository_arns" {
  description = "Map of service name to ECR repository ARN"
  value       = { for service in var.services : service => aws_ecr_repository.this[service].arn }
}

output "ssm_repo_url_arns" {
  description = "Map of service name to SSM parameter ARN for the repo URL"
  value       = { for service in var.services : service => aws_ssm_parameter.repo_url[service].arn }
}

