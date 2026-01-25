# SQS Exception Handling Guide

## Overview

The `@repo/sqs-consumer` package provides two custom exceptions for controlling message retry behavior in your SQS message handlers.

## Exception Types

### 1. `RetryException`

**When to use:** Transient errors that might succeed on retry.

**Behavior:** 
- Message is **NOT deleted** from the queue
- Message becomes visible again after the visibility timeout
- SQS will redeliver the message for retry

**Examples:**
- Database connection failures
- API rate limiting
- Temporary network issues
- Service unavailable errors

```typescript
import { RetryException } from '@repo/sqs-consumer';

// Example: Database connection failed
throw new RetryException('Database connection failed, will retry');

// Example: With cause
throw new RetryException('Rate limited', originalError);
```

---

### 2. `FailureException`

**When to use:** Permanent failures that won't succeed even with retries.

**Behavior:**
- Message is **deleted** from the queue
- Message will **NOT be retried**
- Use for malformed data or business logic failures

**Examples:**
- Invalid JSON format
- Missing required fields
- Invalid data that violates business rules
- Resource not found (404)

```typescript
import { FailureException } from '@repo/sqs-consumer';

// Example: Malformed message
throw new FailureException('Invalid JSON in message body');

// Example: Missing required field
throw new FailureException('Missing required field: postId');

// Example: With cause
throw new FailureException('Invalid message format', parseError);
```

---

### 3. Other Exceptions

**Behavior:**
- Message is **NOT deleted** from the queue
- Message becomes visible again after the visibility timeout
- Treated the same as `RetryException`

**When it happens:**
- Any unhandled error
- Standard JavaScript errors
- Unexpected exceptions

---

## Usage Example

```typescript
import type { Message } from '@aws-sdk/client-sqs';
import { RetryException, FailureException } from '@repo/sqs-consumer';

export async function handleMessage(message: Message): Promise<void> {
  // Parse message
  if (!message.Body) {
    throw new FailureException('Message body is empty');
  }

  let data: any;
  try {
    data = JSON.parse(message.Body);
  } catch (error) {
    // Malformed JSON - permanent failure
    throw new FailureException('Invalid JSON', error as Error);
  }

  // Validate required fields
  if (!data.userId) {
    // Missing field - permanent failure
    throw new FailureException('Missing userId');
  }

  // Call external API
  try {
    await externalAPI.processUser(data.userId);
  } catch (error) {
    if (error.statusCode === 429) {
      // Rate limited - retry later
      throw new RetryException('Rate limited, will retry');
    } else if (error.statusCode === 404) {
      // User not found - permanent failure
      throw new FailureException('User not found');
    } else if (error.statusCode >= 500) {
      // Server error - retry
      throw new RetryException('Server error, will retry');
    } else {
      // Client error - permanent failure
      throw new FailureException('Client error', error);
    }
  }
}
```

---

## Decision Tree

```
Error occurred
    │
    ├─ Is the data malformed/invalid?
    │  └─ YES → FailureException (delete message)
    │
    ├─ Is it a transient error (network, rate limit, etc.)?
    │  └─ YES → RetryException (retry message)
    │
    ├─ Is the resource permanently missing (404)?
    │  └─ YES → FailureException (delete message)
    │
    └─ Unsure?
       └─ Let it throw → Default retry behavior
```

---

## Best Practices

### 1. **Be Explicit**
Use the specific exception that matches your intent. Don't rely on default behavior.

### 2. **Include Context**
Always include a descriptive message explaining why the exception was thrown.

```typescript
// ❌ Bad
throw new FailureException('Error');

// ✅ Good
throw new FailureException('Missing required field: postId');
```

### 3. **Chain Errors**
Pass the original error as the `cause` parameter for better debugging.

```typescript
try {
  await someOperation();
} catch (error) {
  throw new RetryException('Operation failed', error as Error);
}
```

### 4. **Validate Early**
Check for permanent failures (malformed data, missing fields) before doing expensive operations.

```typescript
// ✅ Good - validate first
if (!data.userId) {
  throw new FailureException('Missing userId');
}
await expensiveDatabaseOperation(data.userId);
```

### 5. **Use Dead Letter Queues**
Configure a DLQ for messages that fail repeatedly. After max retries, SQS will move them to the DLQ.

---

## Logging

The SQS consumer logs different messages for each exception type:

- **RetryException**: `🔄 Retry requested for message {id}: {message}`
- **FailureException**: `💀 Permanent failure for message {id}: {message}`
- **Other errors**: `❌ Error processing message {id}: {error}`

This helps you monitor and debug message processing issues.

