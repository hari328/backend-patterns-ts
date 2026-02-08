################################################################################
# ECR Repositories - one per service
################################################################################

resource "aws_ecr_repository" "this" {
  for_each = toset(var.services)

  name                 = "${var.project}-${var.environment}-${each.key}"
  image_tag_mutability = var.image_tag_mutability
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name    = "${var.project}-${var.environment}-${each.key}"
    Service = each.key
  }
}

################################################################################
# Lifecycle Policy - keep last N images, expire untagged after 1 day
################################################################################

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = toset(var.services)

  repository = aws_ecr_repository.this[each.key].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last ${var.max_image_count} tagged images"
        selection = {
          tagStatus   = "tagged"
          tagPrefixList = ["v", "latest", "sha-"]
          countType   = "imageCountMoreThan"
          countNumber = var.max_image_count
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

