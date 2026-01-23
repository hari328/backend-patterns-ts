#!/bin/bash

echo "Initializing SQS queues..."

# Create post-stream queue
awslocal sqs create-queue --queue-name posts-stream

echo "SQS queues created successfully!"

# List all queues to verify
awslocal sqs list-queues

