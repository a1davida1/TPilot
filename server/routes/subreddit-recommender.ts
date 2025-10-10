/**
 * Subreddit recommendation API
 * Returns optimal subreddits based on content analysis and performance metrics
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { 
  getSubredditRecommendations, 
  inferCategoryFromTags,
  type RecommendationRequest
} from '../lib/subreddit-recommender.js';
import { z } from 'zod';
import { logger } from '../bootstrap/logger.js';

const router = Router();

const recommendSchema = z.object({
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  nsfw: z.boolean().default(true),
  excludeSubreddits: z.array(z.string()).optional()
});

/**
 * POST /api/subreddit-recommender
 * Get recommended subreddits for content
 */
router.post('/', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { category: providedCategory, tags = [], nsfw, excludeSubreddits } = recommendSchema.parse(req.body ?? {});

    // Infer category from tags if not provided
    const category = providedCategory ?? inferCategoryFromTags(tags);

    const request: RecommendationRequest = {
      category,
      tags,
      userId: req.user?.id,
      nsfw,
      excludeSubreddits
    };

    const recommendations = await getSubredditRecommendations(request);

    return res.status(200).json({
      recommendations,
      category,
      inferredFromTags: !providedCategory
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Recommendation failed';
    logger.error('Subreddit recommendation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/subreddit-recommender/quick/:category
 * Quick recommendation by category (no auth required for preview)
 */
router.get('/quick/:category', async (req, res: Response) => {
  try {
    const category = req.params.category;

    const request: RecommendationRequest = {
      category,
      tags: [],
      nsfw: true,
      excludeSubreddits: []
    };

    const recommendations = await getSubredditRecommendations(request);

    return res.status(200).json({
      recommendations: recommendations.slice(0, 3), // Top 3 for quick view
      category
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Quick recommendation failed';
    logger.error('Quick subreddit recommendation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as subredditRecommenderRouter };
