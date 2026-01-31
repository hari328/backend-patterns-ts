import {
  SQSClient,
  SQSClientConfig,
  ReceiveMessageCommand,
  DeleteMessageBatchCommand,
  ChangeMessageVisibilityCommand,
  Message,
  DeleteMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';
import { IdempotencyStore } from './interfaces/idempotency-store';

export interface MessageMetadata {
  retryCount: number;
  isLastAttempt: boolean;
}

export interface MessageResult {
  status: 'success' | 'retry' | 'fail';
  reason?: string;
}

export interface MessageHandler {
  handle(message: Message, metadata: MessageMetadata): Promise<MessageResult>;
}

export interface SQSConfig {
  queueUrl: string;
  maxNumberOfMessages: number;
  waitTimeSeconds: number;
  visibilityTimeout: number;
  maxReceiveCount?: number; // Optional: Max receive count before message goes to DLQ
}

export interface SQSConsumerConfig {
  sqsConfig: SQSConfig;
  sqsClientConfig?: SQSClientConfig; // Optional AWS client config
  pollIntervalMs?: number; // Time to wait between polls if no messages (default: 1000ms)
  processInParallel?: boolean; // If true, process messages in parallel; if false, process sequentially (default: false)
}

export type TimeUnit = 'ms' | 'sec' | 'min' | 'hour';
export type RetryStrategy = 'exponential' | 'fixed';

export interface SQSConsumerOptions {
  idempotencyStore?: IdempotencyStore;
  idempotencyTtlSeconds?: number; // Default: 86400 (24 hours)
  backoffBaseDelay?: number; // Default: 5
  backoffBaseDelayUnit?: TimeUnit; // Default: 'sec'
  retryStrategy?: RetryStrategy; // Default: 'exponential'
}

export class SQSConsumer {
  private sqsClient: SQSClient;
  private config: SQSConsumerConfig;
  private handler: MessageHandler;
  private idempotencyStore?: IdempotencyStore;
  private idempotencyTtlSeconds: number;
  private backoffBaseDelay: number;
  private backoffBaseDelayUnit: TimeUnit;
  private retryStrategy: RetryStrategy;
  private isRunning = false;

  constructor(config: SQSConsumerConfig, handler: MessageHandler, options?: SQSConsumerOptions) {
    this.config = config;
    this.handler = handler;
    this.idempotencyStore = options?.idempotencyStore;
    this.idempotencyTtlSeconds = options?.idempotencyTtlSeconds ?? 86400; // Default 24 hours
    this.backoffBaseDelay = options?.backoffBaseDelay ?? 5;
    this.backoffBaseDelayUnit = options?.backoffBaseDelayUnit ?? 'sec';
    this.retryStrategy = options?.retryStrategy ?? 'exponential';
    this.sqsClient = new SQSClient(config.sqsClientConfig || {});
  }

  /**
   * Start consuming messages from the queue
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[SQSConsumer] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[SQSConsumer] Starting consumer...');
    console.log(`[SQSConsumer] Queue URL: ${this.config.sqsConfig.queueUrl}`);
    console.log(`[SQSConsumer] Max messages per poll: ${this.config.sqsConfig.maxNumberOfMessages}`);
    console.log(`[SQSConsumer] Wait time: ${this.config.sqsConfig.waitTimeSeconds}s`);
    console.log(`[SQSConsumer] Visibility timeout: ${this.config.sqsConfig.visibilityTimeout}s`);

    // Start polling loop
    this.poll();
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    console.log('[SQSConsumer] Stopping consumer...');
    this.isRunning = false;
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        const messages = await this.receiveMessages();

        if (messages.length > 0) {
          console.log(`[SQSConsumer] Received ${messages.length} message(s)`);
          await this.processMessages(messages);
        } else {
          // No messages, wait before next poll
          await this.sleep(this.config.pollIntervalMs || 1000);
        }
      } catch (error) {
        console.error('[SQSConsumer] Error in poll loop:', error);
        // Wait before retrying
        await this.sleep(5000);
      }
    }
  }

  /**
   * Receive messages from SQS
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.sqsConfig.queueUrl,
      MaxNumberOfMessages: this.config.sqsConfig.maxNumberOfMessages,
      WaitTimeSeconds: this.config.sqsConfig.waitTimeSeconds,
      VisibilityTimeout: this.config.sqsConfig.visibilityTimeout,
      AttributeNames: ['All'],
      MessageAttributeNames: ['All'],
    });

    const response = await this.sqsClient.send(command);
    return response.Messages || [];
  }

  /**
   * Process messages and delete successful ones
   */
  private async processMessages(messages: Message[]): Promise<void> {
    const successfulMessages: Message[] = [];
    const retryMessages: Message[] = [];
    const permanentFailureMessages: Message[] = [];

    // Check if parallel processing is enabled
    const processInParallel = this.config.processInParallel ?? false;

    if (processInParallel) {
      // Parallel processing: Process all messages concurrently
      const results = await Promise.all(
        messages.map(async (message) => ({
          message,
          result: await this.processMessage(message),
        }))
      );

      // Categorize messages
      for (const { message, result } of results) {
        this.categorizeMessage(message, result, successfulMessages, retryMessages, permanentFailureMessages);
      }
    } else {
      // Sequential processing: Process messages one by one
      for (const message of messages) {
        const result = await this.processMessage(message);
        this.categorizeMessage(message, result, successfulMessages, retryMessages, permanentFailureMessages);
      }
    }

    // Delete successful messages
    if (successfulMessages.length > 0) {
      await this.deleteMessages(successfulMessages);
    }

    // Delete permanent failure messages
    if (permanentFailureMessages.length > 0) {
      await this.deleteMessages(permanentFailureMessages);
    }

    // Set visibility timeout for retry messages based on backoff calculation
    if (retryMessages.length > 0) {
      for (const message of retryMessages) {
        try {
          const visibilityTimeoutSeconds = this.calculateVisibilityTimeout(message);
          await this.changeMessageVisibility(message, visibilityTimeoutSeconds);
        } catch (error) {
          console.error(`[SQSConsumer] Failed to set visibility timeout for message ${message.MessageId}:`, error);
          // Continue with next message - this message will retry with default timeout
        }
      }
      console.warn(`[SQSConsumer] ${retryMessages.length} message(s) will be retried`);
    }
  }

  /**
   * Categorize message based on processing result
   */
  private categorizeMessage(
    message: Message,
    result: MessageResult,
    successfulMessages: Message[],
    retryMessages: Message[],
    permanentFailureMessages: Message[]
  ): void {
    if (result.status === 'success') {
      successfulMessages.push(message);
    } else if (result.status === 'retry') {
      retryMessages.push(message);
    } else if (result.status === 'fail') {
      permanentFailureMessages.push(message);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(message: Message): Promise<MessageResult> {
    const messageId = message.MessageId || 'unknown';

    // Check idempotency: Has this message been processed before?
    if (this.idempotencyStore) {
      const alreadyProcessed = await this.idempotencyStore.hasProcessed(messageId);
      if (alreadyProcessed) {
        console.log(`[SQSConsumer] ⏭️  Message ${messageId} already processed, skipping`);
        // Delete it to prevent reprocessing
        return { status: 'success' };
      }
    }

    // Extract metadata from message attributes
    const retryCount = parseInt(message.Attributes?.ApproximateReceiveCount || '0', 10);
    const maxReceiveCount = this.config.sqsConfig.maxReceiveCount;

    const metadata: MessageMetadata = {
      retryCount,
      isLastAttempt: maxReceiveCount !== undefined ? retryCount >= maxReceiveCount : false,
    };

    // Process the message - handler returns result
    const result = await this.handler.handle(message, metadata);

    // Retry: Don't mark in idempotency store (allow reprocessing)
    if (result.status === 'retry') {
      return result;
    }

    // Success or Fail: Mark in idempotency store
    if (this.idempotencyStore) {
      await this.idempotencyStore.markProcessed(messageId, this.idempotencyTtlSeconds);
    }

    // Log based on status
    if (result.status === 'success') {
      console.log(`[SQSConsumer] ✅ Successfully processed message ${messageId}`);
    } else {
      console.error(`[SQSConsumer] 💀 Permanent failure for message ${messageId}${result.reason ? `: ${result.reason}` : ''}`);
    }

    return result;
  }

  /**
   * Convert time value to milliseconds
   */
  private toMilliseconds(value: number, unit: TimeUnit): number {
    switch (unit) {
      case 'ms':
        return value;
      case 'sec':
        return value * 1000;
      case 'min':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
    }
  }

  /**
   * Calculate visibility timeout in seconds for a retry message
   */
  private calculateVisibilityTimeout(message: Message): number {
    const retryCount = parseInt(message.Attributes?.ApproximateReceiveCount || '0', 10);
    const backoffDelayMs = this.calculateBackoffDelay(retryCount);
    return Math.min(Math.floor(backoffDelayMs / 1000), 43200); // Max 12 hours
  }

  /**
   * Calculate backoff delay in milliseconds based on retry count
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelayMs = this.toMilliseconds(this.backoffBaseDelay, this.backoffBaseDelayUnit);

    if (this.retryStrategy === 'fixed') {
      return baseDelayMs;
    }

    // Exponential backoff: baseDelay * 2^retryCount
    return baseDelayMs * Math.pow(2, retryCount);
  }

  /**
   * Change visibility timeout for a message
   */
  private async changeMessageVisibility(message: Message, visibilityTimeoutSeconds: number): Promise<void> {
    if (!message.ReceiptHandle) {
      console.warn('[SQSConsumer] Cannot change visibility: message has no receipt handle');
      return;
    }

    const command = new ChangeMessageVisibilityCommand({
      QueueUrl: this.config.sqsConfig.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
      VisibilityTimeout: visibilityTimeoutSeconds,
    });

    await this.sqsClient.send(command);
  }

  private async deleteMessages(messages: Message[]): Promise<void> {
    const entries: DeleteMessageBatchRequestEntry[] = messages
      .filter((msg) => msg.ReceiptHandle)
      .map((msg, index) => ({
        Id: index.toString(),
        ReceiptHandle: msg.ReceiptHandle!,
      }));

    if (entries.length === 0) {
      return;
    }

    try {
      const command = new DeleteMessageBatchCommand({
        QueueUrl: this.config.sqsConfig.queueUrl,
        Entries: entries,
      });

      await this.sqsClient.send(command);
      console.log(`[SQSConsumer] Deleted ${entries.length} message(s)`);
    } catch (error) {
      console.error('[SQSConsumer] Failed to delete messages:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

