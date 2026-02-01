terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Simple data source to test AWS connection
# This doesn't create anything, just reads your AWS account info
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

# Output to verify connection works
output "account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "caller_arn" {
  description = "ARN of the caller (the GitHub Actions role)"
  value       = data.aws_caller_identity.current.arn
}

output "region" {
  description = "AWS Region"
  value       = data.aws_region.current.name
}

