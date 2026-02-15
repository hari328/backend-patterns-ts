import { generateSnowflakeId } from '@repo/database';
import type { MetricsRegistry } from '@repo/metrics';
import { PostsRepository } from '../repositories/posts.repository';
import { PostResponse } from '../types/posts.types';
import { PostsSQSPublisher } from './sqs-publisher';
import { logger } from '../logger';

const serviceLogger = logger.forComponent('PostsService');

const HASHTAG_REGEX = /#\w+/;

export class PostsService {
  private repository: PostsRepository;
  private sqsPublisher: PostsSQSPublisher;
  private postsCreatedCounter: ReturnType<MetricsRegistry['counter']> | undefined;

  constructor(repository: PostsRepository, sqsPublisher: PostsSQSPublisher, metricsRegistry?: MetricsRegistry) {
    this.repository = repository;
    this.sqsPublisher = sqsPublisher;

    if (metricsRegistry) {
      this.postsCreatedCounter = metricsRegistry.counter({
        name: 'posts_created_total',
        help: 'Total number of posts created',
        labelNames: ['has_hashtags'],
      });
    }
  }

  async createPost(userId: string, caption: string): Promise<PostResponse> {
    if (caption.length > 3000) {
      throw new Error('Caption must not exceed 3000 characters');
    }

    // just a comment
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
      serviceLogger.error('Failed to publish POST_CREATED event to SQS', error, { postId, userId });
    }

    const hasHashtags = HASHTAG_REGEX.test(caption);
    this.postsCreatedCounter?.inc({ has_hashtags: String(hasHashtags) });

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

