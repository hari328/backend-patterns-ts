import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SQSConsumer, type MessageHandler } from './sqs-consumer';
import { RetryException, FailureException } from './exceptions';

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
    mockHandler.handle = vi.fn().mockResolvedValue(undefined);

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

  it('should NOT delete message when handler throws RetryException', async () => {
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

    // Mock handler to throw RetryException
    mockHandler.handle = vi.fn().mockRejectedValue(
      new RetryException('Database connection failed')
    );

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

  it('should delete message when handler throws FailureException', async () => {
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

    // Mock handler to throw FailureException
    mockHandler.handle = vi.fn().mockRejectedValue(
      new FailureException('Invalid JSON')
    );

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

  it('should NOT delete message when handler throws unknown error', async () => {
    // Arrange
    const mockMessage = {
      MessageId: 'msg-999',
      ReceiptHandle: 'receipt-999',
      Body: '{}',
    };

    // Mock ReceiveMessage to return one message
    mockSend.mockResolvedValueOnce({
      Messages: [mockMessage],
    });

    // Mock second ReceiveMessage to return empty (stop polling)
    mockSend.mockResolvedValue({
      Messages: [],
    });

    // Mock handler to throw generic error
    mockHandler.handle = vi.fn().mockRejectedValue(
      new Error('Unexpected error')
    );

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
    mockHandler.handle = vi.fn().mockResolvedValue(undefined);

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
    mockHandler.handle = vi.fn().mockResolvedValue(undefined);

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

