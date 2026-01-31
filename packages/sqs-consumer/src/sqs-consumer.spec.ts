import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SQSConsumer, type MessageHandler } from './sqs-consumer';
import { InMemoryIdempotencyStore } from './stores/in-memory-idempotency-store';
import { InMemoryBackoffStore } from './stores/in-memory-backoff-store';

describe('SQSConsumer - Basic message handling functionality', () => {
  let mockSend: any;
  let mockHandler: MessageHandler;
  let consumer: SQSConsumer;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Mock the SQSClient.send method
    mockSend = vi.fn();
    vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);

    // Create a mock handler
    mockHandler = {
      handle: vi.fn(),
    };

    // Create consumer instance
    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler
    );
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should delete message when handler succeeds', async () => {
    // Arrange: Mock successful message processing
    const mockMessage = {
      MessageId: 'msg-123',
      ReceiptHandle: 'receipt-123',
      Body: JSON.stringify({ postId: '1', content: 'Hello' }),
    };

    // Mock ReceiveMessage to return one message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch to succeed
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to succeed
    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    await consumer.start();

    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler was called with message and metadata
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 0, // No Attributes, so retryCount should be 0
        isLastAttempt: false, // No maxReceiveCount configured
      })
    );

    // Assert: send was called 3 times (ReceiveMessage + DeleteMessageBatch + ReceiveMessage)
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should NOT delete message when handler returns retry status', async () => {
    // Arrange
    const mockMessage = {
      MessageId: 'msg-456',
      ReceiptHandle: 'receipt-456',
      Body: JSON.stringify({ postId: '2' }),
    };

    // Mock ReceiveMessage to return one message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to return retry status
    mockHandler.handle = vi.fn().mockResolvedValue({
      status: 'retry',
      reason: 'Database connection failed'
    });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler was called with message and metadata
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 0,
        isLastAttempt: false,
      })
    );

    // Assert: send was called 2 times (ReceiveMessage + ReceiveMessage, NO delete)
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should delete message when handler returns fail status', async () => {
    // Arrange
    const mockMessage = {
      MessageId: 'msg-789',
      ReceiptHandle: 'receipt-789',
      Body: 'invalid json',
    };

    // Mock ReceiveMessage to return one message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to return fail status
    mockHandler.handle = vi.fn().mockResolvedValue({
      status: 'fail',
      reason: 'Invalid JSON'
    });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler was called with message and metadata
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 0,
        isLastAttempt: false,
      })
    );

    // Assert: send was called 3 times (ReceiveMessage + DeleteMessageBatch + ReceiveMessage)
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('should pass metadata with retry count to handler', async () => {
    // Arrange: Mock message with retry count
    const mockMessage = {
      MessageId: 'msg-with-metadata',
      ReceiptHandle: 'receipt-with-metadata',
      Body: JSON.stringify({ data: 'test' }),
      Attributes: {
        ApproximateReceiveCount: '3', // This message has been received 3 times
      },
    };

    // Mock ReceiveMessage to return message with attributes
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch to succeed
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to succeed
    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler was called with message AND metadata
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 3, // Should be parsed as number
        isLastAttempt: false, // No maxReceiveCount configured
      })
    );
  });

  it('should set isLastAttempt to true when retry count reaches maxReceiveCount', async () => {
    // Arrange: Create consumer with maxReceiveCount
    const consumerWithMaxRetries = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
          maxReceiveCount: 5, // Max 5 attempts before DLQ
        },
      },
      mockHandler
    );

    const mockMessage = {
      MessageId: 'msg-last-attempt',
      ReceiptHandle: 'receipt-last-attempt',
      Body: JSON.stringify({ data: 'test' }),
      Attributes: {
        ApproximateReceiveCount: '5', // 5th attempt = last attempt
      },
    };

    // Mock ReceiveMessage
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to succeed
    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumerWithMaxRetries.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumerWithMaxRetries.stop();

    // Assert: isLastAttempt should be true
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 5,
        isLastAttempt: true, // 5 >= 5
      })
    );
  });

  it('should process messages sequentially by default', async () => {
    // Arrange: Create multiple messages
    const messages = [
      {
        MessageId: 'msg-1',
        ReceiptHandle: 'receipt-1',
        Body: JSON.stringify({ id: 1 }),
      },
      {
        MessageId: 'msg-2',
        ReceiptHandle: 'receipt-2',
        Body: JSON.stringify({ id: 2 }),
      },
      {
        MessageId: 'msg-3',
        ReceiptHandle: 'receipt-3',
        Body: JSON.stringify({ id: 3 }),
      },
    ];

    // Track execution order
    const executionOrder: number[] = [];
    const processingTimes: number[] = [];

    // Mock handler that takes time and tracks order
    mockHandler.handle = vi.fn().mockImplementation(async (message) => {
      const id = JSON.parse(message.Body).id;
      const startTime = Date.now();
      executionOrder.push(id);

      // Simulate async work (longer for first message)
      await new Promise(resolve => setTimeout(resolve, id === 1 ? 50 : 10));

      processingTimes.push(Date.now() - startTime);
      return { status: 'success' };
    });

    // Mock ReceiveMessage to return multiple messages
    mockSend.mockResolvedValueOnce({
      Messages: messages,
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }, { Id: '1' }, { Id: '2' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    await consumer.stop();

    // Assert: Messages should be processed in order (sequential)
    expect(executionOrder).toEqual([1, 2, 3]);
    expect(mockHandler.handle).toHaveBeenCalledTimes(3);
  });

  it('should process messages in parallel when processInParallel is true', async () => {
    // Arrange: Create consumer with parallel processing enabled
    const parallelConsumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
        processInParallel: true, // Enable parallel processing
      },
      mockHandler
    );

    const messages = [
      {
        MessageId: 'msg-1',
        ReceiptHandle: 'receipt-1',
        Body: JSON.stringify({ id: 1 }),
      },
      {
        MessageId: 'msg-2',
        ReceiptHandle: 'receipt-2',
        Body: JSON.stringify({ id: 2 }),
      },
      {
        MessageId: 'msg-3',
        ReceiptHandle: 'receipt-3',
        Body: JSON.stringify({ id: 3 }),
      },
    ];

    // Track when each message starts processing
    const startTimes: Record<number, number> = {};
    const endTimes: Record<number, number> = {};

    // Mock handler that tracks timing
    mockHandler.handle = vi.fn().mockImplementation(async (message) => {
      const id = JSON.parse(message.Body).id;
      startTimes[id] = Date.now();

      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 30));

      endTimes[id] = Date.now();
      return { status: 'success' };
    });

    // Mock ReceiveMessage
    mockSend.mockResolvedValueOnce({
      Messages: messages,
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }, { Id: '1' }, { Id: '2' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Act
    await parallelConsumer.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    await parallelConsumer.stop();

    // Assert: All messages should be processed
    expect(mockHandler.handle).toHaveBeenCalledTimes(3);

    // Assert: Messages should start processing at roughly the same time (parallel)
    // If parallel, all should start within a small time window
    const startTimesArray = Object.values(startTimes);
    const maxStartTimeDiff = Math.max(...startTimesArray) - Math.min(...startTimesArray);
    expect(maxStartTimeDiff).toBeLessThan(20); // Should start within 20ms of each other
  });
});

describe('SQSConsumer - Idempotency', () => {
  let mockSend: any;
  let mockHandler: MessageHandler;
  let idempotencyStore: InMemoryIdempotencyStore;
  let consumer: SQSConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);

    mockHandler = {
      handle: vi.fn(),
    };

    idempotencyStore = new InMemoryIdempotencyStore();

    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler,
      {
        idempotencyStore,
      }
    );
  });

  afterEach(async () => {
    await consumer.stop();
    idempotencyStore.clear();
  });

  it('should process a message the first time', async () => {
    const mockMessage = {
      MessageId: 'msg-unique-1',
      ReceiptHandle: 'receipt-unique-1',
      Body: JSON.stringify({ data: 'test' }),
    };

    // Mock ReceiveMessage
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler should be called
    expect(mockHandler.handle).toHaveBeenCalledTimes(1);
    expect(mockHandler.handle).toHaveBeenCalledWith(
      mockMessage,
      expect.objectContaining({
        retryCount: 0,
        isLastAttempt: false,
      })
    );

    // Assert: Message should be marked as processed
    expect(await idempotencyStore.hasProcessed('msg-unique-1')).toBe(true);
  });

  it('should NOT process a duplicate message', async () => {
    const mockMessage = {
      MessageId: 'msg-duplicate-1',
      ReceiptHandle: 'receipt-duplicate-1',
      Body: JSON.stringify({ data: 'test' }),
    };

    // Pre-mark message as already processed
    await idempotencyStore.markProcessed('msg-duplicate-1', 3600);

    // Mock ReceiveMessage
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch (should still delete the duplicate)
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler should NOT be called (message already processed)
    expect(mockHandler.handle).toHaveBeenCalledTimes(0);

    // Assert: Message should still be deleted (to prevent reprocessing)
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          Entries: expect.arrayContaining([
            expect.objectContaining({
              Id: '0',
              ReceiptHandle: 'receipt-duplicate-1',
            }),
          ]),
        }),
      })
    );
  });

  it('should process same message ID twice if first one expired', async () => {
    const mockMessage = {
      MessageId: 'msg-expired-1',
      ReceiptHandle: 'receipt-expired-1',
      Body: JSON.stringify({ data: 'test' }),
    };

    // Mark message as processed with 1 second TTL
    await idempotencyStore.markProcessed('msg-expired-1', 1);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Mock ReceiveMessage
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
      Failed: [],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler SHOULD be called (TTL expired)
    expect(mockHandler.handle).toHaveBeenCalledTimes(1);
  });
});

describe('SQSConsumer - Exponential Backoff', () => {
  let mockSend: any;
  let mockHandler: MessageHandler;
  let consumer: SQSConsumer;
  let backoffStore: InMemoryBackoffStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = vi.fn();
    vi.spyOn(SQSClient.prototype, 'send').mockImplementation(mockSend);
    mockHandler = { handle: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should NOT process message if in backoff period', async () => {
    // Arrange
    backoffStore = new InMemoryBackoffStore();

    const mockMessage = {
      MessageId: 'msg-backoff-1',
      ReceiptHandle: 'receipt-backoff-1',
      Body: JSON.stringify({ test: 'data' }),
      Attributes: { ApproximateReceiveCount: '2' },
    };

    // Record a failure with 5 second backoff
    await backoffStore.recordFailure('msg-backoff-1', 5000);

    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler,
      { backoffStore }
    );

    // Mock ReceiveMessage to return the message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler should NOT be called (message in backoff)
    expect(mockHandler.handle).not.toHaveBeenCalled();

    // Message should NOT be deleted (still in backoff)
    const deleteCall = mockSend.mock.calls.find((call: any) =>
      call[0].constructor.name === 'DeleteMessageBatchCommand'
    );
    expect(deleteCall).toBeUndefined();
  });

  it('should process message after backoff period expires', async () => {
    // Arrange
    backoffStore = new InMemoryBackoffStore();

    const mockMessage = {
      MessageId: 'msg-backoff-2',
      ReceiptHandle: 'receipt-backoff-2',
      Body: JSON.stringify({ test: 'data' }),
      Attributes: { ApproximateReceiveCount: '2' },
    };

    // Record a failure with very short backoff (10ms)
    await backoffStore.recordFailure('msg-backoff-2', 10);

    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler,
      { backoffStore }
    );

    // Wait for backoff to expire
    await new Promise(resolve => setTimeout(resolve, 50));

    // Mock ReceiveMessage to return the message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock DeleteMessageBatch
    mockSend.mockResolvedValueOnce({
      Successful: [{ Id: '0' }],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'success' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Handler SHOULD be called (backoff expired)
    expect(mockHandler.handle).toHaveBeenCalledTimes(1);

    // Backoff should be cleared after successful processing
    const retryCount = await backoffStore.getRetryCount('msg-backoff-2');
    expect(retryCount).toBe(0);
  });

  it('should record failure and increase backoff exponentially', async () => {
    // Arrange
    backoffStore = new InMemoryBackoffStore();

    const mockMessage = {
      MessageId: 'msg-backoff-3',
      ReceiptHandle: 'receipt-backoff-3',
      Body: JSON.stringify({ test: 'data' }),
      Attributes: { ApproximateReceiveCount: '1' },
    };

    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler,
      { backoffStore }
    );

    // Mock ReceiveMessage to return the message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Handler returns retry status
    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'retry', reason: 'Temporary error' });

    // Act
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 100));
    await consumer.stop();

    // Assert: Backoff should be recorded
    const retryCount = await backoffStore.getRetryCount('msg-backoff-3');
    expect(retryCount).toBe(1);

    const canProcess = await backoffStore.canProcess('msg-backoff-3');
    expect(canProcess).toBe(false); // Should be in backoff
  });

  it('should use fixed delay strategy when configured', async () => {
    // Arrange
    backoffStore = new InMemoryBackoffStore();

    const mockMessage = {
      MessageId: 'msg-fixed-1',
      ReceiptHandle: 'receipt-fixed-1',
      Body: JSON.stringify({ test: 'data' }),
      Attributes: { ApproximateReceiveCount: '1' },
    };

    consumer = new SQSConsumer(
      {
        sqsConfig: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue',
          maxNumberOfMessages: 10,
          waitTimeSeconds: 20,
          visibilityTimeout: 30,
        },
      },
      mockHandler,
      {
        backoffStore,
        backoffBaseDelay: 100,
        backoffBaseDelayUnit: 'ms',
        retryStrategy: 'fixed'
      }
    );

    // Mock ReceiveMessage to return the message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Handler returns retry status
    mockHandler.handle = vi.fn().mockResolvedValue({ status: 'retry', reason: 'Temporary error' });

    // Act: First failure
    await consumer.start();
    await new Promise(resolve => setTimeout(resolve, 50));
    await consumer.stop();

    // Assert: Backoff should be recorded
    let retryCount = await backoffStore.getRetryCount('msg-fixed-1');
    expect(retryCount).toBe(1);

    // Get the first failure time
    const firstFailureTime = backoffStore.getLastFailureTime('msg-fixed-1');
    expect(firstFailureTime).not.toBeNull();

    // Simulate second failure (to test fixed delay doesn't grow)
    await backoffStore.recordFailure('msg-fixed-1', 100, 'fixed');
    retryCount = await backoffStore.getRetryCount('msg-fixed-1');
    expect(retryCount).toBe(2);

    // Simulate third failure
    await backoffStore.recordFailure('msg-fixed-1', 100, 'fixed');
    retryCount = await backoffStore.getRetryCount('msg-fixed-1');
    expect(retryCount).toBe(3);

    // With fixed strategy, delay should always be 100ms regardless of retry count
    // Wait 50ms - should still be in backoff
    await new Promise(resolve => setTimeout(resolve, 50));
    let canProcess = await backoffStore.canProcess('msg-fixed-1');
    expect(canProcess).toBe(false);

    // Wait another 60ms (total 110ms) - should be able to process
    await new Promise(resolve => setTimeout(resolve, 60));
    canProcess = await backoffStore.canProcess('msg-fixed-1');
    expect(canProcess).toBe(true);
  });
});

