include "root" {
  path = find_in_parent_folders()
}

terraform {
  source = "../../../modules/ecr"
}

inputs = {
  project     = "hari328"
  environment = "stage"
  services    = ["posts-service", "recommender-service"]
}

