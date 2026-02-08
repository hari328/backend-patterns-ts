output "queue_url" {
  description = "URL of the main SQS queue"
  value       = aws_sqs_queue.main.url
}

output "queue_arn" {
  description = "ARN of the main SQS queue"
  value       = aws_sqs_queue.main.arn
}

output "dlq_url" {
  description = "URL of the dead letter queue"
  value       = aws_sqs_queue.dlq.url
}

output "dlq_arn" {
  description = "ARN of the dead letter queue"
  value       = aws_sqs_queue.dlq.arn
}

output "queue_ssm_url_arn" {
  description = "ARN of the SSM parameter storing the queue URL"
  value       = aws_ssm_parameter.queue_url.arn
}

output "queue_ssm_arn_arn" {
  description = "ARN of the SSM parameter storing the queue ARN"
  value       = aws_ssm_parameter.queue_arn.arn
}

