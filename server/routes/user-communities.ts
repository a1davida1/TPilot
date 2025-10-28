/**
 * User Community Management Routes
 * Allows users to add new subreddits to the platform's community database
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { RedditManager } from '../lib/reddit.js';
import { searchCommunities, createCommunity } from '../reddit-communities.js';
import { createDefaultRules } from '@shared/schema';

const router = Router();

/**
 * POST /api/user-communities/add
 * Add a new subreddit to the platform (requires authentication)
 */
router.post('/add', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { subredditName } = req.body;
    if (!subredditName || typeof subredditName !== 'string') {
      return res.status(400).json({ error: 'subredditName is required' });
    }

    // Normalize subreddit name
    const normalizedName = subredditName.replace(/^r\//, '').toLowerCase();
    
    logger.info('User requesting to add community', { userId, subreddit: normalizedName });

    // Check if already exists
    const existing = await searchCommunities(normalizedName);
    if (existing.length > 0) {
      return res.json({
        success: true,
        message: 'Community already exists',
        community: existing[0]
      });
    }

    // Fetch subreddit info from Reddit
    const manager = await RedditManager.forUser(userId);
    if (!manager) {
      return res.status(403).json({ error: 'Reddit account not connected' });
    }

    try {
      // Fetch subreddit information
      const subredditInfo = await (manager as any).reddit.getSubreddit(normalizedName).fetch();
      
      if (!subredditInfo) {
        return res.status(404).json({ error: 'Subreddit not found on Reddit' });
      }

      // Add to database
      const newCommunity = await createCommunity({
        id: normalizedName,
        name: normalizedName,
        displayName: subredditInfo.display_name || normalizedName,
        members: subredditInfo.subscribers || 0,
        engagementRate: 10, // Default
        category: subredditInfo.subreddit_type === 'public' ? 'general' : 'other',
        verificationRequired: false,
        promotionAllowed: 'unknown',
        postingLimits: null,
        rules: createDefaultRules(),
        bestPostingTimes: ['evening'],
        averageUpvotes: 50,
        successProbability: 50,
        growthTrend: 'stable',
        modActivity: 'medium',
        description: subredditInfo.public_description || subredditInfo.title || `Community: ${normalizedName}`,
        tags: ['user-added'],
        competitionLevel: 'medium',
      });

      logger.info('User added new community', { userId, subreddit: normalizedName });

      return res.json({
        success: true,
        message: 'Community added successfully',
        community: newCommunity
      });

    } catch (err) {
      logger.error('Failed to fetch subreddit info', {
        subreddit: normalizedName,
        error: err instanceof Error ? err.message : String(err)
      });
      return res.status(404).json({ error: 'Subreddit not found or inaccessible' });
    }

  } catch (error) {
    logger.error('Error adding user community', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Failed to add community' });
  }
});

/**
 * GET /api/user-communities/recent
 * Get recently added user communities
 */
router.get('/recent', authenticateToken(false), async (_req: AuthRequest, res: Response) => {
  try {
    const communities = await searchCommunities('');
    const userAdded = communities.filter(c => c.tags?.includes('user-added')).slice(0, 20);
    
    return res.json(userAdded);
  } catch (error) {
    logger.error('Error fetching recent user communities', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

export default router;
