import { Request, Response } from 'express';
import { HashtagService } from '../services/hashtag.service';

export class HashtagsController {
  private service: HashtagService;

  constructor(service: HashtagService) {
    this.service = service;
  }

  async getTopHashtags(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;

      if (isNaN(limit) || limit <= 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Limit must be a positive number',
        });
        return;
      }

      const topHashtags = await this.service.getTopHashtags(limit);

      res.status(200).json({
        hashtags: topHashtags,
        count: topHashtags.length,
      });
    } catch (error) {
      console.error('[HashtagsController] Error getting top hashtags:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
      });
    }
  }
}

