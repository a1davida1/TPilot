/**
 * Smart Scheduling API Routes
 * Intelligent post timing recommendations and auto-scheduling
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { pool } from '../db.js';
import { logger } from '../lib/logger.js';
import {
  getOptimalTimes,
  predictUpvotes,
  analyzeSubredditTimes,
  updateOptimalTimesCache,
  updateUserPatternsCache
} from '../lib/scheduler/time-optimizer.js';

const router = Router();

/**
 * GET /api/scheduling/analyze-best-times
 * Get optimal posting times for a subreddit
 */
router.get('/analyze-best-times', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit, count } = req.query;

    if (!subreddit || typeof subreddit !== 'string') {
      return res.status(400).json({ error: 'Subreddit required' });
    }

    const limit = count ? Math.min(parseInt(count as string, 10), 10) : 3;

    const optimalTimes = await getOptimalTimes(req.user.id, subreddit, limit);

    return res.status(200).json({
      subreddit,
      optimalTimes,
      message: optimalTimes.length === 0 ? 'No data available yet - post more to build recommendations' : null
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to analyze best times';
    logger.error('Analyze best times error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduling/predict-performance
 * Predict upvotes for a specific time slot
 */
router.post('/predict-performance', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit, scheduledTime } = req.body;

    if (!subreddit || !scheduledTime) {
      return res.status(400).json({ error: 'Subreddit and scheduledTime required' });
    }

    const prediction = await predictUpvotes(
      req.user.id,
      subreddit,
      new Date(scheduledTime)
    );

    return res.status(200).json({
      subreddit,
      scheduledTime,
      ...prediction
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to predict performance';
    logger.error('Predict performance error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/scheduling/next-optimal-slot
 * Get the next available optimal time slot
 */
router.get('/next-optimal-slot', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit, afterTime } = req.query;
    const after = afterTime ? new Date(afterTime as string) : new Date();

    const result = await pool.query(
      'SELECT * FROM get_next_optimal_slot($1, $2, $3)',
      [req.user.id, subreddit || null, after]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No optimal slots available' });
    }

    return res.status(200).json({ slot: result.rows[0] });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to find optimal slot';
    logger.error('Next optimal slot error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduling/auto-schedule
 * Auto-schedule posts across optimal time slots
 */
router.post('/auto-schedule', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit, count, startDate, endDate } = req.body;

    if (!subreddit || !count) {
      return res.status(400).json({ error: 'Subreddit and count required' });
    }

    // Check tier limits
    const { storage } = await import('../storage.js');
    const user = await storage.getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const tier = (user.tier || 'FREE').toUpperCase();
    if (tier === 'FREE' || tier === 'STARTER') {
      return res.status(403).json({ error: 'Scheduling requires Pro or Premium tier' });
    }

    // Get optimal times
    const optimalTimes = await getOptimalTimes(req.user.id, subreddit, count);

    // Generate schedule
    const schedule = [];
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count && i < optimalTimes.length; i++) {
      const optimal = optimalTimes[i];
      
      // Find next occurrence of this day/hour
      const scheduledTime = getNextOccurrence(optimal.dayOfWeek, optimal.hourOfDay, start, end);
      
      if (scheduledTime) {
        schedule.push({
          dayOfWeek: optimal.dayOfWeek,
          hourOfDay: optimal.hourOfDay,
          scheduledTime: scheduledTime.toISOString(),
          predictedUpvotes: optimal.avgUpvotes,
          confidence: optimal.confidence,
          reason: optimal.reason,
          score: optimal.score
        });
      }
    }

    return res.status(200).json({
      subreddit,
      schedule,
      totalSlots: schedule.length
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to auto-schedule';
    logger.error('Auto-schedule error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/scheduling/optimize-existing
 * Reschedule existing posts to better time slots
 */
router.put('/optimize-existing', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user's pending scheduled posts
    const pendingPosts = await pool.query(
      `SELECT id, subreddit, scheduled_time
       FROM scheduled_posts
       WHERE user_id = $1 AND status = 'pending' AND scheduled_time > NOW()
       ORDER BY scheduled_time ASC`,
      [req.user.id]
    );

    const optimizations = [];

    for (const post of pendingPosts.rows) {
      const optimalTimes = await getOptimalTimes(req.user.id, post.subreddit, 5);
      
      if (optimalTimes.length === 0) continue;

      // Find best time that's different from current
      const currentTime = new Date(post.scheduled_time);
      const currentDow = currentTime.getDay();
      const currentHour = currentTime.getHours();

      const betterTime = optimalTimes.find(
        (t) => t.dayOfWeek !== currentDow || t.hourOfDay !== currentHour
      );

      if (betterTime && betterTime.score > 60) {
        const newTime = getNextOccurrence(
          betterTime.dayOfWeek,
          betterTime.hourOfDay,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        );

        if (newTime) {
          const currentPrediction = await predictUpvotes(req.user.id, post.subreddit, currentTime);
          const newPrediction = await predictUpvotes(req.user.id, post.subreddit, newTime);

          const improvement = newPrediction.predicted - currentPrediction.predicted;

          if (improvement > 50) {
            optimizations.push({
              postId: post.id,
              subreddit: post.subreddit,
              currentTime: currentTime.toISOString(),
              recommendedTime: newTime.toISOString(),
              currentPrediction: currentPrediction.predicted,
              newPrediction: newPrediction.predicted,
              improvement,
              improvementPercent: Math.round((improvement / currentPrediction.predicted) * 100)
            });
          }
        }
      }
    }

    return res.status(200).json({
      optimizations,
      totalFound: optimizations.length,
      message: optimizations.length === 0 ? 'Your posts are already optimally scheduled!' : null
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to optimize schedule';
    logger.error('Optimize schedule error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduling/track-experiment
 * Record scheduling experiment for A/B testing
 */
router.post('/track-experiment', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      postId,
      scheduledPostId,
      schedulingType,
      recommendedTime,
      actualTime,
      subreddit,
      predictedUpvotes,
      wasOptimalTime,
      confidenceScore
    } = req.body;

    await pool.query(
      `INSERT INTO scheduling_experiments
       (user_id, post_id, scheduled_post_id, scheduling_type, recommended_time, actual_time,
        time_diff_minutes, subreddit, predicted_upvotes, was_optimal_time, confidence_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        req.user.id,
        postId || null,
        scheduledPostId || null,
        schedulingType,
        recommendedTime ? new Date(recommendedTime) : null,
        actualTime ? new Date(actualTime) : null,
        recommendedTime && actualTime 
          ? Math.round((new Date(actualTime).getTime() - new Date(recommendedTime).getTime()) / 60000)
          : null,
        subreddit,
        predictedUpvotes || null,
        wasOptimalTime || false,
        confidenceScore || null
      ]
    );

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track experiment';
    logger.error('Track experiment error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/scheduling/performance-comparison
 * Compare auto vs manual scheduling performance
 */
router.get('/performance-comparison', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM user_scheduling_performance WHERE user_id = $1 ORDER BY scheduling_type`,
      [req.user.id]
    );

    return res.status(200).json({ performance: result.rows });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get performance comparison';
    logger.error('Performance comparison error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/scheduling/refresh-cache
 * Manually trigger cache refresh for a subreddit
 */
router.post('/refresh-cache', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { subreddit } = req.body;

    if (!subreddit) {
      return res.status(400).json({ error: 'Subreddit required' });
    }

    await Promise.all([
      updateOptimalTimesCache(subreddit),
      updateUserPatternsCache(req.user.id)
    ]);

    return res.status(200).json({ success: true, message: 'Cache refreshed successfully' });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to refresh cache';
    logger.error('Refresh cache error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * Helper function to find next occurrence of a specific day/hour
 */
function getNextOccurrence(
  dayOfWeek: number,
  hourOfDay: number,
  startDate: Date,
  endDate: Date
): Date | null {
  const current = new Date(startDate);
  
  // Fast-forward to the target day of week
  while (current.getDay() !== dayOfWeek && current < endDate) {
    current.setDate(current.getDate() + 1);
  }
  
  if (current >= endDate) return null;
  
  // Set the target hour
  current.setHours(hourOfDay, 0, 0, 0);
  
  // If we've passed this time today, go to next week
  if (current < startDate) {
    current.setDate(current.getDate() + 7);
  }
  
  return current <= endDate ? current : null;
}

export default router;
