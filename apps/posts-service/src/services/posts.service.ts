import { generateSnowflakeId } from '@repo/database';
import { PostsRepository } from '../repositories/posts.repository';
import { PostResponse } from '../types/posts.types';
import { PostsSQSPublisher } from './sqs-publisher';

export class PostsService {
  private repository: PostsRepository;
  private sqsPublisher: PostsSQSPublisher;

  constructor(repository: PostsRepository, sqsPublisher: PostsSQSPublisher) {
    this.repository = repository;
    this.sqsPublisher = sqsPublisher;
  }

  async createPost(userId: string, caption: string): Promise<PostResponse> {
    if (caption.length > 3000) {
      throw new Error('Caption must not exceed 3000 characters');
    }

    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const postId = generateSnowflakeId();

    const post = await this.repository.createPost({
      id: postId,
      userId,
      caption,
    });

    // Publish POST_CREATED event to SQS
    // CAVEAT: Using best-effort delivery - if SQS publish fails, we log the error
    // but still return success. The post is created in the database regardless.
    // This prevents SQS failures from blocking post creation, but means some
    // events might be lost if SQS is unavailable.
    try {
      await this.sqsPublisher.publishPostCreated(postId, userId);
    } catch (error) {
      console.error('Failed to publish POST_CREATED event to SQS:', error);
      // Continue execution - post creation succeeded even if event publish failed
    }

    return post;
  }

  async getPostById(postId: string): Promise<PostResponse> {
    const post = await this.repository.findPostById(postId);

    if (!post) {
      throw new Error('Post not found');
    }

    return post;
  }

  async getPostsByUserId(userId: string): Promise<PostResponse[]> {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const posts = await this.repository.findPostsByUserId(userId);

    return posts;
  }

  async getAllUsers() {
    return this.repository.findAllUsers();
  }
}

