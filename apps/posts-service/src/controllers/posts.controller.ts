import { Request, Response } from 'express';
import { PostsService } from '../services/posts.service';

export class PostsController {
  private service: PostsService;

  constructor(service: PostsService) {
    this.service = service;
  }

  async createPost(req: Request, res: Response): Promise<void> {
    const { userId, caption } = req.body;

    if (!userId || !caption) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'userId and caption are required',
      });
      return;
    }

    try {
      const post = await this.service.createPost(userId, caption);

      res.status(201).json({
        id: post.id,
        userId: post.userId,
        caption: post.caption,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        deletedAt: post.deletedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  }

  async getPostById(req: Request, res: Response): Promise<void> {
    const { postId } = req.params;

    if (!postId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'postId is required',
      });
      return;
    }

    try {
      const post = await this.service.getPostById(postId);

      res.status(200).json({
        id: post.id,
        userId: post.userId,
        caption: post.caption,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
        deletedAt: post.deletedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Post not found') {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  }

  async getPostsByUserId(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'userId is required',
      });
      return;
    }

    try {
      const posts = await this.service.getPostsByUserId(userId);

      res.status(200).json(
        posts.map((post) => ({
          id: post.id,
          userId: post.userId,
          caption: post.caption,
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          createdAt: post.createdAt.toISOString(),
          updatedAt: post.updatedAt.toISOString(),
          deletedAt: post.deletedAt,
        }))
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        res.status(404).json({
          error: 'Not Found',
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  }

  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.service.getAllUsers();

      res.status(200).json(
        users.map((user) => ({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
        }))
      );
    } catch (error) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  }
}

