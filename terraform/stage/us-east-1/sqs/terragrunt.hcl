include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/sqs"
}

inputs = {
  project     = "hari328"
  environment = "stage"
}

