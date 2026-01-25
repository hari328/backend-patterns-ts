/**
 * @repo/sqs-consumer
 *
 * Shared SQS consumer library for processing messages from AWS SQS queues
 */

// Export SQS Consumer
export { SQSConsumer } from './sqs-consumer';
export type { SQSConsumerConfig, SQSConfig, MessageHandler, MessageMetadata } from './sqs-consumer';

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

