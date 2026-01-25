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
});

