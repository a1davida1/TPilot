/**
 * User Community Management Routes
 * Allows users to add new subreddits to the platform's community database
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { RedditManager, type SubredditSummary } from '../lib/reddit.js';
import { searchCommunities, createCommunity, type NormalizedRedditCommunity } from '../reddit-communities.js';
import { createDefaultRules } from '@shared/schema';
import { z } from 'zod';

const router = Router();

class CommunityLookupError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const subredditNameSchema = z.string().min(3).max(21).regex(/^[a-z0-9_]+$/i, 'Subreddit must contain only letters, numbers, or underscores');

const lookupRequestSchema = z.object({
  subreddit: subredditNameSchema,
});

const addRequestSchema = z.object({
  subredditName: subredditNameSchema,
});

const normalizeSubredditName = (value: string): string => value.replace(/^r\//i, '').trim().toLowerCase();

const sanitizeText = (value: string | null | undefined, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const cleaned = value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) {
    return fallback;
  }
  return cleaned.slice(0, 500);
};

const formatCommunityResponse = (community: NormalizedRedditCommunity) => ({
  id: community.id,
  name: community.name,
  displayName: community.displayName,
  description: community.description ?? '',
  members: community.members,
  over18: Boolean(community.over18),
  verificationRequired: Boolean(community.verificationRequired),
  promotionAllowed: (community.promotionAllowed ?? 'unknown') as 'yes' | 'limited' | 'no' | 'unknown',
});

const determineCategory = (summary: SubredditSummary): string => {
  const type = summary.subredditType?.toLowerCase();
  if (type === 'public' || type === 'restricted') {
    return 'general';
  }
  if (type === 'private') {
    return 'private';
  }
  return 'other';
};

async function findOrCreateCommunity(userId: number, normalizedName: string): Promise<{ community: NormalizedRedditCommunity; alreadyExists: boolean }> {
  const existing = await searchCommunities(normalizedName);
  if (existing.length > 0) {
    return { community: existing[0], alreadyExists: true };
  }

  const manager = await RedditManager.forUser(userId);
  if (!manager) {
    throw new CommunityLookupError('Reddit account not connected', 403);
  }

  const summary = await manager.fetchSubredditSummary(normalizedName);
  if (!summary) {
    throw new CommunityLookupError('Subreddit not found or inaccessible', 404);
  }

  const displayName = sanitizeText(summary.displayName ?? normalizedName, normalizedName);
  const description = sanitizeText(summary.publicDescription ?? summary.title ?? `Community: ${normalizedName}`, `Community: ${normalizedName}`);
  const subscribers = Number.isFinite(summary.subscribers) ? summary.subscribers ?? 0 : 0;

  const community = await createCommunity({
    id: normalizedName,
    name: normalizedName,
    displayName,
    members: subscribers,
    subscribers,
    engagementRate: 10,
    category: determineCategory(summary),
    verificationRequired: false,
    promotionAllowed: 'unknown',
    postingLimits: null,
    rules: createDefaultRules(),
    bestPostingTimes: ['evening'],
    averageUpvotes: 50,
    successProbability: 50,
    growthTrend: 'stable',
    modActivity: 'medium',
    description,
    tags: ['user-added'],
    competitionLevel: 'medium',
    over18: summary.over18,
  });

  return { community, alreadyExists: false };
}

/**
 * POST /api/user-communities/lookup
 * Validate and optionally import a subreddit for the current user
 */
router.post('/lookup', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = lookupRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid subreddit name' });
    }

    const normalizedName = normalizeSubredditName(parsed.data.subreddit);
    const result = await findOrCreateCommunity(userId, normalizedName);

    return res.json({
      success: true,
      alreadyExists: result.alreadyExists,
      community: formatCommunityResponse(result.community),
    });
  } catch (error) {
    if (error instanceof CommunityLookupError) {
      return res.status(error.status).json({ error: error.message });
    }

    logger.error('Error looking up user community', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({ error: 'Failed to look up community' });
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

    const parsed = addRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid subreddit name' });
    }

    const normalizedName = normalizeSubredditName(parsed.data.subredditName);
    logger.info('User requesting to add community', { userId, subreddit: normalizedName });

    const result = await findOrCreateCommunity(userId, normalizedName);

    logger.info('User added new community', { userId, subreddit: normalizedName, alreadyExists: result.alreadyExists });

    return res.json({
      success: true,
      message: result.alreadyExists ? 'Community already exists' : 'Community added successfully',
      community: formatCommunityResponse(result.community)
    });
  } catch (error) {
    if (error instanceof CommunityLookupError) {
      return res.status(error.status).json({ error: error.message });
    }

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
