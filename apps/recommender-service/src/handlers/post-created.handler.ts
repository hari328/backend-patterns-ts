import type { Message, MessageHandler, MessageMetadata, MessageResult } from '@repo/sqs-consumer';
import { PostCreatedEvent } from '@repo/types';
import { HashtagService } from '../services/hashtag.service';
import { HashtagsRepository } from '../repositories/hashtags.repository';

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
      console.log(`[PostCreatedHandler] Processing POST_CREATED event`);
      console.log(`  Post ID: ${event.postId}`);
      console.log(`  User ID: ${event.userId}`);
      console.log(`  Timestamp: ${event.timestamp}`);
      console.log(`  Retry Count: ${metadata.retryCount}`);
      console.log(`  Is Last Attempt: ${metadata.isLastAttempt}`);

      // Process hashtags immediately and persist to database
      await this.hashtagService.processPostHashtags(event.postId);

      console.log(`[PostCreatedHandler] ✅ Successfully processed hashtags for post ${event.postId}`);

      return { status: 'success' };
    } catch (error) {
      console.error(`[PostCreatedHandler] Failed to process hashtags for post ${event.postId}:`, error);

      if (error instanceof Error && error.message.includes('Post not found')) {
        return { status: 'fail', reason: error.message };
      }

      return { status: 'retry', reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

