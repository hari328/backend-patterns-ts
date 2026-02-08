variable "project" {
  description = "Project name prefix"
  type        = string
}

variable "environment" {
  description = "Environment name (stage, prod)"
  type        = string
}

variable "queue_name" {
  description = "Base name for the SQS queue"
  type        = string
  default     = "posts-stream"
}

variable "max_receive_count" {
  description = "Number of receives before a message is sent to the DLQ"
  type        = number
  default     = 3
}

variable "visibility_timeout_seconds" {
  description = "Visibility timeout for the main queue (seconds)"
  type        = number
  default     = 30
}

variable "message_retention_seconds" {
  description = "How long messages are retained in the queue (seconds)"
  type        = number
  default     = 345600 # 4 days
}

variable "dlq_message_retention_seconds" {
  description = "How long messages are retained in the DLQ (seconds)"
  type        = number
  default     = 1209600 # 14 days
}

