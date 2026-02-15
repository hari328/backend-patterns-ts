import type { Message, MessageHandler, MessageMetadata, MessageResult } from '@repo/sqs-consumer';
import { PostCreatedEvent } from '@repo/types';
import { HashtagService } from '../services/hashtag.service';
import { HashtagsRepository } from '../repositories/hashtags.repository';
import { logger } from '../logger';

const handlerLogger = logger.forComponent('PostCreatedHandler');

export class PostCreatedHandler implements MessageHandler {
  private hashtagService: HashtagService;

  constructor() {
    const hashtagRepository = new HashtagsRepository();
    this.hashtagService = new HashtagService(hashtagRepository);
  }

  async handle(message: Message, metadata: MessageMetadata): Promise<MessageResult> {
    if (!message.Body) {
      return { status: 'fail', reason: 'Message body is empty' };
    }

    let event: PostCreatedEvent;

    try {
      event = JSON.parse(message.Body);
    } catch (error) {
      return { status: 'fail', reason: 'Invalid JSON in message body' };
    }

    try {
      handlerLogger.info('Processing POST_CREATED event', {
        postId: event.postId,
        userId: event.userId,
        eventTimestamp: event.timestamp,
        retryCount: metadata.retryCount,
        isLastAttempt: metadata.isLastAttempt,
      });

      // Process hashtags immediately and persist to database
      await this.hashtagService.processPostHashtags(event.postId);

      handlerLogger.info('Successfully processed hashtags', { postId: event.postId });

      return { status: 'success' };
    } catch (error) {
      handlerLogger.error('Failed to process hashtags', error, { postId: event.postId });

      if (error instanceof Error && error.message.includes('Post not found')) {
        return { status: 'fail', reason: error.message };
      }

      return { status: 'retry', reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

