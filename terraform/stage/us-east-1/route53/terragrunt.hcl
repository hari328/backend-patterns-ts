include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/route53"
}

dependency "base_data" {
  config_path = "../base-data"
}

inputs = {
  hosted_zone_id = dependency.base_data.outputs.hosted_zone_id
  alb_arn        = dependency.base_data.outputs.alb_arn
  domain_name    = "hari328.net"
  subdomain      = "api"
}

