import {
  SQSClient,
  SQSClientConfig,
  ReceiveMessageCommand,
  DeleteMessageBatchCommand,
  Message,
  DeleteMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';
import { RetryException, FailureException } from './exceptions';

export interface MessageMetadata {
  retryCount: number;
  isLastAttempt: boolean;
}

export interface MessageHandler {
  handle(message: Message, metadata: MessageMetadata): Promise<void>;
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

export class SQSConsumer {
  private sqsClient: SQSClient;
  private config: SQSConsumerConfig;
  private handler: MessageHandler;
  private isRunning = false;
  private messagesProcessed = 0;
  private messagesFailed = 0;

  constructor(config: SQSConsumerConfig, handler: MessageHandler) {
    this.config = config;
    this.handler = handler;
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
    console.log(`[SQSConsumer] Stats - Processed: ${this.messagesProcessed}, Failed: ${this.messagesFailed}`);
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        const messages = await this.receiveMessages();

        if (messages && messages.length > 0) {
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
      await Promise.all(
        messages.map(async (message) => {
          await this.processMessage(message, successfulMessages, retryMessages, permanentFailureMessages);
        })
      );
    } else {
      // Sequential processing: Process messages one by one
      for (const message of messages) {
        await this.processMessage(message, successfulMessages, retryMessages, permanentFailureMessages);
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

    // Retry messages will become visible again after visibility timeout
    if (retryMessages.length > 0) {
      console.warn(`[SQSConsumer] ${retryMessages.length} message(s) will be retried`);
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    message: Message,
    successfulMessages: Message[],
    retryMessages: Message[],
    permanentFailureMessages: Message[]
  ): Promise<void> {
    try {
      // Extract metadata from message attributes
      const retryCount = parseInt(message.Attributes?.ApproximateReceiveCount || '0', 10);
      const maxReceiveCount = this.config.sqsConfig.maxReceiveCount;

      const metadata: MessageMetadata = {
        retryCount,
        isLastAttempt: maxReceiveCount !== undefined ? retryCount >= maxReceiveCount : false,
      };

      await this.handler.handle(message, metadata);
      successfulMessages.push(message);
      this.messagesProcessed++;
    } catch (error) {
      if (error instanceof RetryException) {
        // RetryException: Don't delete, let it become visible again
        console.warn(`[SQSConsumer] 🔄 Retry requested for message ${message.MessageId}: ${error.message}`);
        retryMessages.push(message);
        this.messagesFailed++;
      } else if (error instanceof FailureException) {
        // FailureException: Delete the message (permanent failure)
        console.error(`[SQSConsumer] 💀 Permanent failure for message ${message.MessageId}: ${error.message}`);
        permanentFailureMessages.push(message);
        this.messagesFailed++;
      } else {
        // Unknown error: Don't delete, let it retry
        console.error('[SQSConsumer] ❌ Failed to process message:', error);
        console.error('[SQSConsumer] Message ID:', message.MessageId);
        retryMessages.push(message);
        this.messagesFailed++;
      }
    }
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

