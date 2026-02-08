include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/ecs-services"
}

dependency "base_data" {
  config_path = "../base-data"
}

dependency "ecr" {
  config_path = "../ecr"
}

dependency "rds" {
  config_path = "../rds"
}

dependency "sqs" {
  config_path = "../sqs"
}

dependency "elasticache" {
  config_path = "../elasticache"
}

inputs = {
  project               = "hari328"
  environment           = "stage"
  vpc_id                = dependency.base_data.outputs.vpc_id
  private_subnet_ids    = dependency.base_data.outputs.private_subnet_ids
  cluster_arn           = dependency.base_data.outputs.cluster_arn
  alb_listener_arn      = dependency.base_data.outputs.alb_listener_arn
  alb_security_group_id = dependency.base_data.outputs.alb_security_group_id
  repository_urls       = dependency.ecr.outputs.repository_urls

  services = {
    "posts-service" = {
      container_port    = 3000
      cpu               = 256
      memory            = 512
      desired_count     = 0
      path_patterns     = ["/api/posts/*"]
      health_check_path = "/health"
      priority          = 100
      environment = {
        NODE_ENV   = "production"
        PORT       = "3000"
        AWS_REGION = "us-east-1"
      }
      ssm_secrets = {
        DATABASE_URL               = "/app/db-readwrite-url"
        SQS_POSTS_STREAM_QUEUE_URL = "/app/sqs-posts-stream-url"
      }
      sqs_publish_arns = [dependency.sqs.outputs.queue_arn]
      sqs_consume_arns = []
    }

    "recommender-service" = {
      container_port    = 6000
      cpu               = 256
      memory            = 512
      desired_count     = 0
      path_patterns     = ["/api/hashtags/*"]
      health_check_path = "/health"
      priority          = 200
      environment = {
        NODE_ENV   = "production"
        PORT       = "6000"
        AWS_REGION = "us-east-1"
      }
      ssm_secrets = {
        DATABASE_URL               = "/app/db-readwrite-url"
        SQS_POSTS_STREAM_QUEUE_URL = "/app/sqs-posts-stream-url"
        REDIS_URL                  = "/app/redis-url"
      }
      sqs_publish_arns = []
      sqs_consume_arns = [dependency.sqs.outputs.queue_arn]
    }
  }
}
