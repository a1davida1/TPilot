/**
 * Subreddit recommendation API
 * Returns optimal subreddits based on content analysis and performance metrics
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { 
  getRecommendations, 
  type SubredditRecommendation
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
    const { category, tags = [], excludeSubreddits } = recommendSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get recommendations based on user history
    const recommendations = await getRecommendations(req.user.id);

    // Filter by excluded subreddits if provided
    const filtered = excludeSubreddits && excludeSubreddits.length > 0
      ? recommendations.filter(r => !excludeSubreddits.includes(r.subreddit))
      : recommendations;

    return res.status(200).json({
      recommendations: filtered,
      category,
      tags
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

    // For quick recommendations, just return static recommendations based on category
    // In future, this could use a more sophisticated algorithm
    const defaultMetrics = {
      avgUpvotes: 100,
      avgEngagement: 250,
      successRate: 0.85,
      postCount: 10
    };

    const categoryRecommendations: Record<string, SubredditRecommendation[]> = {
      'petite': [
        { subreddit: 'petite', score: 95, reasons: ['Perfect match for category'], metrics: defaultMetrics, tags: ['petite'] },
        { subreddit: 'PetiteGoneWild', score: 90, reasons: ['Popular in category'], metrics: defaultMetrics, tags: ['petite', 'wild'] },
        { subreddit: 'adorableporn', score: 85, reasons: ['Similar audience'], metrics: defaultMetrics, tags: ['cute', 'petite'] }
      ],
      'curvy': [
        { subreddit: 'curvy', score: 95, reasons: ['Perfect match for category'], metrics: defaultMetrics, tags: ['curvy'] },
        { subreddit: 'thick', score: 90, reasons: ['Popular in category'], metrics: defaultMetrics, tags: ['thick', 'curvy'] },
        { subreddit: 'RealGirls', score: 85, reasons: ['General audience'], metrics: defaultMetrics, tags: ['amateur'] }
      ],
      'general': [
        { subreddit: 'gonewild', score: 95, reasons: ['Most popular'], metrics: defaultMetrics, tags: ['general', 'wild'] },
        { subreddit: 'RealGirls', score: 90, reasons: ['High engagement'], metrics: defaultMetrics, tags: ['amateur', 'real'] },
        { subreddit: 'OnOff', score: 85, reasons: ['Trending'], metrics: defaultMetrics, tags: ['comparison'] }
      ]
    };

    const recommendations = categoryRecommendations[category] || categoryRecommendations['general'];

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
