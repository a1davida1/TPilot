/**
 * Caption Analytics API
 * Collects and queries caption A/B testing data, post metrics, and ImageShield performance
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';
import { pool } from '../db.js';
import { z } from 'zod';
import { logger } from '../bootstrap/logger.js';

const router = Router();

// Validation schemas
const captionShownSchema = z.object({
  pairId: z.string(),
  captionIds: z.array(z.string()).length(2),
  styles: z.array(z.enum(['flirty', 'slutty'])).length(2),
  captionTexts: z.array(z.string()).length(2),
  model: z.string(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  protectionPreset: z.string(),
  deviceBucket: z.string()
});

const captionChoiceSchema = z.object({
  pairId: z.string(),
  chosenCaptionId: z.string(),
  timeToChoiceMs: z.number(),
  edited: z.boolean(),
  editDeltaChars: z.number().optional(),
  autoSelected: z.boolean()
});

const protectionMetricsSchema = z.object({
  postId: z.number().optional(), // Optional; may not have post yet
  ssim: z.number(),
  phashDelta: z.number(),
  preset: z.string(),
  durationMs: z.number(),
  downscaled: z.boolean(),
  originalWidth: z.number().optional(),
  originalHeight: z.number().optional(),
  finalWidth: z.number().optional(),
  finalHeight: z.number().optional()
});

const postSubmitSchema = z.object({
  redditPostId: z.string(),
  subreddit: z.string(),
  captionId: z.string(),
  pairId: z.string(),
  nsfwFlag: z.boolean(),
  flair: z.string().optional(),
  protectionPreset: z.string(),
  metricsSSIM: z.number(),
  metricsPhashDelta: z.number(),
  uploadLatencyMs: z.number(),
  redditApiLatencyMs: z.number().optional()
});

const postMetricsSchema = z.object({
  postId: z.number(),
  measuredAtHours: z.number(),
  upvotes: z.number(),
  downvotes: z.number().optional(),
  comments: z.number(),
  voteRatePerMin: z.number().optional(),
  removed: z.boolean().optional(),
  removalReason: z.string().optional()
});

/**
 * POST /api/caption-analytics/caption-shown
 * Track when caption pair is shown to user
 */
router.post('/caption-shown', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = captionShownSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Insert both captions into captions table
    await Promise.all(
      data.captionIds.map(async (captionId, idx) => {
        await pool.query(
          `INSERT INTO captions (caption_id, model, style, text, category, tags, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (caption_id) DO NOTHING`,
          [captionId, data.model, data.styles[idx], data.captionTexts[idx], data.category ?? null, data.tags ?? []]
        );
      })
    );

    // Insert caption pair
    await pool.query(
      `INSERT INTO caption_pairs (
        pair_id, caption_id_a, caption_id_b, creator_id, 
        category, tags, protection_preset, device_bucket, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (pair_id) DO NOTHING`,
      [data.pairId, data.captionIds[0], data.captionIds[1], req.user.id, data.category ?? null, data.tags ?? [], data.protectionPreset, data.deviceBucket]
    );

    logger.info('Caption pair tracked', { pairId: data.pairId, userId: req.user.id });

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track caption shown';
    logger.error('Caption shown tracking error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/caption-choice
 * Track which caption user selected
 */
router.post('/caption-choice', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = captionChoiceSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `INSERT INTO caption_choices (
        pair_id, chosen_caption_id, time_to_choice_ms, 
        edited, edit_delta_chars, auto_selected, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [data.pairId, data.chosenCaptionId, data.timeToChoiceMs, data.edited, data.editDeltaChars ?? null, data.autoSelected]
    );

    logger.info('Caption choice tracked', { 
      pairId: data.pairId, 
      chosenCaptionId: data.chosenCaptionId,
      userId: req.user.id 
    });

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track caption choice';
    logger.error('Caption choice tracking error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/protection-metrics
 * Track ImageShield protection metrics
 */
router.post('/protection-metrics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = protectionMetricsSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `INSERT INTO protection_metrics (
        post_id, ssim, phash_delta, preset, duration_ms, 
        downscaled, original_width, original_height, 
        final_width, final_height, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
      [data.postId ?? null, data.ssim, data.phashDelta, data.preset, data.durationMs, data.downscaled, data.originalWidth ?? null, data.originalHeight ?? null, data.finalWidth ?? null, data.finalHeight ?? null]
    );

    logger.info('Protection metrics tracked', { 
      postId: data.postId, 
      preset: data.preset,
      userId: req.user.id 
    });

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track protection metrics';
    logger.error('Protection metrics tracking error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/post-submit
 * Track Reddit post submission with caption linkage
 */
router.post('/post-submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = postSubmitSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Insert post record
    const result = await pool.query(
      `INSERT INTO posts (
        reddit_post_id, creator_id, subreddit, caption_id, pair_id,
        nsfw_flag, flair, protection_preset, metrics_ssim, metrics_phash_delta,
        upload_latency_ms, reddit_api_latency_ms, created_at, posted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING post_id`,
      [data.redditPostId, req.user.id, data.subreddit, data.captionId, data.pairId, data.nsfwFlag, data.flair ?? null, data.protectionPreset, data.metricsSSIM, data.metricsPhashDelta, data.uploadLatencyMs, data.redditApiLatencyMs ?? null]
    );

    const postId = result.rows[0]?.post_id;

    logger.info('Post submission tracked', { 
      postId,
      redditPostId: data.redditPostId,
      subreddit: data.subreddit,
      userId: req.user.id 
    });

    return res.status(201).json({ success: true, postId });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track post submission';
    logger.error('Post submission tracking error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/post-metrics
 * Track post performance metrics at specific time intervals
 */
router.post('/post-metrics', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const data = postMetricsSchema.parse(req.body ?? {});

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await pool.query(
      `INSERT INTO post_metrics (
        post_id, measured_at_hours, upvotes, downvotes, comments,
        vote_rate_per_min, removed, removal_reason, measured_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      ON CONFLICT (post_id, measured_at_hours) DO UPDATE SET
        upvotes = EXCLUDED.upvotes,
        downvotes = EXCLUDED.downvotes,
        comments = EXCLUDED.comments,
        vote_rate_per_min = EXCLUDED.vote_rate_per_min,
        removed = EXCLUDED.removed,
        removal_reason = EXCLUDED.removal_reason,
        measured_at = CURRENT_TIMESTAMP`,
      [data.postId, data.measuredAtHours, data.upvotes, data.downvotes ?? null, data.comments, data.voteRatePerMin ?? null, data.removed ?? false, data.removalReason ?? null]
    );

    logger.info('Post metrics tracked', { 
      postId: data.postId, 
      measuredAtHours: data.measuredAtHours,
      userId: req.user.id 
    });

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to track post metrics';
    logger.error('Post metrics tracking error', { error: message });
    return res.status(400).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/caption-performance
 * Get caption style performance summary
 */
router.get('/caption-performance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Query the view
    const result = await pool.query(`SELECT * FROM caption_performance ORDER BY choice_rate DESC`);

    return res.status(200).json({ performance: result.rows });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get caption performance';
    logger.error('Caption performance query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/subreddit-performance
 * Get subreddit performance summary
 */
router.get('/subreddit-performance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Query the view with optional filters
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : req.user.id;
    
    let result;

    // Optionally filter by user
    if (req.query.myPostsOnly === 'true') {
      result = await pool.query(
        `SELECT 
          p.subreddit,
          COUNT(DISTINCT p.post_id) AS total_posts,
          AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 1) AS avg_upvotes_1h,
          AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) AS avg_upvotes_24h,
          AVG(pm.comments) FILTER (WHERE pm.measured_at_hours = 24) AS avg_comments_24h,
          SUM(CASE WHEN pm.removed THEN 1 ELSE 0 END)::NUMERIC / NULLIF(COUNT(pm.metric_id), 0) AS removal_rate,
          MAX(p.posted_at) AS last_posted_at
        FROM posts p
        LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
        WHERE p.creator_id = $1
        GROUP BY p.subreddit
        ORDER BY avg_upvotes_24h DESC NULLS LAST`,
        [userId]
      );
    } else {
      result = await pool.query(`SELECT * FROM subreddit_performance`);
    }

    return res.status(200).json({ performance: result.rows });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get subreddit performance';
    logger.error('Subreddit performance query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/my-preferences
 * Get user's caption style preferences
 */
router.get('/my-preferences', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM creator_caption_preferences WHERE creator_id = $1 ORDER BY times_chosen DESC`,
      [req.user.id]
    );

    return res.status(200).json({ preferences: result.rows });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get caption preferences';
    logger.error('Caption preferences query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/dashboard
 * Get comprehensive analytics dashboard data
 */
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get all relevant metrics in parallel
    const [captionPerf, subredditPerf, userPrefs, recentPosts] = await Promise.all([
      pool.query(`SELECT * FROM caption_performance ORDER BY choice_rate DESC`),
      pool.query(
        `SELECT 
          p.subreddit,
          COUNT(DISTINCT p.post_id) AS total_posts,
          AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) AS avg_upvotes_24h,
          AVG(pm.comments) FILTER (WHERE pm.measured_at_hours = 24) AS avg_comments_24h
        FROM posts p
        LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
        WHERE p.creator_id = $1
        GROUP BY p.subreddit
        ORDER BY avg_upvotes_24h DESC NULLS LAST
        LIMIT 10`,
        [req.user.id]
      ),
      pool.query(`SELECT * FROM creator_caption_preferences WHERE creator_id = $1`, [req.user.id]),
      pool.query(
        `SELECT 
          p.post_id, p.reddit_post_id, p.subreddit, p.posted_at,
          c.style, c.text as caption_text,
          pm.upvotes, pm.comments
        FROM posts p
        LEFT JOIN captions c ON p.caption_id = c.caption_id
        LEFT JOIN post_metrics pm ON p.post_id = pm.post_id AND pm.measured_at_hours = 24
        WHERE p.creator_id = $1
        ORDER BY p.posted_at DESC
        LIMIT 20`,
        [req.user.id]
      )
    ]);

    return res.status(200).json({
      captionPerformance: captionPerf.rows,
      subredditPerformance: subredditPerf.rows,
      userPreferences: userPrefs.rows,
      recentPosts: recentPosts.rows
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get dashboard data';
    logger.error('Dashboard query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as captionAnalyticsRouter };
