################################################################################
# Data: current AWS account + region
################################################################################

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.name

  all_ssm_param_arns = distinct(flatten([
    for svc in var.services : [
      for param_name in values(svc.ssm_secrets) :
      "arn:aws:ssm:${local.region}:${local.account_id}:parameter${param_name}"
    ]
  ]))
}

################################################################################
# ALB Target Groups (per service)
################################################################################

resource "aws_lb_target_group" "this" {
  for_each = var.services

  name        = "${var.project}-${var.environment}-${each.key}"
  port        = each.value.container_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = each.value.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}"
    Service = each.key
  }
}

################################################################################
# ALB Listener Rules (per service)
################################################################################

resource "aws_lb_listener_rule" "this" {
  for_each = var.services

  listener_arn = var.alb_listener_arn
  priority     = each.value.priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this[each.key].arn
  }

  condition {
    path_pattern {
      values = each.value.path_patterns
    }
  }

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}"
    Service = each.key
  }
}

################################################################################
# ECS Services (per service) - uses community module
################################################################################

module "ecs_service" {
  source  = "terraform-aws-modules/ecs/aws//modules/service"
  version = "~> 5.0"

  for_each = var.services

  name        = "${var.project}-${var.environment}-${each.key}"
  cluster_arn = var.cluster_arn

  # EC2 launch type (not Fargate)
  launch_type            = "EC2"
  requires_compatibilities = ["EC2"]
  network_mode           = "bridge"

  # CPU / Memory
  cpu    = each.value.cpu
  memory = each.value.memory

  # Capacity provider
  capacity_provider_strategy = {
    main = {
      capacity_provider = var.capacity_provider_name
      weight            = 100
      base              = 1
    }
  }

  # Container definition
  container_definitions = {
    (each.key) = {
      essential = true
      image     = "${var.repository_urls[each.key]}:${var.image_tag}"
      cpu       = each.value.cpu
      memory    = each.value.memory

      port_mappings = [
        {
          containerPort = each.value.container_port
          hostPort      = 0
          protocol      = "tcp"
        }
      ]

      environment = [
        for name, value in each.value.environment : {
          name  = name
          value = value
        }
      ]

      secrets = [
        for env_name, ssm_name in each.value.ssm_secrets : {
          name      = env_name
          valueFrom = "arn:aws:ssm:${local.region}:${local.account_id}:parameter${ssm_name}"
        }
      ]

      log_configuration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.project}-${var.environment}/${each.key}"
          "awslogs-region"        = local.region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  }

  # Load balancer
  load_balancer = {
    service = {
      target_group_arn = aws_lb_target_group.this[each.key].arn
      container_name   = each.key
      container_port   = each.value.container_port
    }
  }

  desired_count = each.value.desired_count

  # Deployment configuration
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  # Do not create a separate SG - we use bridge networking on EC2
  create_security_group = false

  # CloudWatch log group
  service_log_group_name         = "/ecs/${var.project}-${var.environment}/${each.key}"
  service_log_group_retention_in_days = var.log_retention_days

  # IAM - Execution role (ECR pull, logs, SSM read)
  create_task_exec_iam_role = true
  task_exec_ssm_param_arns  = local.all_ssm_param_arns

  # IAM - Task role (SQS permissions for the container)
  create_tasks_iam_role = true
  tasks_iam_role_name   = "${var.project}-${var.environment}-${each.key}-task"
  tasks_iam_role_statements = concat(
    length(each.value.sqs_publish_arns) > 0 ? [{
      actions   = ["sqs:SendMessage"]
      resources = each.value.sqs_publish_arns
    }] : [],
    length(each.value.sqs_consume_arns) > 0 ? [{
      actions = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:ChangeMessageVisibility",
        "sqs:GetQueueAttributes"
      ]
      resources = each.value.sqs_consume_arns
    }] : []
  )

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}"
    Service = each.key
  }
}