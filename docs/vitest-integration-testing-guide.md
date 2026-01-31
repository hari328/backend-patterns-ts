# Vitest Integration Testing Guide with Docker Compose

## Overview

Integration tests verify that multiple components work together correctly. Unlike unit tests that mock dependencies, integration tests use **real services** (database, message queues, etc.) running in Docker containers.

---

## Key Differences: Unit Tests vs Integration Tests

| Aspect | Unit Tests | Integration Tests |
|--------|-----------|-------------------|
| **Dependencies** | Mocked (pg-mem, vi.fn()) | Real (PostgreSQL, Redis, LocalStack) |
| **Speed** | Fast (milliseconds) | Slower (seconds) |
| **Isolation** | Complete | Shared services |
| **File naming** | `*.spec.ts` | `*.integration.spec.ts` |
| **Purpose** | Test business logic | Test system integration |

---

## Setup

### 1. Install Required Dependencies

```bash
# Install testcontainers for managing Docker containers in tests
npm install -D testcontainers @testcontainers/postgresql

# Or use the existing docker-compose setup (simpler approach)
```

### 2. Create Separate Vitest Config for Integration Tests

Create `vitest.integration.config.mts`:

```typescript
import { defineConfig } from 'vitest/config';

export defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only run integration tests
    include: ['src/**/*.integration.spec.ts'],
    // Run tests sequentially to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Longer timeout for Docker operations
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### 3. Add Test Scripts to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:integration": "vitest --config vitest.integration.config.mts",
    "test:integration:run": "vitest run --config vitest.integration.config.mts"
  }
}
```

---

## Approach 1: Using Existing Docker Compose (Recommended for Beginners)

This approach uses your existing `docker-compose.yml` services.

### Setup Helper

Create `src/test-utils/integration-test-setup.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@repo/database/schema';

export async function setupIntegrationTest() {
  // Connect to the PostgreSQL running in Docker Compose
  const pool = new Pool({
    host: 'localhost',
    port: 7732, // Your custom port
    database: 'social_media_db',
    user: 'postgres',
    password: 'postgres',
  });

  const db = drizzle(pool, { schema });

  // Clean up function to reset database state between tests
  const cleanup = async () => {
    // Delete all data in reverse order of dependencies
    await db.delete(schema.posts);
    await db.delete(schema.users);
  };

  return { db, pool, cleanup };
}
```

### Example Integration Test

Create `src/repositories/posts.repository.integration.spec.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupIntegrationTest } from '../test-utils/integration-test-setup';
import { PostsRepository } from './posts.repository';
import { users, posts } from '@repo/database/schema';

describe('PostsRepository - Integration Tests', () => {
  let db: any;
  let pool: any;
  let cleanup: () => Promise<void>;
  let repository: PostsRepository;

  beforeAll(async () => {
    // Setup database connection
    const setup = await setupIntegrationTest();
    db = setup.db;
    pool = setup.pool;
    cleanup = setup.cleanup;
    
    repository = new PostsRepository(db);
  });

  afterAll(async () => {
    // Close database connection
    await pool.end();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanup();
  });

  it('should create and retrieve a post', async () => {
    // Seed a user first
    const [user] = await db.insert(users).values({
      id: '274137326815285248',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      isVerified: false,
    }).returning();

    // Create a post
    const post = await repository.createPost({
      userId: user.id,
      caption: 'Integration test post',
    });

    // Verify post was created
    expect(post).toBeDefined();
    expect(post.userId).toBe(user.id);
    expect(post.caption).toBe('Integration test post');

    // Retrieve the post
    const retrievedPost = await repository.findPostById(post.id);
    expect(retrievedPost).toEqual(post);
  });

  it('should find all posts by user', async () => {
    // Seed a user
    const [user] = await db.insert(users).values({
      id: '274137326815285248',
      username: 'testuser',
      email: 'test@example.com',
      fullName: 'Test User',
      isVerified: false,
    }).returning();

    // Create multiple posts
    await repository.createPost({ userId: user.id, caption: 'Post 1' });
    await repository.createPost({ userId: user.id, caption: 'Post 2' });
    await repository.createPost({ userId: user.id, caption: 'Post 3' });

    // Retrieve all posts
    const userPosts = await repository.findPostsByUserId(user.id);

    expect(userPosts).toHaveLength(3);
    expect(userPosts[0].caption).toBe('Post 1');
    expect(userPosts[2].caption).toBe('Post 3');
  });
});
```

---

## Approach 2: Using Testcontainers (Advanced)

Testcontainers automatically starts and stops Docker containers for each test suite.

### Install Testcontainers

```bash
npm install -D testcontainers @testcontainers/postgresql
```

### Setup with Testcontainers

Create `src/test-utils/testcontainers-setup.ts`:

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '@repo/database/schema';

let container: StartedPostgreSqlContainer;
let pool: Pool;
let db: any;

export async function setupTestcontainers() {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('test_db')
    .withUsername('test')
    .withPassword('test')
    .start();

  // Create connection pool
  pool = new Pool({
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  db = drizzle(pool, { schema });

  // Run migrations
  await migrate(db, { migrationsFolder: './drizzle/migrations' });

  return { db, pool, container };
}

export async function teardownTestcontainers() {
  await pool?.end();
  await container?.stop();
}
```

### Example Test with Testcontainers

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestcontainers, teardownTestcontainers } from '../test-utils/testcontainers-setup';
import { PostsRepository } from './posts.repository';
import { users } from '@repo/database/schema';

describe('PostsRepository - Testcontainers', () => {
  let db: any;
  let repository: PostsRepository;

  beforeAll(async () => {
    const setup = await setupTestcontainers();
    db = setup.db;
    repository = new PostsRepository(db);
  });

  afterAll(async () => {
    await teardownTestcontainers();
  });

  beforeEach(async () => {
    // Clean database
    await db.delete(users);
  });

  it('should work with isolated database', async () => {
    // Your test here
  });
});
```

---

## Running Integration Tests

### Prerequisites

```bash
# Start Docker Compose services
docker-compose up -d postgres localstack redis

# Wait for services to be healthy
docker ps
```

### Run Tests

```bash
# Run integration tests in watch mode
npm run test:integration

# Run once
npm run test:integration:run

# Run specific test file
npm run test:integration -- posts.repository.integration.spec.ts
```

---

## Best Practices

### 1. Clean Database Between Tests

```typescript
beforeEach(async () => {
  // Delete in reverse order of foreign key dependencies
  await db.delete(schema.comments);
  await db.delete(schema.posts);
  await db.delete(schema.users);
});
```

### 2. Use Transactions for Faster Tests (Optional)

```typescript
import { sql } from 'drizzle-orm';

beforeEach(async () => {
  await db.execute(sql`BEGIN`);
});

afterEach(async () => {
  await db.execute(sql`ROLLBACK`);
});
```

### 3. Seed Realistic Data

```typescript
// Create a helper for seeding
async function seedUser(db: any, overrides = {}) {
  const [user] = await db.insert(users).values({
    id: generateSnowflakeId(),
    username: 'testuser',
    email: 'test@example.com',
    fullName: 'Test User',
    isVerified: false,
    ...overrides,
  }).returning();

  return user;
}
```

### 4. Test Real Scenarios

```typescript
it('should handle concurrent post creation', async () => {
  const user = await seedUser(db);

  // Create posts concurrently
  const promises = Array.from({ length: 10 }, (_, i) =>
    repository.createPost({
      userId: user.id,
      caption: `Post ${i}`,
    })
  );

  const posts = await Promise.all(promises);
  expect(posts).toHaveLength(10);
});
```

---

## Testing with LocalStack (SQS, S3)

### Setup LocalStack Client

```typescript
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
});
```

### Example SQS Integration Test

```typescript
it('should publish message to SQS', async () => {
  const message = { postId: '123', action: 'created' };

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: 'http://localhost:4566/000000000000/post-stream',
    MessageBody: JSON.stringify(message),
  }));

  // Verify message was sent (you'd need to consume it)
});
```

---

## Troubleshooting

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs postgres

# Verify connection
psql -h localhost -p 7732 -U postgres -d social_media_db
```

### Port Conflicts

```bash
# Check what's using port 7732
lsof -i :7732

# Kill the process if needed
kill -9 <PID>
```

### Slow Tests

- Use `pool: 'forks'` with `singleFork: true` in vitest config
- Clean only necessary tables between tests
- Use transactions for rollback instead of DELETE
- Consider using testcontainers for complete isolation

---

## Summary

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Docker Compose** | Simple, uses existing setup | Manual service management | Getting started |
| **Testcontainers** | Automatic, isolated | Slower startup | CI/CD pipelines |

**Recommendation**: Start with Docker Compose approach, migrate to Testcontainers when you need better isolation or CI/CD integration.



