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
  description = "Private subnet IDs for DB subnet group and Lambda (from base-data)"
  type        = list(string)
}

variable "vpc_cidr" {
  description = "VPC CIDR block — used for RDS security group ingress"
  type        = string
  default     = "10.0.0.0/16"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Name of the database to create on the RDS instance"
  type        = string
  default     = "social_media_db"
}

variable "master_username" {
  description = "Master username for the RDS instance"
  type        = string
  default     = "postgres"
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot on deletion"
  type        = bool
  default     = true
}

variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

