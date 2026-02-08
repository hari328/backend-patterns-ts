include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/base-data"
}

# No inputs needed — this module only reads SSM parameters
inputs = {}

