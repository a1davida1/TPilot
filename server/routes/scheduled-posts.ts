/**
 * Scheduled posts management API
 * Handles creating, updating, and executing scheduled Reddit posts
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { getOptimalPostingTimes, getNextOptimalTime } from '../lib/schedule-optimizer.js';
import { z } from 'zod';
import { logger } from '../bootstrap/logger.js';
import { db } from '../db.js';
import { scheduledPosts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { workerOrchestrator } from '../lib/scheduler/worker-orchestrator.js';

const router = Router();

const createScheduledPostSchema = z.object({
  subreddit: z.string(),
  title: z.string(),
  imageUrl: z.string().url(), // Preview URL (Imgbox fallback)
  imageAssetId: z.number().int().optional(),
  nsfw: z.boolean().default(true),
  flair: z.string().optional(),
  scheduledFor: z.string().datetime(), // ISO timestamp
  captionId: z.string().optional(),
  pairId: z.string().optional(),
  protectionMetrics: z.object({
    ssim: z.number(),
    phashDelta: z.number(),
    preset: z.string()
  }).optional()
});

const getOptimalTimesSchema = z.object({
  subreddit: z.string(),
  timezone: z.string().optional(),
  daysAhead: z.number().min(1).max(14).default(7)
});

/**
 * POST /api/scheduled-posts
 * Create a new scheduled post
 */
router.post('/', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const data = createScheduledPostSchema.parse(req.body ?? {});
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check tier restrictions
    const userTier = req.user.tier || 'free';
    const scheduledDate = new Date(data.scheduledFor);
    const now = new Date();
    const daysAhead = Math.ceil((scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Tier restrictions for scheduling
    if (userTier === 'free' || userTier === 'starter') {
      return res.status(403).json({ 
        error: 'Scheduling requires Pro or Premium tier',
        requiredTier: 'pro' 
      });
    }

    if (userTier === 'pro' && daysAhead > 7) {
      return res.status(403).json({ 
        error: 'Pro tier can only schedule up to 7 days in advance',
        maxDays: 7,
        requestedDays: daysAhead 
      });
    }

    if (userTier === 'premium' && daysAhead > 30) {
      return res.status(403).json({ 
        error: 'Premium tier can schedule up to 30 days in advance',
        maxDays: 30,
        requestedDays: daysAhead 
      });
    }

    // Insert into database
    const [scheduledPost] = await db.insert(scheduledPosts).values({
      userId: req.user.id,
      subreddit: data.subreddit,
      title: data.title,
      content: data.captionId || '',
      imageUrl: data.imageUrl,
      imageAssetId: data.imageAssetId ?? null,
      scheduledFor: scheduledDate,
      status: 'pending',
      nsfw: data.nsfw,
      flairText: data.flair,
      createdAt: now,
      updatedAt: now
    }).returning();

    logger.info('Scheduled post created', {
      postId: scheduledPost.id,
      userId: req.user.id,
      subreddit: data.subreddit,
      scheduledFor: data.scheduledFor
    });

    return res.status(201).json(scheduledPost);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to create scheduled post';
    logger.error('Scheduled post creation error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * GET /api/scheduled-posts
 * Get all scheduled posts for the authenticated user
 */
router.get('/', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Query scheduled posts for the user
    const posts = await db
      .select({
        id: scheduledPosts.id,
        title: scheduledPosts.title,
        content: scheduledPosts.content,
        imageUrl: scheduledPosts.imageUrl,
        caption: scheduledPosts.caption,
        subreddit: scheduledPosts.subreddit,
        scheduledFor: scheduledPosts.scheduledFor,
        status: scheduledPosts.status,
        nsfw: scheduledPosts.nsfw,
        spoiler: scheduledPosts.spoiler,
        flairText: scheduledPosts.flairText,
        redditPostId: scheduledPosts.redditPostId,
        redditPostUrl: scheduledPosts.redditPostUrl,
        errorMessage: scheduledPosts.errorMessage,
        executedAt: scheduledPosts.executedAt,
        createdAt: scheduledPosts.createdAt,
        updatedAt: scheduledPosts.updatedAt
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, req.user.id))
      .orderBy(desc(scheduledPosts.scheduledFor));

    return res.status(200).json({ scheduledPosts: posts });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get scheduled posts';
    logger.error('Get scheduled posts error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/scheduled-posts/:postId
 * Cancel a scheduled post
 */
router.delete('/:postId', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.postId, 10);
    const reason = req.query.reason as string | undefined;

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await workerOrchestrator.cancelScheduledPost(postId, req.user.id, reason);

    if (!success) {
      return res.status(400).json({ error: 'Could not cancel post' });
    }

    logger.info('Scheduled post cancelled', { postId, userId: req.user.id });

    return res.status(200).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to cancel scheduled post';
    logger.error('Cancel scheduled post error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduled-posts/:postId/retry
 * Force retry a failed scheduled post
 */
router.post('/:postId/retry', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.postId, 10);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const success = await workerOrchestrator.forceRetry(postId, req.user.id);

    if (!success) {
      return res.status(400).json({ error: 'Could not retry post' });
    }

    return res.status(200).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to retry scheduled post';
    logger.error('Retry scheduled post error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/scheduled-posts/:postId/retry-status
 * Get retry status for a scheduled post
 */
router.get('/:postId/retry-status', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.postId, 10);

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await workerOrchestrator.getRetryStatus(postId);

    if (!status) {
      return res.status(404).json({ error: 'Post not found' });
    }

    return res.status(200).json(status);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get retry status';
    logger.error('Get retry status error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduled-posts/bulk-cancel
 * Bulk cancel scheduled posts
 */
router.post('/bulk-cancel', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { postIds, reason } = z.object({
      postIds: z.array(z.number()),
      reason: z.string().optional()
    }).parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const cancelledCount = await workerOrchestrator.bulkCancelPosts(postIds, req.user.id, reason);

    return res.status(200).json({ 
      success: true, 
      cancelledCount,
      totalRequested: postIds.length 
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to bulk cancel posts';
    logger.error('Bulk cancel error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/scheduled-posts/worker-stats
 * Get worker orchestration statistics
 */
router.get('/worker-stats', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const stats = await workerOrchestrator.getWorkerStats();
    return res.status(200).json(stats);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get worker stats';
    logger.error('Get worker stats error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduled-posts/optimal-times
 * Get optimal posting times for a subreddit
 */
router.post('/optimal-times', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { subreddit, timezone, daysAhead } = getOptimalTimesSchema.parse(req.body ?? {});

    const timeSlots = await getOptimalPostingTimes({
      subreddit,
      userId: req.user?.id,
      timezone,
      daysAhead
    });

    return res.status(200).json({ timeSlots });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get optimal times';
    logger.error('Get optimal times error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduled-posts/next-optimal
 * Get the single next optimal posting time
 */
router.post('/next-optimal', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { subreddit, timezone } = getOptimalTimesSchema.partial().parse(req.body ?? {});

    const nextTime = await getNextOptimalTime({
      subreddit: subreddit ?? 'gonewild',
      userId: req.user?.id,
      timezone,
      daysAhead: 7
    });

    return res.status(200).json({ nextOptimalTime: nextTime });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get next optimal time';
    logger.error('Get next optimal time error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as scheduledPostsRouter };
