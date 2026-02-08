variable "project" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (stage, prod)"
  type        = string
}

variable "services" {
  description = "List of service names - one ECR repository per service"
  type        = list(string)
}

variable "image_tag_mutability" {
  description = "Tag mutability setting for the repositories"
  type        = string
  default     = "MUTABLE"
}

variable "max_image_count" {
  description = "Number of images to keep per repository (lifecycle policy)"
  type        = number
  default     = 10
}

