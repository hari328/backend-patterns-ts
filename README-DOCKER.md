# Docker Setup Guide

## What's Included

- **recommender-service**: Your Node.js/Express app with SQS integration
- **LocalStack**: Local AWS services (SQS, S3, DynamoDB)

## Prerequisites

- Docker installed
- Docker Compose installed

## Quick Start

### 1. Install Dependencies

First, install the AWS SDK dependency:

```bash
npm install
```

### 2. Build and Run

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode (background)
docker-compose up -d --build
```

### 3. Verify Services

**Check recommender-service:**
```bash
curl http://localhost:7000/health
```

**Check LocalStack:**
```bash
curl http://localhost:4566/_localstack/health
```

## Using the API

### Send a Recommendation Request (to SQS)

```bash
curl -X POST http://localhost:7000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "itemId": "item456"}'
```

### Receive Messages from SQS

```bash
curl http://localhost:7000/api/messages
```

### Health Check

```bash
curl http://localhost:7000/health
```

## Working with LocalStack SQS Directly

### Install AWS CLI (if not installed)

```bash
brew install awscli  # macOS
# or
pip install awscli
```

### List Queues

```bash
aws --endpoint-url=http://localhost:4566 sqs list-queues
```

### Send Message Directly to Queue

```bash
aws --endpoint-url=http://localhost:4566 sqs send-message \
  --queue-url http://localhost:4566/000000000000/recommendations-queue \
  --message-body '{"test": "message"}'
```

### Receive Messages

```bash
aws --endpoint-url=http://localhost:4566 sqs receive-message \
  --queue-url http://localhost:4566/000000000000/recommendations-queue
```

## Useful Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f recommender-service
docker-compose logs -f localstack
```

### Stop Services

```bash
docker-compose down
```

### Rebuild After Code Changes

```bash
docker-compose up --build
```

### Reset Everything (including volumes)

```bash
docker-compose down -v
rm -rf localstack-data
docker-compose up --build
```

## Development Workflow

1. Make changes to `apps/recommender-service/src/index.ts`
2. Rebuild: `docker-compose up --build`
3. Test your changes

## Ports

- **7000**: Recommender Service API
- **4566**: LocalStack (all AWS services)

## Environment Variables

Configured in `docker-compose.yml`:

- `AWS_REGION=us-east-1`
- `AWS_ACCESS_KEY_ID=test`
- `AWS_SECRET_ACCESS_KEY=test`
- `AWS_ENDPOINT=http://localstack:4566`

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 7000
lsof -ti:7000 | xargs kill -9

# Kill process on port 4566
lsof -ti:4566 | xargs kill -9
```

### LocalStack Not Ready

Wait a few seconds after `docker-compose up` for LocalStack to fully initialize.

### Cannot Connect to SQS

Make sure LocalStack is running:
```bash
docker-compose ps
```

Both services should show "Up" status.

## Next Steps

- Create an SQS consumer service to process messages
- Add more AWS services (S3, DynamoDB) in docker-compose.yml
- Implement message processing patterns (retry, DLQ, etc.)

