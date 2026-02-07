variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "role_name" {
  description = "Name of the IAM role for GitHub Actions"
  type        = string
  default     = "github-actions-role-terraform"
}

variable "github_repositories" {
  description = "List of GitHub repositories allowed to assume the role"
  type        = list(string)
  default = [
    "repo:hari328/backend-patterns-ts:*"
  ]
}

