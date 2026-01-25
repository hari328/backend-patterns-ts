#!/bin/bash

echo "Initializing SQS queues..."

# Create post-stream queue with visibility timeout
awslocal sqs create-queue \
  --queue-name post-stream \
  --attributes VisibilityTimeout=30

echo "SQS queues created successfully!"

# List all queues to verify
awslocal sqs list-queues

