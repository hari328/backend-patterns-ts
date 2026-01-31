import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HashtagService } from './hashtag.service';
import { HashtagsRepository, HashtagData } from '../repositories/hashtags.repository';

describe('HashtagService', () => {
  let service: HashtagService;
  let mockRepository: {
    getPostById: ReturnType<typeof vi.fn>;
    findHashtagByName: ReturnType<typeof vi.fn>;
    batchUpsertHashtags: ReturnType<typeof vi.fn>;
    createPostHashtag: ReturnType<typeof vi.fn>;
    batchCreatePostHashtags: ReturnType<typeof vi.fn>;
    findTopHashtags: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockRepository = {
      getPostById: vi.fn(),
      findHashtagByName: vi.fn(),
      batchUpsertHashtags: vi.fn(),
      createPostHashtag: vi.fn(),
      batchCreatePostHashtags: vi.fn(),
      findTopHashtags: vi.fn(),
    };

    service = new HashtagService(mockRepository as unknown as HashtagsRepository);
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from caption', () => {
      const caption = 'Learning #nodejs and #typescript today!';
      const result = service.extractHashtags(caption);

      expect(result).toEqual(['nodejs', 'typescript']);
    });

    it('should convert hashtags to lowercase', () => {
      const caption = 'Using #NodeJS and #TypeScript';
      const result = service.extractHashtags(caption);

      expect(result).toEqual(['nodejs', 'typescript']);
    });

    it('should remove duplicate hashtags', () => {
      const caption = '#nodejs is great! I love #nodejs and #NodeJS';
      const result = service.extractHashtags(caption);

      expect(result).toEqual(['nodejs']);
    });

    it('should return empty array when no hashtags found', () => {
      const caption = 'This is a post without hashtags';
      const result = service.extractHashtags(caption);

      expect(result).toEqual([]);
    });

    it('should handle multiple occurrences of same hashtag', () => {
      const caption = '#coding #coding #coding is fun';
      const result = service.extractHashtags(caption);

      expect(result).toEqual(['coding']);
    });

    it('should extract hashtags with numbers and underscores', () => {
      const caption = 'Check out #web3 and #node_js';
      const result = service.extractHashtags(caption);

      expect(result).toEqual(['web3', 'node_js']);
    });
  });

  describe('processPostHashtags', () => {
    it('should throw error when post not found', async () => {
      const postId = '274137326815285249';
      mockRepository.getPostById.mockResolvedValue(null);

      await expect(service.processPostHashtags(postId)).rejects.toThrow('Post not found: 274137326815285249');
      expect(mockRepository.getPostById).toHaveBeenCalledWith(postId);
    });

    it('should process hashtags successfully when post exists', async () => {
      const postId = '274137326815285249';
      const mockPost = {
        id: postId,
        caption: 'Learning #nodejs and #typescript today!',
      };

      const mockHashtagMap = new Map([
        ['nodejs', '274137326815285250'],
        ['typescript', '274137326815285251'],
      ]);

      mockRepository.getPostById.mockResolvedValue(mockPost);
      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.processPostHashtags(postId);

      expect(mockRepository.getPostById).toHaveBeenCalledWith(postId);
      expect(mockRepository.batchUpsertHashtags).toHaveBeenCalledWith(
        new Map([
          ['nodejs', 1],
          ['typescript', 1],
        ])
      );
      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([
        { postId, hashtagId: '274137326815285250' },
        { postId, hashtagId: '274137326815285251' },
      ]);
    });

    it('should handle post with no hashtags', async () => {
      const postId = '274137326815285249';
      const mockPost = {
        id: postId,
        caption: 'This is a post without hashtags',
      };

      mockRepository.getPostById.mockResolvedValue(mockPost);

      await service.processPostHashtags(postId);

      expect(mockRepository.getPostById).toHaveBeenCalledWith(postId);
      expect(mockRepository.batchUpsertHashtags).not.toHaveBeenCalled();
      expect(mockRepository.batchCreatePostHashtags).not.toHaveBeenCalled();
    });

    it('should handle duplicate hashtags in same post', async () => {
      const postId = '274137326815285249';
      const mockPost = {
        id: postId,
        caption: '#nodejs is great! I love #nodejs and #NodeJS',
      };

      const mockHashtagMap = new Map([['nodejs', '274137326815285250']]);

      mockRepository.getPostById.mockResolvedValue(mockPost);
      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.processPostHashtags(postId);

      expect(mockRepository.batchUpsertHashtags).toHaveBeenCalledWith(new Map([['nodejs', 1]]));
      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([
        { postId, hashtagId: '274137326815285250' },
      ]);
    });
  });

  describe('batchProcessHashtags', () => {
    it('should process multiple hashtags from multiple posts', async () => {
      const hashtagDataMap = new Map<string, HashtagData[]>([
        [
          'nodejs',
          [
            { name: 'nodejs', postId: '274137326815285249' },
            { name: 'nodejs', postId: '274137326815285250' },
          ],
        ],
        [
          'typescript',
          [{ name: 'typescript', postId: '274137326815285249' }],
        ],
      ]);

      const mockHashtagMap = new Map([
        ['nodejs', '274137326815285251'],
        ['typescript', '274137326815285252'],
      ]);

      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.batchProcessHashtags(hashtagDataMap);

      expect(mockRepository.batchUpsertHashtags).toHaveBeenCalledWith(
        new Map([
          ['nodejs', 2],
          ['typescript', 1],
        ])
      );
      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([
        { postId: '274137326815285249', hashtagId: '274137326815285251' },
        { postId: '274137326815285250', hashtagId: '274137326815285251' },
        { postId: '274137326815285249', hashtagId: '274137326815285252' },
      ]);
    });

    it('should calculate correct hashtag counts', async () => {
      const hashtagDataMap = new Map<string, HashtagData[]>([
        [
          'docker',
          [
            { name: 'docker', postId: '274137326815285249' },
            { name: 'docker', postId: '274137326815285250' },
            { name: 'docker', postId: '274137326815285251' },
          ],
        ],
      ]);

      const mockHashtagMap = new Map([['docker', '274137326815285252']]);

      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.batchProcessHashtags(hashtagDataMap);

      expect(mockRepository.batchUpsertHashtags).toHaveBeenCalledWith(new Map([['docker', 3]]));
      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([
        { postId: '274137326815285249', hashtagId: '274137326815285252' },
        { postId: '274137326815285250', hashtagId: '274137326815285252' },
        { postId: '274137326815285251', hashtagId: '274137326815285252' },
      ]);
    });

    it('should create correct post-hashtag relationships', async () => {
      const hashtagDataMap = new Map<string, HashtagData[]>([
        [
          'web3',
          [
            { name: 'web3', postId: '274137326815285249' },
            { name: 'web3', postId: '274137326815285250' },
          ],
        ],
        [
          'blockchain',
          [
            { name: 'blockchain', postId: '274137326815285249' },
            { name: 'blockchain', postId: '274137326815285251' },
          ],
        ],
      ]);

      const mockHashtagMap = new Map([
        ['web3', '274137326815285252'],
        ['blockchain', '274137326815285253'],
      ]);

      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.batchProcessHashtags(hashtagDataMap);

      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([
        { postId: '274137326815285249', hashtagId: '274137326815285252' },
        { postId: '274137326815285250', hashtagId: '274137326815285252' },
        { postId: '274137326815285249', hashtagId: '274137326815285253' },
        { postId: '274137326815285251', hashtagId: '274137326815285253' },
      ]);
    });

    it('should handle empty hashtag data map', async () => {
      const hashtagDataMap = new Map<string, HashtagData[]>();

      const mockHashtagMap = new Map();

      mockRepository.batchUpsertHashtags.mockResolvedValue(mockHashtagMap);
      mockRepository.batchCreatePostHashtags.mockResolvedValue(undefined);

      await service.batchProcessHashtags(hashtagDataMap);

      expect(mockRepository.batchUpsertHashtags).toHaveBeenCalledWith(new Map());
      expect(mockRepository.batchCreatePostHashtags).toHaveBeenCalledWith([]);
    });
  });

  describe('getTopHashtags', () => {
    it('should return top hashtags with default limit of 5', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
        { id: '274137326815285252', name: 'docker', usageCount: 60 },
        { id: '274137326815285253', name: 'kubernetes', usageCount: 40 },
        { id: '274137326815285254', name: 'react', usageCount: 20 },
      ];

      mockRepository.findTopHashtags.mockResolvedValue(mockHashtags);

      const result = await service.getTopHashtags();

      expect(mockRepository.findTopHashtags).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockHashtags);
    });

    it('should return top hashtags with custom limit', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
        { id: '274137326815285252', name: 'docker', usageCount: 60 },
      ];

      mockRepository.findTopHashtags.mockResolvedValue(mockHashtags);

      const result = await service.getTopHashtags(3);

      expect(mockRepository.findTopHashtags).toHaveBeenCalledWith(3);
      expect(result).toEqual(mockHashtags);
    });

    it('should return fewer hashtags if less than limit exist', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
      ];

      mockRepository.findTopHashtags.mockResolvedValue(mockHashtags);

      const result = await service.getTopHashtags(5);

      expect(mockRepository.findTopHashtags).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockHashtags);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no hashtags exist', async () => {
      mockRepository.findTopHashtags.mockResolvedValue([]);

      const result = await service.getTopHashtags(5);

      expect(mockRepository.findTopHashtags).toHaveBeenCalledWith(5);
      expect(result).toEqual([]);
    });

    it('should throw error when limit is zero', async () => {
      await expect(service.getTopHashtags(0)).rejects.toThrow('Limit must be greater than 0');
      expect(mockRepository.findTopHashtags).not.toHaveBeenCalled();
    });

    it('should throw error when limit is negative', async () => {
      await expect(service.getTopHashtags(-5)).rejects.toThrow('Limit must be greater than 0');
      expect(mockRepository.findTopHashtags).not.toHaveBeenCalled();
    });
  });
});

