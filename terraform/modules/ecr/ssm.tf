################################################################################
# SSM Parameters - repository URL per service
################################################################################

resource "aws_ssm_parameter" "repo_url" {
  for_each = toset(var.services)

  name  = "/app/ecr-${each.key}-url"
  type  = "String"
  value = aws_ecr_repository.this[each.key].repository_url

  tags = {
    Name    = "${var.project}-${var.environment}-ecr-${each.key}-url"
    Service = each.key
  }
}

