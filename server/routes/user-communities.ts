/**
 * User Community Management Routes
 * Allows users to discover and add new subreddits to the platform
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { db } from '../db.js';
import { redditCommunities, createDefaultRules } from '@shared/schema';
import { eq, sql, or, ilike } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { createRedditClient, withTokenRefresh } from '../lib/reddit.js';
import { parseRulesFromDescription } from '../services/reddit-rule-parser.js';
import { subDays } from 'date-fns';

const router = Router();

/**
 * GET /api/user-communities/search
 * Search Reddit for subreddits (uses Reddit API if user has auth, otherwise searches local DB)
 */
router.get('/search', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();

    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters'
      });
    }

    // First, search local database
    const localResults = await db
      .select({
        id: redditCommunities.id,
        name: redditCommunities.name,
        displayName: redditCommunities.displayName,
        description: redditCommunities.description,
        members: redditCommunities.members,
        over18: redditCommunities.over18,
        verificationRequired: redditCommunities.verificationRequired,
        promotionAllowed: redditCommunities.promotionAllowed
      })
      .from(redditCommunities)
      .where(
        or(
          ilike(redditCommunities.name, `%${query}%`),
          ilike(redditCommunities.displayName, `%${query}%`)
        )
      )
      .limit(10);

    return res.json({
      success: true,
      source: 'database',
      results: localResults.map(r => ({
        id: r.id,
        name: r.name,
        displayName: r.displayName,
        description: r.description?.substring(0, 200),
        members: r.members,
        over18: r.over18,
        verificationRequired: r.verificationRequired,
        promotionAllowed: r.promotionAllowed,
        inDatabase: true
      }))
    });

  } catch (error) {
    logger.error('Failed to search communities', { error });
    return res.status(500).json({ error: 'Failed to search communities' });
  }
});

/**
 * POST /api/user-communities/lookup
 * Look up a specific subreddit from Reddit API and add it to database
 */
router.post('/lookup', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { subreddit } = req.body;
    const userId = req.user?.id;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({ error: 'Subreddit name required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const subredditName = subreddit.toLowerCase().replace(/^r\//, '');

    // Check if already in database
    const [existing] = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.id, subredditName))
      .limit(1);

    if (existing) {
      return res.json({
        success: true,
        alreadyExists: true,
        community: {
          id: existing.id,
          name: existing.name,
          displayName: existing.displayName,
          description: existing.description,
          members: existing.members,
          over18: existing.over18,
          verificationRequired: existing.verificationRequired,
          promotionAllowed: existing.promotionAllowed
        }
      });
    }

    // Fetch from Reddit API using user's OAuth
    try {
      const redditClient = await createRedditClient(userId);

      const subredditInfo = await withTokenRefresh(userId, async (client) => {
        const subreddit = await client.getSubreddit(subredditName).fetch();
        return {
          name: subreddit.display_name,
          displayName: subreddit.display_name_prefixed,
          title: subreddit.title,
          description: subreddit.description || '',
          publicDescription: subreddit.public_description || '',
          subscribers: subreddit.subscribers || 0,
          over18: subreddit.over18 || false,
          created: new Date(subreddit.created_utc * 1000)
        };
      });

      // Parse rules from description
      const parsedRules = parseRulesFromDescription(
        subredditInfo.description + '\n' + subredditInfo.publicDescription,
        subredditInfo.over18
      );

      const safeRules = parsedRules ?? createDefaultRules();

      // Insert into database
      const [newCommunity] = await db
        .insert(redditCommunities)
        .values({
          id: subredditName,
          name: subredditInfo.name,
          displayName: subredditInfo.displayName,
          description: subredditInfo.publicDescription || subredditInfo.description,
          members: subredditInfo.subscribers,
          subscribers: subredditInfo.subscribers,
          over18: subredditInfo.over18,
          verificationRequired: safeRules.eligibility?.verificationRequired ?? false,
          promotionAllowed: safeRules.engagement?.promotionAllowed ?? 'unknown',
          rules: safeRules,
          category: subredditInfo.over18 ? 'nsfw' : 'general',
          lastChecked: new Date()
        })
        .returning();

      logger.info('User added new community', {
        userId,
        subreddit: subredditName,
        members: subredditInfo.subscribers
      });

      return res.status(201).json({
        success: true,
        alreadyExists: false,
        community: {
          id: newCommunity.id,
          name: newCommunity.name,
          displayName: newCommunity.displayName,
          description: newCommunity.description,
          members: newCommunity.members,
          over18: newCommunity.over18,
          verificationRequired: newCommunity.verificationRequired,
          promotionAllowed: newCommunity.promotionAllowed
        }
      });

    } catch (redditError: any) {
      if (redditError.statusCode === 403 || redditError.statusCode === 404) {
        return res.status(404).json({
          error: 'Subreddit not found or is private/banned'
        });
      }
      throw redditError;
    }

  } catch (error) {
    logger.error('Failed to lookup subreddit', { error });
    return res.status(500).json({ error: 'Failed to lookup subreddit from Reddit' });
  }
});

/**
 * GET /api/user-communities/recent
 * Get recently added communities (last 7 days)
 */
router.get('/recent', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const sevenDaysAgo = subDays(new Date(), 7);

    const recentCommunities = await db
      .select({
        id: redditCommunities.id,
        name: redditCommunities.name,
        displayName: redditCommunities.displayName,
        description: redditCommunities.description,
        members: redditCommunities.members,
        over18: redditCommunities.over18,
        lastChecked: redditCommunities.lastChecked
      })
      .from(redditCommunities)
      .where(sql`${redditCommunities.lastChecked} >= ${sevenDaysAgo}`)
      .orderBy(sql`${redditCommunities.lastChecked} DESC`)
      .limit(20);

    return res.json({
      success: true,
      count: recentCommunities.length,
      communities: recentCommunities
    });

  } catch (error) {
    logger.error('Failed to fetch recent communities', { error });
    return res.status(500).json({ error: 'Failed to fetch recent communities' });
  }
});

/**
 * GET /api/user-communities/stats
 * Get community database statistics
 */
router.get('/stats', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        nsfw: sql<number>`COUNT(*) FILTER (WHERE over18 = true)`,
        sfw: sql<number>`COUNT(*) FILTER (WHERE over18 = false)`,
        avgMembers: sql<number>`AVG(members)`,
        totalMembers: sql<number>`SUM(members)`
      })
      .from(redditCommunities);

    return res.json({
      success: true,
      stats: {
        totalCommunities: Number(stats?.total || 0),
        nsfwCommunities: Number(stats?.nsfw || 0),
        sfwCommunities: Number(stats?.sfw || 0),
        avgMembers: Math.round(Number(stats?.avgMembers || 0)),
        totalMembers: Number(stats?.totalMembers || 0)
      }
    });

  } catch (error) {
    logger.error('Failed to fetch community stats', { error });
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export { router as userCommunitiesRouter };
