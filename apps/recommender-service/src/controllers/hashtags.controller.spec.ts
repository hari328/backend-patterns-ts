import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { HashtagsController } from './hashtags.controller';
import { HashtagService } from '../services/hashtag.service';

describe('HashtagsController', () => {
  let app: Express;
  let mockService: {
    getTopHashtags: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      getTopHashtags: vi.fn(),
    };

    const controller = new HashtagsController(mockService as unknown as HashtagService);

    app = express();
    app.use(express.json());
    app.get('/api/hashtags/top', controller.getTopHashtags.bind(controller));
  });

  describe('GET /api/hashtags/top', () => {
    it('should return top 5 hashtags by default', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
        { id: '274137326815285252', name: 'docker', usageCount: 60 },
        { id: '274137326815285253', name: 'kubernetes', usageCount: 40 },
        { id: '274137326815285254', name: 'react', usageCount: 20 },
      ];

      mockService.getTopHashtags.mockResolvedValue(mockHashtags);

      const response = await request(app).get('/api/hashtags/top').expect(200);

      expect(mockService.getTopHashtags).toHaveBeenCalledWith(5);
      expect(response.body).toEqual({
        hashtags: mockHashtags,
        count: 5,
      });
    });

    it('should return top hashtags with custom limit', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
        { id: '274137326815285252', name: 'docker', usageCount: 60 },
      ];

      mockService.getTopHashtags.mockResolvedValue(mockHashtags);

      const response = await request(app).get('/api/hashtags/top?limit=3').expect(200);

      expect(mockService.getTopHashtags).toHaveBeenCalledWith(3);
      expect(response.body).toEqual({
        hashtags: mockHashtags,
        count: 3,
      });
    });

    it('should return fewer hashtags if less than limit exist', async () => {
      const mockHashtags = [
        { id: '274137326815285250', name: 'nodejs', usageCount: 100 },
        { id: '274137326815285251', name: 'typescript', usageCount: 80 },
      ];

      mockService.getTopHashtags.mockResolvedValue(mockHashtags);

      const response = await request(app).get('/api/hashtags/top?limit=5').expect(200);

      expect(mockService.getTopHashtags).toHaveBeenCalledWith(5);
      expect(response.body).toEqual({
        hashtags: mockHashtags,
        count: 2,
      });
    });

    it('should return empty array when no hashtags exist', async () => {
      mockService.getTopHashtags.mockResolvedValue([]);

      const response = await request(app).get('/api/hashtags/top').expect(200);

      expect(response.body).toEqual({
        hashtags: [],
        count: 0,
      });
    });

    it('should return 400 when limit is not a number', async () => {
      const response = await request(app).get('/api/hashtags/top?limit=abc').expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'Limit must be a positive number',
      });
      expect(mockService.getTopHashtags).not.toHaveBeenCalled();
    });

    it('should return 400 when limit is zero', async () => {
      const response = await request(app).get('/api/hashtags/top?limit=0').expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'Limit must be a positive number',
      });
      expect(mockService.getTopHashtags).not.toHaveBeenCalled();
    });

    it('should return 400 when limit is negative', async () => {
      const response = await request(app).get('/api/hashtags/top?limit=-5').expect(400);

      expect(response.body).toEqual({
        error: 'Bad Request',
        message: 'Limit must be a positive number',
      });
      expect(mockService.getTopHashtags).not.toHaveBeenCalled();
    });

    it('should return 500 when service throws error', async () => {
      mockService.getTopHashtags.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/hashtags/top').expect(500);

      expect(response.body).toEqual({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    });
  });
});

