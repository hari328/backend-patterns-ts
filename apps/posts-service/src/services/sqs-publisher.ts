import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { PostCreatedEvent } from '@repo/types';
import { env } from '../config/env';

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
    console.log('[PostsSQSPublisher] Publishing POST_CREATED event', { postId, userId, queueUrl: this.queueUrl });

    const event: PostCreatedEvent = {
      eventType: 'POST_CREATED',
      postId,
      userId,
      timestamp: new Date().toISOString(),
    };

    console.log('[PostsSQSPublisher] Event payload:', JSON.stringify(event));

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(event),
    });

    console.log('[PostsSQSPublisher] Sending message to SQS...');
    const response = await this.client.send(command);
    console.log('[PostsSQSPublisher] Message sent successfully. MessageId:', response.MessageId);

    return response.MessageId || undefined;
  }
}

