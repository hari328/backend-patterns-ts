include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/rds"

  before_hook "build_lambda" {
    commands = ["init", "plan", "apply"]
    execute  = ["bash", "-c", "cd ${get_terragrunt_dir()}/../../../modules/rds/lambda && npm install --omit=dev && cd .. && mkdir -p lambda_dist && cd lambda && zip -r ../lambda_dist/bootstrap.zip . -x '.*'"]
  }
}

dependency "base_data" {
  config_path = "../base-data"
}

inputs = {
  project            = "hari328"
  environment        = "stage"
  vpc_id             = dependency.base_data.outputs.vpc_id
  private_subnet_ids = dependency.base_data.outputs.private_subnet_ids
}

