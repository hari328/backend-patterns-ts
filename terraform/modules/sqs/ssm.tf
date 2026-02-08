################################################################################
# SSM Parameters - queue URLs and ARNs for downstream consumers
################################################################################

resource "aws_ssm_parameter" "queue_url" {
  name  = "/app/sqs-${var.queue_name}-url"
  type  = "String"
  value = aws_sqs_queue.main.url

  tags = {
    Name = "${var.project}-${var.environment}-sqs-${var.queue_name}-url"
  }
}

resource "aws_ssm_parameter" "queue_arn" {
  name  = "/app/sqs-${var.queue_name}-arn"
  type  = "String"
  value = aws_sqs_queue.main.arn

  tags = {
    Name = "${var.project}-${var.environment}-sqs-${var.queue_name}-arn"
  }
}

resource "aws_ssm_parameter" "dlq_url" {
  name  = "/app/sqs-${var.queue_name}-dlq-url"
  type  = "String"
  value = aws_sqs_queue.dlq.url

  tags = {
    Name = "${var.project}-${var.environment}-sqs-${var.queue_name}-dlq-url"
  }
}

resource "aws_ssm_parameter" "dlq_arn" {
  name  = "/app/sqs-${var.queue_name}-dlq-arn"
  type  = "String"
  value = aws_sqs_queue.dlq.arn

  tags = {
    Name = "${var.project}-${var.environment}-sqs-${var.queue_name}-dlq-arn"
  }
}

