variable "project" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (stage, prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID (from base-data)"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the subnet group (from base-data)"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "VPC CIDR block - used for security group ingress"
  type        = string
  default     = "10.0.0.0/16"
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "engine_version" {
  description = "Redis engine version"
  type        = string
  default     = "7.1"
}

variable "num_cache_nodes" {
  description = "Number of cache nodes (1 for single-node)"
  type        = number
  default     = 1
}

variable "port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

