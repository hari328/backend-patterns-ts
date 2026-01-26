import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostsService } from './posts.service';
import { PostsRepository } from '../repositories/posts.repository';
import { User, PostResponse } from '../types/posts.types';

describe('PostsService', () => {
  let service: PostsService;
  let mockRepository: {
    findUserById: ReturnType<typeof vi.fn>;
    createPost: ReturnType<typeof vi.fn>;
    findPostById: ReturnType<typeof vi.fn>;
    findPostsByUserId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepository = {
      findUserById: vi.fn(),
      createPost: vi.fn(),
      findPostById: vi.fn(),
      findPostsByUserId: vi.fn(),
    };

    service = new PostsService(mockRepository as unknown as PostsRepository);
  });

  describe('createPost', () => {
    it('should create post when user exists', async () => {
      const userId = '274137326815285248';
      const caption = 'My first post!';

      const mockUser: User = {
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        isVerified: true,
      };

      const mockPost: PostResponse = {
        id: '274137326815285249',
        userId,
        caption,
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRepository.findUserById.mockResolvedValue(mockUser);
      mockRepository.createPost.mockResolvedValue(mockPost);

      const result = await service.createPost(userId, caption);

      expect(mockRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockRepository.createPost).toHaveBeenCalledWith({
        id: expect.any(String),
        userId,
        caption,
      });
      expect(result).toEqual(mockPost);
    });

    it('should throw error when user does not exist', async () => {
      const userId = '274137326815285248';
      const caption = 'My first post!';

      mockRepository.findUserById.mockResolvedValue(null);

      await expect(service.createPost(userId, caption)).rejects.toThrow(
        'User not found'
      );

      expect(mockRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockRepository.createPost).not.toHaveBeenCalled();
    });
  });

  describe('getPostById', () => {
    it('should return post when it exists', async () => {
      const postId = '274137326815285249';

      const mockPost: PostResponse = {
        id: postId,
        userId: '274137326815285248',
        caption: 'My first post!',
        likesCount: 0,
        commentsCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockRepository.findPostById.mockResolvedValue(mockPost);

      const result = await service.getPostById(postId);

      expect(mockRepository.findPostById).toHaveBeenCalledWith(postId);
      expect(result).toEqual(mockPost);
    });

    it('should throw error when post not found', async () => {
      const postId = '274137326815285249';

      mockRepository.findPostById.mockResolvedValue(null);

      await expect(service.getPostById(postId)).rejects.toThrow(
        'Post not found'
      );

      expect(mockRepository.findPostById).toHaveBeenCalledWith(postId);
    });
  });

  describe('getPostsByUserId', () => {
    it('should return all posts for a user', async () => {
      const userId = '274137326815285248';

      const mockPosts: PostResponse[] = [
        {
          id: '274137326815285249',
          userId,
          caption: 'First post',
          likesCount: 0,
          commentsCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        {
          id: '274137326815285250',
          userId,
          caption: 'Second post',
          likesCount: 5,
          commentsCount: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ];

      const mockUser: User = {
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        isVerified: true,
      };

      mockRepository.findUserById.mockResolvedValue(mockUser);
      mockRepository.findPostsByUserId.mockResolvedValue(mockPosts);

      const result = await service.getPostsByUserId(userId);

      expect(mockRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockRepository.findPostsByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockPosts);
    });

    it('should verify user exists first', async () => {
      const userId = '274137326815285248';

      mockRepository.findUserById.mockResolvedValue(null);

      await expect(service.getPostsByUserId(userId)).rejects.toThrow(
        'User not found'
      );

      expect(mockRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockRepository.findPostsByUserId).not.toHaveBeenCalled();
    });

    it('should return empty array when user has no posts', async () => {
      const userId = '274137326815285248';

      const mockUser: User = {
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        fullName: 'John Doe',
        isVerified: true,
      };

      mockRepository.findUserById.mockResolvedValue(mockUser);
      mockRepository.findPostsByUserId.mockResolvedValue([]);

      const result = await service.getPostsByUserId(userId);

      expect(mockRepository.findUserById).toHaveBeenCalledWith(userId);
      expect(mockRepository.findPostsByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual([]);
    });
  });
});

