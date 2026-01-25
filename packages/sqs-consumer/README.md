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

### Double Buffer

```typescript
import { DoubleBuffer } from '@repo/sqs-consumer';

// Create a flush callback
const flushCallback = async (data: Map<string, number>) => {
  console.log('Flushing data to database:', data);
  // Your database write logic here
};

// Create and start buffer
const buffer = new DoubleBuffer<number>(
  {
    flushIntervalMs: 10000, // Flush every 10 seconds
    maxBufferSize: 1000,    // Or when buffer reaches 1000 items
  },
  flushCallback
);

buffer.start();

// Add data
buffer.set('key1', 100);
buffer.update('key2', 50, (prev, curr) => prev + curr);

// Graceful shutdown
await buffer.stop();
```

## Features

- **SQS Consumer**: Long-polling SQS consumer with automatic message deletion
- **Double Buffer**: Non-blocking batch write pattern for high-throughput scenarios
- **TypeScript**: Full type safety with exported types
- **AWS SDK v3**: Uses latest AWS SDK for JavaScript

## Dependencies

- `@aws-sdk/client-sqs`: AWS SDK for SQS operations

