/**
 * @repo/sqs-consumer
 *
 * Shared SQS consumer library for processing messages from AWS SQS queues
 */

// Export SQS Consumer
export { SQSConsumer } from './sqs-consumer';
export type { SQSConsumerConfig, SQSConsumerOptions, SQSConfig, MessageHandler, MessageMetadata } from './sqs-consumer';

// Export Idempotency
export type { IdempotencyStore } from './interfaces/idempotency-store';
export { InMemoryIdempotencyStore } from './stores/in-memory-idempotency-store';
export { RedisIdempotencyStore } from './stores/redis-idempotency-store';

// Export Backoff
export type { BackoffStore, RetryStrategy } from './interfaces/backoff-store';
export { InMemoryBackoffStore } from './stores/in-memory-backoff-store';
export { RedisBackoffStore } from './stores/redis-backoff-store';
export type { TimeUnit } from './stores/in-memory-backoff-store';

// Export Double Buffer
export { DoubleBuffer } from './double-buffer';
export type { DoubleBufferConfig, FlushCallback } from './double-buffer';

// Export Config and Validator
export { createSQSQueueConfig } from './config';
export type {
  SQSQueueConfig,
  DoubleBufferConfigType,
  RetryConfigType,
  IdempotencyConfigType,
  DeadLetterQueueConfigType,
} from './config';

// Export Exceptions
export { RetryException, FailureException } from './exceptions';

// Re-export AWS SDK types that consumers might need
export type { Message } from '@aws-sdk/client-sqs';

