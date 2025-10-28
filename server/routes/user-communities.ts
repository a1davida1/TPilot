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
 * POST /api/user-communities/lookup
 * Validate and fetch subreddit info without adding to database
 */
router.post('/lookup', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { subredditName } = req.body;
    if (!subredditName || typeof subredditName !== 'string') {
      return res.status(400).json({ error: 'subredditName is required' });
    }

    // Normalize and validate subreddit name
    const normalizedName = subredditName.replace(/^r\//, '').toLowerCase().trim();
    
    if (!normalizedName || normalizedName.length === 0) {
      return res.status(400).json({ error: 'Invalid subreddit name' });
    }

    logger.info('User looking up community', { userId, subreddit: normalizedName });

    // Check if already exists in our database
    const existing = await searchCommunities(normalizedName);
    if (existing.length > 0) {
      return res.json({
        success: true,
        alreadyExists: true,
        community: existing[0],
        message: 'Community already exists in database'
      });
    }

    // Fetch from Reddit API
    const manager = await RedditManager.forUser(userId);
    if (!manager) {
      return res.status(403).json({ error: 'Reddit account not connected' });
    }

    const subredditInfo = await manager.fetchSubredditSummary(normalizedName);
    
    if (!subredditInfo) {
      return res.status(404).json({ error: 'Subreddit not found on Reddit' });
    }

    // Return info without adding to database
    return res.json({
      success: true,
      alreadyExists: false,
      subredditInfo: {
        name: normalizedName,
        displayName: subredditInfo.display_name,
        subscribers: subredditInfo.subscribers,
        description: subredditInfo.public_description || subredditInfo.title,
        type: subredditInfo.subreddit_type,
        nsfw: subredditInfo.over18,
      },
      message: 'Subreddit found and ready to add'
    });

  } catch (error) {
    logger.error('Error looking up community', {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ error: 'Failed to lookup community' });
  }
});

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
    const normalizedName = subredditName.replace(/^r\//, '').toLowerCase().trim();
    
    if (!normalizedName || normalizedName.length === 0) {
      return res.status(400).json({ error: 'Invalid subreddit name' });
    }
    
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

    // Use type-safe method instead of (manager as any)
    const subredditInfo = await manager.fetchSubredditSummary(normalizedName);
    
    if (!subredditInfo) {
      return res.status(404).json({ error: 'Subreddit not found on Reddit' });
    }

    // Add to database
    const newCommunity = await createCommunity({
      id: normalizedName,
      name: normalizedName,
      displayName: subredditInfo.display_name,
      members: subredditInfo.subscribers,
      engagementRate: 10, // Default
      category: subredditInfo.subreddit_type === 'public' ? 'general' : 'other',
      verificationRequired: false,
      promotionAllowed: subredditInfo.over18 ? 'yes' : 'unknown',
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
