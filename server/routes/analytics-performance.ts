/**
 * Enhanced Analytics API Endpoint
 * Provides real-time performance metrics and recommendations
 */

import { Router } from 'express';
import { authenticateToken as requireAuth } from '../middleware/auth.js';
import { 
  getPerformanceAnalytics, 
  getUserSubredditMetrics,
  getGlobalSubredditMetrics,
  detectPeakHours,
  getBestDayOfWeek
} from '../lib/analytics-service.js';
import { logger } from '../bootstrap/logger.js';
import { z } from 'zod';

const router = Router();

// Request validation schema
const performanceQuerySchema = z.object({
  subreddit: z.string().min(1).max(100),
  userId: z.coerce.number().optional()
});

/**
 * GET /api/analytics/performance
 * 
 * Get comprehensive performance analytics for a subreddit
 * 
 * Query params:
 * - subreddit: string (required)
 * - userId: number (optional, defaults to authenticated user)
 * 
 * Returns:
 * - user metrics (avg upvotes, comments, success rate, trending)
 * - global benchmarks
 * - personalized recommendations
 * - last 30 days summary
 */
router.get('/performance', requireAuth, async (req, res) => {
  try {
    const validation = performanceQuerySchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { subreddit } = validation.data;
    const userId = validation.data.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required'
      });
    }

    const analytics = await getPerformanceAnalytics(userId, subreddit);

    return res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error('Failed to fetch performance analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/metrics
 * 
 * Get basic metrics for a subreddit
 * 
 * Query params:
 * - subreddit: string (required)
 * - scope: 'user' | 'global' (default: 'user')
 */
router.get('/metrics', requireAuth, async (req, res) => {
  try {
    const { subreddit, scope = 'user' } = req.query;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    const userId = req.user?.id;

    if (scope === 'global') {
      const metrics = await getGlobalSubredditMetrics(subreddit);
      return res.json({
        success: true,
        scope: 'global',
        data: metrics
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required for user-scoped metrics'
      });
    }

    const metrics = await getUserSubredditMetrics(userId, subreddit);
    return res.json({
      success: true,
      scope: 'user',
      data: metrics
    });

  } catch (error) {
    logger.error('Failed to fetch metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/peak-hours
 * 
 * Get optimal posting hours for a subreddit
 * 
 * Query params:
 * - subreddit: string (required)
 */
router.get('/peak-hours', requireAuth, async (req, res) => {
  try {
    const { subreddit } = req.query;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    const userId = req.user?.id;
    const peakHours = await detectPeakHours(subreddit, userId);

    return res.json({
      success: true,
      data: peakHours
    });

  } catch (error) {
    logger.error('Failed to fetch peak hours', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to fetch peak hours',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/best-day
 * 
 * Get best day of week for posting
 * 
 * Query params:
 * - subreddit: string (required)
 */
router.get('/best-day', requireAuth, async (req, res) => {
  try {
    const { subreddit } = req.query;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'User ID required'
      });
    }

    const bestDay = await getBestDayOfWeek(userId, subreddit);

    return res.json({
      success: true,
      data: {
        bestDay,
        subreddit
      }
    });

  } catch (error) {
    logger.error('Failed to fetch best day', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      query: req.query
    });

    return res.status(500).json({
      error: 'Failed to fetch best day',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/dashboard
 * 
 * Get complete analytics dashboard data
 * Optimized single endpoint for dashboard rendering
 * 
 * Query params:
 * - subreddits: comma-separated list of subreddits (optional, defaults to user's top 5)
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const { subreddits: subredditsParam } = req.query;
    
    // Parse subreddits from query param or use default
    const subredditList = subredditsParam && typeof subredditsParam === 'string'
      ? subredditsParam.split(',').map(s => s.trim()).filter(Boolean)
      : ['gonewild', 'RealGirls']; // Default to common subreddits

    // Fetch analytics for all subreddits in parallel
    const dashboardData = await Promise.all(
      subredditList.map(async (subreddit) => {
        try {
          const [performance, peakHours, bestDay] = await Promise.all([
            getPerformanceAnalytics(userId, subreddit),
            detectPeakHours(subreddit, userId),
            getBestDayOfWeek(userId, subreddit)
          ]);

          return {
            subreddit,
            performance,
            peakHours: peakHours.peakHours,
            bestDay,
            confidence: peakHours.confidence,
            sampleSize: peakHours.sampleSize
          };
        } catch (error) {
          logger.warn('Failed to fetch analytics for subreddit', {
            subreddit,
            error: error instanceof Error ? error.message : 'Unknown'
          });
          return null;
        }
      })
    );

    // Filter out failed requests
    const validData = dashboardData.filter((data) => data !== null);

    return res.json({
      success: true,
      userId,
      subredditsAnalyzed: validData.length,
      data: validData
    });

  } catch (error) {
    logger.error('Failed to fetch dashboard data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    return res.status(500).json({
      error: 'Failed to fetch dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/user-subreddits
 * 
 * Get list of subreddits user has posted to
 * 
 * Query params:
 * - userId: number (optional, defaults to authenticated user)
 * 
 * Returns:
 * - subreddits: string[] (unique subreddits from user's post history)
 */
router.get('/user-subreddits', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId ? Number(req.query.userId) : req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required'
      });
    }

    const { db } = await import('../db.js');
    const { postMetrics } = await import('@shared/schema');
    const { sql } = await import('drizzle-orm');

    // Get distinct subreddits from user's posts, ordered by most recent activity
    const subreddits = await db
      .selectDistinct({ 
        subreddit: postMetrics.subreddit,
        lastPosted: sql<Date>`MAX(${postMetrics.postedAt})`
      })
      .from(postMetrics)
      .where(sql`${postMetrics.userId} = ${userId}`)
      .groupBy(postMetrics.subreddit)
      .orderBy(sql`MAX(${postMetrics.postedAt}) DESC`)
      .limit(50);

    const subredditList = subreddits.map(s => s.subreddit);

    return res.json({
      success: true,
      count: subredditList.length,
      subreddits: subredditList
    });

  } catch (error) {
    logger.error('Failed to fetch user subreddits', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    return res.status(500).json({
      error: 'Failed to fetch user subreddits',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/historical-performance
 * 
 * Get performance over time for graphing
 * 
 * Query params:
 * - subreddit: string (required)
 * - userId: number (optional, defaults to authenticated user)
 * - days: number (optional, default 30, max 90)
 * 
 * Returns:
 * - data: Array of {date, avgScore, totalPosts}
 */
router.get('/historical-performance', requireAuth, async (req, res) => {
  try {
    const { subreddit, days = 30 } = req.query;
    const userId = req.query.userId ? Number(req.query.userId) : req.user?.id;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({
        error: 'Subreddit parameter required'
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required'
      });
    }

    const daysNumber = Math.min(Number(days) || 30, 90);

    const { db } = await import('../db.js');
    const { postMetrics } = await import('@shared/schema');
    const { sql, and, eq, gte } = await import('drizzle-orm');

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysNumber);

    // Get daily aggregated performance
    const dailyStats = await db
      .select({
        date: sql<string>`DATE(${postMetrics.postedAt})`,
        avgScore: sql<number>`ROUND(AVG(${postMetrics.score}))`,
        totalPosts: sql<number>`COUNT(*)`
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          eq(postMetrics.subreddit, subreddit),
          gte(postMetrics.postedAt, daysAgo)
        )
      )
      .groupBy(sql`DATE(${postMetrics.postedAt})`)
      .orderBy(sql`DATE(${postMetrics.postedAt}) ASC`);

    return res.json({
      success: true,
      subreddit,
      days: daysNumber,
      dataPoints: dailyStats.length,
      data: dailyStats
    });

  } catch (error) {
    logger.error('Failed to fetch historical performance', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      subreddit: req.query.subreddit
    });

    return res.status(500).json({
      error: 'Failed to fetch historical performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
