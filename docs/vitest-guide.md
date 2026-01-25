# Vitest Unit Testing Guide

## Overview

This guide shows you how to write unit tests for the SQS consumer using Vitest.

## Setup

### 1. Install Vitest

```bash
cd packages/sqs-consumer
npm install -D vitest @vitest/ui
```

### 2. Add Test Script to package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run"
  }
}
```

### 3. Create vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

---

## Mocking AWS SDK

### Key Concept: Mock the SQSClient

The AWS SDK v3 uses a command pattern:
```typescript
const client = new SQSClient({ ... });
const response = await client.send(new ReceiveMessageCommand({ ... }));
```

We need to mock the `send` method to return fake responses.

### Approach 1: Mock the Entire Module

```typescript
import { vi } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';

// Mock the AWS SDK module
vi.mock('@aws-sdk/client-sqs', () => {
  const mockSend = vi.fn();
  
  return {
    SQSClient: vi.fn(() => ({
      send: mockSend
    })),
    ReceiveMessageCommand: vi.fn(),
    DeleteMessageBatchCommand: vi.fn(),
  };
});
```

### Approach 2: Mock Instance Methods (Recommended)

```typescript
import { vi } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';

// Create a mock send function
const mockSend = vi.fn();

// Mock the SQSClient constructor
vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);
```

---

## Example Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SQSConsumer, MessageHandler } from '../src/sqs-consumer';
import { RetryException, FailureException } from '../src/exceptions';

describe('SQSConsumer', () => {
  let mockSend: any;
  let mockHandler: MessageHandler;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create mock send function
    mockSend = vi.fn();
    vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);
    
    // Create mock handler
    mockHandler = {
      handle: vi.fn()
    };
  });
  
  afterEach(() => {
    // Restore original implementations
    vi.restoreAllMocks();
  });
  
  it('should process and delete successful messages', async () => {
    // Test implementation...
  });
});
```

---

## Mocking SQS Responses

### Mock ReceiveMessageCommand Response

```typescript
mockSend.mockResolvedValueOnce({
  Messages: [
    {
      MessageId: '123',
      ReceiptHandle: 'receipt-123',
      Body: JSON.stringify({ postId: '1', content: 'Hello' })
    }
  ]
});
```

### Mock DeleteMessageBatchCommand Response

```typescript
mockSend.mockResolvedValueOnce({
  Successful: [{ Id: '0' }],
  Failed: []
});
```

### Mock Multiple Calls

```typescript
// First call: ReceiveMessage returns messages
mockSend.mockResolvedValueOnce({
  Messages: [{ MessageId: '123', ReceiptHandle: 'receipt-123', Body: '{}' }]
});

// Second call: DeleteMessageBatch succeeds
mockSend.mockResolvedValueOnce({
  Successful: [{ Id: '0' }]
});

// Third call: ReceiveMessage returns empty (stop polling)
mockSend.mockResolvedValueOnce({
  Messages: []
});
```

---

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with UI
npm run test:ui
```

