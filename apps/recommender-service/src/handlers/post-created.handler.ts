import type { Message, MessageHandler, MessageMetadata, MessageResult } from '@repo/sqs-consumer';
import { PostCreatedEvent } from '@repo/types';
import { HashtagService } from '../services/hashtag.service';
import { HashtagsRepository, HashtagData } from '../repositories/hashtags.repository';

export class PostCreatedHandler implements MessageHandler {
  private batchHashtags: Map<string, HashtagData[]> = new Map();
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

      const hashtagNames = await this.extractHashtagsForPost(event.postId);

      for (const name of hashtagNames) {
        if (!this.batchHashtags.has(name)) {
          this.batchHashtags.set(name, []);
        }
        this.batchHashtags.get(name)!.push({
          name,
          postId: event.postId,
        });
      }

      console.log(`[PostCreatedHandler] Accumulated ${hashtagNames.length} hashtags for post ${event.postId}`);
      console.log(`[PostCreatedHandler] Current batch size: ${this.batchHashtags.size} unique hashtags`);

      return { status: 'success' };
    } catch (error) {
      console.error(`[PostCreatedHandler] Failed to extract hashtags for post ${event.postId}:`, error);

      if (error instanceof Error && error.message.includes('Post not found')) {
        return { status: 'fail', reason: error.message };
      }

      return { status: 'retry', reason: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async flush(): Promise<void> {
    if (this.batchHashtags.size === 0) {
      console.log('[PostCreatedHandler] No hashtags to flush');
      return;
    }

    console.log(`[PostCreatedHandler] Flushing ${this.batchHashtags.size} unique hashtags to database...`);

    try {
      await this.hashtagService.batchProcessHashtags(this.batchHashtags);

      console.log(`[PostCreatedHandler] ✅ Successfully flushed hashtags to database`);

      this.batchHashtags.clear();
    } catch (error) {
      console.error('[PostCreatedHandler] ❌ Failed to flush hashtags:', error);
      throw error;
    }
  }

  private async extractHashtagsForPost(postId: string): Promise<string[]> {
    const hashtagRepository = new HashtagsRepository();
    const post = await hashtagRepository.getPostById(postId);

    if (!post) {
      throw new Error(`Post not found: ${postId}`);
    }

    return this.hashtagService.extractHashtags(post.caption);
  }
}

