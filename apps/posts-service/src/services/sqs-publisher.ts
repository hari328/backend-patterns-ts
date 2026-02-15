import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PostCreatedEvent } from '@repo/types';
import { env } from '../config/env';
import { logger } from '../logger';

const publisherLogger = logger.forComponent('PostsSQSPublisher');

export class PostsSQSPublisher {
  private client: SQSClient;
  private queueUrl: string;

  constructor(queueUrl: string) {
    this.client = new SQSClient({
      region: env.AWS_REGION,
      endpoint: env.AWS_ENDPOINT,
      credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
    });
    this.queueUrl = queueUrl;
  }

  async publishPostCreated(postId: string, userId: string): Promise<string | undefined> {
    publisherLogger.info('Publishing POST_CREATED event', { postId, userId });

    const event: PostCreatedEvent = {
      eventType: 'POST_CREATED',
      postId,
      userId,
      timestamp: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(event),
    });

    const response = await this.client.send(command);
    publisherLogger.info('Message sent successfully', { postId, messageId: response.MessageId });

    return response.MessageId || undefined;
  }
}

