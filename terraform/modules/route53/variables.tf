variable "hosted_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
}

variable "alb_arn" {
  description = "ARN of the ALB to look up"
  type        = string
}

variable "subdomain" {
  description = "Subdomain to create (e.g. api)"
  type        = string
  default     = "api"
}

variable "domain_name" {
  description = "Root domain name (e.g. hari328.net)"
  type        = string
}

