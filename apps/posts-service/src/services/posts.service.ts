import { generateSnowflakeId } from '@repo/database';
import { PostsRepository } from '../repositories/posts.repository';
import { PostResponse } from '../types/posts.types';

export class PostsService {
  private repository: PostsRepository;

  constructor(repository: PostsRepository) {
    this.repository = repository;
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

