import type { Message, MessageHandler, MessageMetadata } from '@repo/sqs-consumer';
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

  async handle(message: Message, metadata: MessageMetadata): Promise<void> {
    if (!message.Body) {
      throw new Error('Message body is empty');
    }

    const event: PostCreatedEvent = JSON.parse(message.Body);

    console.log(`[PostCreatedHandler] Processing POST_CREATED event`);
    console.log(`  Post ID: ${event.postId}`);
    console.log(`  User ID: ${event.userId}`);
    console.log(`  Timestamp: ${event.timestamp}`);
    console.log(`  Retry Count: ${metadata.retryCount}`);
    console.log(`  Is Last Attempt: ${metadata.isLastAttempt}`);

    try {
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
    } catch (error) {
      console.error(`[PostCreatedHandler] Failed to extract hashtags for post ${event.postId}:`, error);
      throw error;
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

