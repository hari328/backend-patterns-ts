# GitHub Actions notes

Github actions consists of workflows.

each workflow has

1. triggers
2. jobs
    1. job runs on a runner which is the VM provided by github

## actions
each job has some work to do like checkout code run this that, github created a respositry of resuable functionality they are called actions.

they look like
@actions/checkout@v4

mostly we use actions but we can also use containers to run our custom logic.

## services

some things are not available as actions like starting a postgres db, for that we use services.

## environment

we use environments for two things
    1. manual approval
    2. secrets


## secrets
1. we need to configure these to be used in workflow no one can directly see them.


github actions can be used to do tf deploys also.