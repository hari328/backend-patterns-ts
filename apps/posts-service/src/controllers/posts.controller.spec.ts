import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { PostsController } from './posts.controller';
import { PostsService } from '../services/posts.service';
import { PostResponse } from '../types/posts.types';

describe('PostsController', () => {
  let app: Express;
  let mockService: {
    createPost: ReturnType<typeof vi.fn>;
    getPostById: ReturnType<typeof vi.fn>;
    getPostsByUserId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      createPost: vi.fn(),
      getPostById: vi.fn(),
      getPostsByUserId: vi.fn(),
    };

    const controller = new PostsController(mockService as unknown as PostsService);

    app = express();
    app.use(express.json());
    app.post('/posts', controller.createPost.bind(controller));
    app.get('/posts/:postId', controller.getPostById.bind(controller));
    app.get('/users/:userId/posts', controller.getPostsByUserId.bind(controller));
  });

  describe('POST /posts', () => {
    it('should return 201 and post data when request is valid', async () => {
      const requestBody = {
        userId: '274137326815285248',
        caption: 'My first post!',
      };

      const mockPost: PostResponse = {
        id: '274137326815285249',
        userId: requestBody.userId,
        caption: requestBody.caption,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockService.createPost.mockResolvedValue(mockPost);

      const response = await request(app)
        .post('/posts')
        .send(requestBody)
        .expect(201);

      expect(response.body).toEqual({
        id: mockPost.id,
        userId: mockPost.userId,
        caption: mockPost.caption,
        likesCount: mockPost.likesCount,
        commentsCount: mockPost.commentsCount,
        createdAt: mockPost.createdAt.toISOString(),
        updatedAt: mockPost.updatedAt.toISOString(),
        deletedAt: null,
      });
      expect(mockService.createPost).toHaveBeenCalledWith(
        requestBody.userId,
        requestBody.caption
      );
    });

    it('should return 404 when user does not exist', async () => {
      const requestBody = {
        userId: '274137326815285248',
        caption: 'My first post!',
      };

      mockService.createPost.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .post('/posts')
        .send(requestBody)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'User not found',
      });
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/posts')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'userId and caption are required',
      });
      expect(mockService.createPost).not.toHaveBeenCalled();
    });

    it('should return 400 when userId is missing', async () => {
      const response = await request(app)
        .post('/posts')
        .send({ caption: 'My first post!' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'userId and caption are required',
      });
    });

    it('should return 400 when caption is missing', async () => {
      const response = await request(app)
        .post('/posts')
        .send({ userId: '274137326815285248' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'userId and caption are required',
      });
    });
  });

  describe('GET /posts/:postId', () => {
    it('should return 200 and post data when post exists', async () => {
      const postId = '274137326815285249';

      const mockPost: PostResponse = {
        id: postId,
        userId: '274137326815285248',
        caption: 'My first post!',
        likesCount: 5,
        commentsCount: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockService.getPostById.mockResolvedValue(mockPost);

      const response = await request(app)
        .get(`/posts/${postId}`)
        .expect(200);

      expect(response.body).toEqual({
        id: mockPost.id,
        userId: mockPost.userId,
        caption: mockPost.caption,
        likesCount: mockPost.likesCount,
        commentsCount: mockPost.commentsCount,
        createdAt: mockPost.createdAt.toISOString(),
        updatedAt: mockPost.updatedAt.toISOString(),
        deletedAt: null,
      });
      expect(mockService.getPostById).toHaveBeenCalledWith(postId);
    });

    it('should return 404 when post not found', async () => {
      const postId = '274137326815285249';

      mockService.getPostById.mockRejectedValue(new Error('Post not found'));

      const response = await request(app)
        .get(`/posts/${postId}`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'Post not found',
      });
    });
  });

  describe('GET /users/:userId/posts', () => {
    it('should return 200 and array of posts when user exists', async () => {
      const userId = '274137326815285248';

      const mockPosts: PostResponse[] = [
        {
          id: '274137326815285249',
          userId,
          caption: 'First post',
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date('2026-01-26T10:00:00Z'),
          updatedAt: new Date('2026-01-26T10:00:00Z'),
          deletedAt: null,
        },
        {
          id: '274137326815285250',
          userId,
          caption: 'Second post',
          likesCount: 5,
          commentsCount: 2,
          createdAt: new Date('2026-01-26T11:00:00Z'),
          updatedAt: new Date('2026-01-26T11:00:00Z'),
          deletedAt: null,
        },
      ];

      mockService.getPostsByUserId.mockResolvedValue(mockPosts);

      const response = await request(app)
        .get(`/users/${userId}/posts`)
        .expect(200);

      expect(response.body).toEqual([
        {
          id: mockPosts[0].id,
          userId: mockPosts[0].userId,
          caption: mockPosts[0].caption,
          likesCount: mockPosts[0].likesCount,
          commentsCount: mockPosts[0].commentsCount,
          createdAt: mockPosts[0].createdAt.toISOString(),
          updatedAt: mockPosts[0].updatedAt.toISOString(),
          deletedAt: null,
        },
        {
          id: mockPosts[1].id,
          userId: mockPosts[1].userId,
          caption: mockPosts[1].caption,
          likesCount: mockPosts[1].likesCount,
          commentsCount: mockPosts[1].commentsCount,
          createdAt: mockPosts[1].createdAt.toISOString(),
          updatedAt: mockPosts[1].updatedAt.toISOString(),
          deletedAt: null,
        },
      ]);
      expect(mockService.getPostsByUserId).toHaveBeenCalledWith(userId);
    });

    it('should return 404 when user not found', async () => {
      const userId = '274137326815285248';

      mockService.getPostsByUserId.mockRejectedValue(new Error('User not found'));

      const response = await request(app)
        .get(`/users/${userId}/posts`)
        .expect(404);

      expect(response.body).toEqual({
        error: 'Not Found',
        message: 'User not found',
      });
    });

    it('should return 200 and empty array when user has no posts', async () => {
      const userId = '274137326815285248';

      mockService.getPostsByUserId.mockResolvedValue([]);

      const response = await request(app)
        .get(`/users/${userId}/posts`)
        .expect(200);

      expect(response.body).toEqual([]);
      expect(mockService.getPostsByUserId).toHaveBeenCalledWith(userId);
    });
  });
});

