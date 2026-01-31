# Backend Patterns TypeScript

![CI](https://github.com/hari328/backend-patterns-ts/workflows/CI/badge.svg)

A TypeScript monorepo demonstrating backend patterns including event-driven architecture, SQS message processing, and microservices communication.

## Overview

This project showcases a social media platform backend with two main services:

1. **Posts Service** - REST API for creating and managing posts
2. **Recommender Service** - Event-driven service that processes posts and tracks hashtag usage

### Key Features

- **Event-Driven Architecture**: Services communicate via AWS SQS (LocalStack for local development)
- **Snowflake IDs**: Distributed unique ID generation for database records
- **Hashtag Extraction & Counting**: Automatic hashtag extraction from posts with usage tracking
- **Microservices Pattern**: Independent services with clear boundaries
- **Type-Safe**: 100% TypeScript with strict type checking

## Architecture

```
┌─────────────────┐         SQS Queue          ┌──────────────────────┐
│  Posts Service  │────────────────────────────▶│ Recommender Service  │
│   (Port 6001)   │   post-stream messages     │    (Port 6000)       │
└─────────────────┘                             └──────────────────────┘
        │                                                  │
        │                                                  │
        ▼                                                  ▼
   PostgreSQL (Port 7732)                          PostgreSQL (Port 7732)
   - posts table                                   - hashtags table
   - users table                                   - post_hashtags table
```

### How It Works

1. **Create a Post**: User creates a post via Posts Service REST API
2. **Publish Event**: Posts Service publishes a message to SQS `post-stream` queue
3. **Process Event**: Recommender Service consumes the message from SQS
4. **Extract Hashtags**: Service extracts hashtags from post caption (e.g., `#nodejs`, `#typescript`)
5. **Update Counts**: Increments usage count for each hashtag in the database
6. **Query Top Hashtags**: Retrieve trending hashtags via REST API

## What's Inside?

### Apps

- **`apps/posts-service`** - Express.js REST API for post management
  - Create posts with captions
  - Publishes events to SQS
  - Port: 6001

- **`apps/recommender-service`** - Event-driven hashtag processor
  - SQS consumer for post events
  - Hashtag extraction and counting
  - REST API for top hashtags
  - Port: 6000

- **`apps/integration-tests`** - End-to-end integration tests
  - Tests full flow: Create post → SQS → Process → Database → API

### Packages

- **`@repo/database`** - Shared database utilities
  - Drizzle ORM schemas
  - Snowflake ID generator
  - Database migrations

- **`@repo/sqs-consumer`** - Reusable SQS consumer library
  - Message polling and processing
  - Error handling and retries
  - Graceful shutdown

- **`@repo/types`** - Shared TypeScript types
- **`@repo/eslint-config`** - Shared ESLint configuration
- **`@repo/typescript-config`** - Shared TypeScript configuration

## Core Concepts

### 1. SQS Consumer

The `@repo/sqs-consumer` package provides a reusable SQS message consumer:

```typescript
import { SQSConsumer } from '@repo/sqs-consumer';

const consumer = new SQSConsumer({
  queueUrl: process.env.SQS_POSTS_STREAM_QUEUE_URL,
  handleMessage: async (message) => {
    const event = JSON.parse(message.Body);
    await processPost(event);
  },
});

await consumer.start();
```

**Features:**
- Automatic message polling
- Configurable batch size and wait time
- Error handling with retries
- Graceful shutdown support

### 2. Snowflake IDs

Distributed unique ID generation using Twitter's Snowflake algorithm:

```typescript
import { generateSnowflakeId } from '@repo/database';

const postId = generateSnowflakeId();
// => "275981361922183169"
```

**Benefits:**
- Time-ordered IDs (sortable by creation time)
- No database round-trip needed
- 64-bit integers (BIGINT in PostgreSQL)
- Unique across distributed systems

**Storage:**
- Database: `BIGINT` (8 bytes)
- TypeScript: `string` (avoids JSON serialization issues)

## Getting Started

### Prerequisites

- Node.js >= 18 (tested on v23.11.0)
- Docker & Docker Compose
- npm >= 10

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend-patterns-ts

# Install dependencies
npm install
```

## Running Locally

### Quick Start (Docker)

Start all services with a single command:

```bash
docker compose up -d
```

This will automatically:
1. Start PostgreSQL (port 7732), LocalStack (port 4566), and Redis (port 6379)
2. Wait for PostgreSQL to be healthy
3. Run database migrations and seed data
4. Start Posts Service (port 6001) and Recommender Service (port 6000)

View logs:
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f posts-service
docker compose logs -f recommender-service
```

### Alternative: Local Development

If you want to run services locally (outside Docker) for development:

```bash
# 1. Start infrastructure (includes automatic DB initialization)
docker compose up -d postgres localstack redis db-init

# 2. Start services locally
# Terminal 1 - Posts Service
npm run dev --workspace=posts-service

# Terminal 2 - Recommender Service
npm run dev --workspace=recommender-service
```

### Verify Services

```bash
# Posts Service health check
curl http://localhost:6001/health

# Recommender Service health check
curl http://localhost:6000/health
```

## Usage Examples

### 1. Create a Post with Hashtags

```bash
curl -X POST http://localhost:6001/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "caption": "Learning #nodejs and #typescript today! #coding"
  }'
```

**Response:**
```json
{
  "id": "275981361922183169",
  "userId": "123",
  "caption": "Learning #nodejs and #typescript today! #coding",
  "createdAt": "2024-01-31T10:30:00.000Z"
}
```

### 2. Get Top Hashtags

Wait a few seconds for the recommender service to process the message, then:

```bash
# Get top 5 hashtags (default)
curl http://localhost:6000/api/hashtags/top

# Get top 3 hashtags
curl http://localhost:6000/api/hashtags/top?limit=3
```

**Response:**
```json
{
  "hashtags": [
    {
      "id": "275981362000000001",
      "name": "nodejs",
      "usageCount": 42
    },
    {
      "id": "275981362000000002",
      "name": "typescript",
      "usageCount": 38
    },
    {
      "id": "275981362000000003",
      "name": "coding",
      "usageCount": 25
    }
  ],
  "count": 3
}
```

## Testing

### Unit Tests

Run unit tests for a specific service:

```bash
# Posts Service tests
npm run test:run --workspace=posts-service

# Recommender Service tests
npm run test:run --workspace=recommender-service

# SQS Consumer tests
npm run test:run --workspace=@repo/sqs-consumer

# All unit tests
npm run test
```

### Integration Tests

Integration tests verify the entire flow end-to-end:

```bash
# Make sure Docker services are running
docker-compose up -d

# Run integration tests
npm run test:integration
```

**What integration tests cover:**
1. Create posts via Posts Service HTTP API
2. Verify SQS message publishing
3. Wait for Recommender Service to process messages
4. Verify hashtags stored in database
5. Test GET /api/hashtags/top endpoint
6. Verify API response matches database state

## Learn More

- [Turborepo Documentation](https://turborepo.dev/docs)
- [Drizzle ORM](https://orm.drizzle.team/)
- [AWS SQS](https://aws.amazon.com/sqs/)
- [LocalStack](https://localstack.cloud/)
- [Snowflake IDs](https://en.wikipedia.org/wiki/Snowflake_ID)
