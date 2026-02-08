# Root terragrunt.hcl — shared config for all environments
# Uses the same S3 backend bucket as infra-backend-patterns-ts
# but with a different key prefix ("app/") to keep state separate.

locals {
  env_vars    = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))

  environment = local.env_vars.locals.environment
  project     = local.env_vars.locals.project
  aws_region  = local.region_vars.locals.aws_region
  account_id  = local.env_vars.locals.account_id
}

remote_state {
  backend = "s3"
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  config = {
    bucket         = "${local.project}-infra-${local.environment}-tfstate"
    key            = "app/${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "${local.project}-infra-${local.environment}-tflock"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
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
  region = "${local.aws_region}"

  default_tags {
    tags = {
      Project     = "${local.project}"
      Environment = "${local.environment}"
      ManagedBy   = "terragrunt"
      Repo        = "backend-patterns-ts"
    }
  }
}
EOF
}

