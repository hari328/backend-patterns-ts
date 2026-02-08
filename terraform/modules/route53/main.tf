# Look up ALB to get its zone_id and dns_name
data "aws_lb" "alb" {
  arn = var.alb_arn
}

# Alias record: api.hari328.net -> ALB
resource "aws_route53_record" "api" {
  zone_id = var.hosted_zone_id
  name    = "${var.subdomain}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = data.aws_lb.alb.dns_name
    zone_id                = data.aws_lb.alb.zone_id
    evaluate_target_health = true
  }
}

