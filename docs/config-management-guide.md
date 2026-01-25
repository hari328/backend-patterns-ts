# Configuration Management Guide

## Overview

This guide explains our configuration management pattern using environment variables, TypeScript validation, and reusable config validators.

## The Pattern

```
.env files → process.env → Zod validation → Type-safe config
```

### Two Separate Concerns

1. **`.env` files** = **Storage** (where values live in development)
2. **TypeScript validators** = **Validation + Types + defaults** (ensures values are correct)

---

## Reusable Config Validators

Let's take an example and try to understand how to use it.

* packages expose the validator functions and types for the config, and add default keys.
* services should have env.ts which will use these validators to validate the config.
* then services can use it as needed.


### The `@repo/sqs-consumer` Package

We've created a shared package that provides reusable SQS queue configuration validation.

**Location:** `packages/sqs-consumer/src/config.ts`

**What it provides:**
- `createSQSQueueConfig()` - Validation function
- Type exports for all config types
- Sensible defaults for optional settings
- Support for multiple queues per service

### How to Use in Services

#### 1. Import the validator

```typescript
import { createSQSQueueConfig } from '@repo/sqs-consumer';
```

#### 2. Use it in your `env.ts`

```typescript
// apps/your-service/src/config/env.ts
import dotenv from 'dotenv';
import { z } from 'zod';
import { createSQSQueueConfig } from '@repo/sqs-consumer';

// Load .env files
if (process.env.NODE_ENV === 'development') {
  dotenv.config();
}

// Define your service-specific config
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().positive().default(6000),
  AWS_REGION: z.string().default('us-east-1'),
  // ... other service config
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);

// SQS Queue Configurations using the shared validator
export const postsStreamQueueConfig = createSQSQueueConfig(
  process.env,
  'SQS_POSTS_STREAM'
);

export const notificationsQueueConfig = createSQSQueueConfig(
  process.env,
  'SQS_NOTIFICATIONS'
);
```

#### 3. Set environment variables

**Minimal `.env` (only required fields):**
```bash
SQS_POSTS_STREAM_QUEUE_URL=http://localhost:4566/000000000000/posts-stream
```

**With optional features:**
```bash
# Required
SQS_POSTS_STREAM_QUEUE_URL=http://localhost:4566/000000000000/posts-stream

# Optional: Basic settings (have defaults)
SQS_POSTS_STREAM_MAX_MESSAGES=10
SQS_POSTS_STREAM_WAIT_TIME_SECONDS=20
SQS_POSTS_STREAM_VISIBILITY_TIMEOUT=30
SQS_POSTS_STREAM_PROCESSING_MODE=serial

# Optional: Enable double buffer
SQS_POSTS_STREAM_DOUBLE_BUFFER_ENABLED=true
SQS_POSTS_STREAM_DOUBLE_BUFFER_FLUSH_INTERVAL_MS=10000

# Optional: Enable retry
SQS_POSTS_STREAM_RETRY_ENABLED=true
SQS_POSTS_STREAM_RETRY_STRATEGY=exponential
SQS_POSTS_STREAM_RETRY_MAX_RETRIES=3
```

#### 4. Use the validated config

```typescript
import { postsStreamQueueConfig } from './config/env';

// All properties are typed and validated!
console.log(postsStreamQueueConfig.queueUrl); // string
console.log(postsStreamQueueConfig.maxNumberOfMessages); // number
console.log(postsStreamQueueConfig.processingMode); // 'parallel' | 'serial'

if (postsStreamQueueConfig.doubleBuffer?.enabled) {
  // TypeScript knows this is DoubleBufferConfigType
  console.log(postsStreamQueueConfig.doubleBuffer.flushIntervalMs);
}
```

---

## Why This Pattern?

### ✅ Benefits

| Benefit | Description |
|---------|-------------|
| **Type Safety** | TypeScript knows exact types (e.g., `PORT` is `number`, not `string \| undefined`) |
| **Runtime Validation** | Catches missing/invalid config at startup, not during runtime |
| **Environment Agnostic** | Same code works in dev (`.env`) and production (platform env vars) |
| **No Secrets in Code** | `.env` is gitignored, production uses secure secret management |
| **Developer Experience** | Autocomplete, type checking, refactoring support |
| **Fail Fast** | Application won't start with invalid configuration |

### ❌ Without Validation

```typescript
// Dangerous! No validation
const port = process.env.PORT; // Type: string | undefined
const maxRetries = process.env.MAX_RETRIES; // Type: string | undefined

// Runtime errors waiting to happen:
server.listen(port); // Error: port might be undefined or invalid
for (let i = 0; i < maxRetries; i++) {} // Error: can't iterate over string
```

### ✅ With Validation

```typescript
// Safe! Validated and typed
import { env } from './config/env';

const port = env.PORT; // Type: number (guaranteed valid)
const maxRetries = env.MAX_RETRIES; // Type: number (guaranteed valid)

server.listen(port); // ✅ Works
for (let i = 0; i < maxRetries; i++) {} // ✅ Works
```

---

## How Validations Help

### 1. **Catch Errors Early**

Without validation, errors happen at runtime:
```typescript
// No validation - fails when processing messages
const maxMessages = parseInt(process.env.MAX_MESSAGES); // NaN if invalid
// ... later in code ...
for (let i = 0; i < maxMessages; i++) {} // Infinite loop!
```

With validation, errors happen at startup:
```typescript
// With validation - fails immediately on startup
const config = createSQSQueueConfig(process.env, 'SQS_POSTS');
// ❌ Error: Invalid SQS queue configuration for prefix 'SQS_POSTS':
//    maxNumberOfMessages: Expected number, received nan
```

### 2. **Type Safety Throughout Codebase**

```typescript
function processMessages(config: SQSQueueConfig) {
  // TypeScript knows exact types
  const client = new SQSClient({ region: 'us-east-1' });
  
  client.send(new ReceiveMessageCommand({
    QueueUrl: config.queueUrl, // ✅ string
    MaxNumberOfMessages: config.maxNumberOfMessages, // ✅ number (1-10)
    WaitTimeSeconds: config.waitTimeSeconds, // ✅ number (0-20)
  }));
}
```

### 3. **Self-Documenting Code**

The Zod schema serves as documentation:
```typescript
maxNumberOfMessages: z.coerce.number().min(1).max(10).default(10)
// Tells developers:
// - Must be a number
// - Range: 1-10
// - Default: 10
```

### 4. **Prevents Configuration Drift**

All services use the same validator = consistent configuration across services.

---

## Production Deployment

In production, environment variables come from your deployment platform, not `.env` files:

**AWS ECS:**
```json
{
  "environment": [
    { "name": "SQS_POSTS_STREAM_QUEUE_URL", "value": "https://sqs.us-east-1.amazonaws.com/..." }
  ]
}
```

**Docker:**
```dockerfile
ENV SQS_POSTS_STREAM_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
```

**The same validation code works in both environments!**

