import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, Message } from '@aws-sdk/client-sqs';
import { env, postsStreamQueueConfig } from '../config/env';
import { RetryException, FailureException } from '@repo/sqs-consumer';
import type { SQSQueueConfig } from '@repo/sqs-consumer';
import { handlePostsStreamMessage } from '../handlers/posts-stream-handler';

/**
 * Message handler function type
 */
type MessageHandler = (message: Message) => Promise<void>;

export class SQSConsumer {
  private client: SQSClient;
  private config: SQSQueueConfig;
  private isRunning: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private handler: MessageHandler;

  constructor(config: SQSQueueConfig, handler: MessageHandler) {
    this.config = config;
    this.handler = handler;

    // Initialize SQS Client
    this.client = new SQSClient({
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT,
      credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      } : undefined,
    });
  }

  /**
   * Start consuming messages from the queue
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  SQS Consumer is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting SQS Consumer for queue: ${this.config.queueUrl}`);
    console.log(`   Processing mode: ${this.config.processingMode}`);
    console.log(`   Max messages: ${this.config.maxNumberOfMessages}`);
    console.log(`   Wait time: ${this.config.waitTimeSeconds}s`);

    // Start polling
    this.poll();
  }

  /**
   * Stop consuming messages
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.pollInterval) {
      clearTimeout(this.pollInterval);
      this.pollInterval = null;
    }

    console.log('🛑 SQS Consumer stopped');
  }

  /**
   * Poll for messages
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      const messages = await this.receiveMessages();
      
      if (messages && messages.length > 0) {
        console.log(`📨 Received ${messages.length} message(s)`);
        
        if (this.config.processingMode === 'serial') {
          // Process messages one by one
          for (const message of messages) {
            await this.processMessage(message);
          }
        } else {
          // Process messages in parallel
          await Promise.all(messages.map(msg => this.processMessage(msg)));
        }
      }
    } catch (error) {
      console.error('❌ Error polling messages:', error);
    }

    // Continue polling
    this.pollInterval = setTimeout(() => this.poll(), 0);
  }

  /**
   * Receive messages from SQS
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.queueUrl,
      MaxNumberOfMessages: this.config.maxNumberOfMessages,
      WaitTimeSeconds: this.config.waitTimeSeconds,
      VisibilityTimeout: this.config.visibilityTimeout,
    });

    const response = await this.client.send(command);
    return response.Messages || [];
  }

  /**
   * Process a single message
   */
  private async processMessage(message: Message): Promise<void> {
    try {
      console.log(`\n📝 Processing message: ${message.MessageId}`);
      console.log(`   Body: ${message.Body}`);

      // Call the user-provided handler
      await this.handler(message);

      // Delete message after successful processing
      await this.deleteMessage(message);
      console.log(`✅ Message processed successfully: ${message.MessageId}`);
    } catch (error) {
      if (error instanceof RetryException) {
        // RetryException: Don't delete, let it become visible again
        console.warn(`🔄 Retry requested for message ${message.MessageId}: ${error.message}`);
        // Message will become visible again after visibility timeout
      } else if (error instanceof FailureException) {
        // FailureException: Delete the message (permanent failure)
        console.error(`💀 Permanent failure for message ${message.MessageId}: ${error.message}`);
        await this.deleteMessage(message);
      } else {
        // Unknown error: Don't delete, let it retry
        console.error(`❌ Error processing message ${message.MessageId}:`, error);
        // Message will become visible again after visibility timeout
      }
    }
  }

  /**
   * Delete a message from the queue
   */
  private async deleteMessage(message: Message): Promise<void> {
    if (!message.ReceiptHandle) {
      console.warn('⚠️  No receipt handle for message, cannot delete');
      return;
    }

    const command = new DeleteMessageCommand({
      QueueUrl: this.config.queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    });

    await this.client.send(command);
  }
}

// Create and export the consumer instance
export const postsStreamConsumer = new SQSConsumer(
  postsStreamQueueConfig,
  handlePostsStreamMessage
);

