include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../../modules/rds"
}

dependency "base_data" {
  config_path = "../../base-data"
}

inputs = {
  project            = "hari328"
  environment        = "stage"
  vpc_id             = dependency.base_data.outputs.vpc_id
  private_subnet_ids = dependency.base_data.outputs.private_subnet_ids
}

