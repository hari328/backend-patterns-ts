# @repo/sqs-consumer

Shared SQS consumer library for processing messages from AWS SQS queues.

## Installation

This package is part of the monorepo workspace. Add it to your app's dependencies:

```json
{
  "dependencies": {
    "@repo/sqs-consumer": "*"
  }
}
```

## Usage

### SQS Consumer

```typescript
import { SQSConsumer, MessageHandler, Message } from '@repo/sqs-consumer';

// Implement your message handler
class MyMessageHandler implements MessageHandler {
  async handle(message: Message): Promise<void> {
    console.log('Processing message:', message.Body);
    // Your processing logic here
  }
}

// Create and start consumer
const consumer = new SQSConsumer({
  sqsConfig: {
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
    maxNumberOfMessages: 10,
    waitTimeSeconds: 20,
    visibilityTimeout: 30,
  },
  sqsClientConfig: {
    region: 'us-east-1',
    endpoint: 'http://localhost:4566', // For LocalStack
  },
  handler: new MyMessageHandler(),
  pollIntervalMs: 1000,
});

await consumer.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await consumer.stop();
});
```

## Features

- **SQS Consumer**: Long-polling SQS consumer with automatic message deletion
- **Idempotency**: Prevent duplicate message processing with in-memory or Redis stores
- **Backoff Strategies**: Exponential and fixed delay retry strategies
- **TypeScript**: Full type safety with exported types
- **AWS SDK v3**: Uses latest AWS SDK for JavaScript

## Dependencies

- `@aws-sdk/client-sqs`: AWS SDK for SQS operations

