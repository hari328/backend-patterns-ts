################################################################################
# Dead Letter Queue
################################################################################

resource "aws_sqs_queue" "dlq" {
  name                      = "${var.project}-${var.environment}-${var.queue_name}-dlq"
  message_retention_seconds = var.dlq_message_retention_seconds

  tags = {
    Name = "${var.project}-${var.environment}-${var.queue_name}-dlq"
  }
}

################################################################################
# Main Queue
################################################################################

resource "aws_sqs_queue" "main" {
  name                       = "${var.project}-${var.environment}-${var.queue_name}"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = {
    Name = "${var.project}-${var.environment}-${var.queue_name}"
  }
}

