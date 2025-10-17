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
router.post('/caption-shown', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.post('/caption-choice', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.post('/protection-metrics', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.post('/post-submit', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.post('/post-metrics', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.get('/caption-performance', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.get('/subreddit-performance', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.get('/my-preferences', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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
router.get('/dashboard', authenticateToken(true), async (req: AuthRequest, res: Response) => {
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

/**
 * GET /api/caption-analytics/recommend-style
 * Get AI recommendation for which caption style to use
 */
router.get('/recommend-style', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { recommendStyle, getStyleComparison } = await import('../lib/caption-recommender.js');
    
    const subreddit = req.query.subreddit as string | undefined;
    const device = req.query.device as string | undefined;

    const [recommendation, comparison] = await Promise.all([
      recommendStyle(req.user.id, { subreddit, device }),
      getStyleComparison(req.user.id)
    ]);

    return res.status(200).json({
      recommendation,
      comparison
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get style recommendation';
    logger.error('Style recommendation error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/badges
 * Get user's badges and progress
 */
router.get('/badges', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { calculateBadges } = await import('../lib/badge-calculator.js');
    const badges = await calculateBadges(req.user.id);

    return res.status(200).json({ badges });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get badges';
    logger.error('Badges query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/check-badges
 * Check and auto-award newly earned badges
 */
router.post('/check-badges', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { checkAndAwardBadges } = await import('../lib/badge-calculator.js');
    const newBadges = await checkAndAwardBadges(req.user.id);

    return res.status(200).json({ newBadges });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to check badges';
    logger.error('Badge check error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/leaderboard
 * Get global leaderboard rankings
 */
router.get('/leaderboard', authenticateToken(false), async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string || 'upvotes';
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);

    let query = '';
    
    if (category === 'upvotes') {
      query = `SELECT * FROM user_leaderboard ORDER BY avg_upvotes_24h DESC NULLS LAST LIMIT $1`;
    } else if (category === 'consistency') {
      query = `SELECT * FROM user_leaderboard ORDER BY upvote_variance ASC NULLS LAST LIMIT $1`;
    } else if (category === 'badges') {
      query = `SELECT * FROM user_leaderboard ORDER BY badge_count DESC, avg_upvotes_24h DESC LIMIT $1`;
    } else {
      query = `SELECT * FROM user_leaderboard ORDER BY last_post_at DESC LIMIT $1`;
    }

    const result = await pool.query(query, [limit]);

    return res.status(200).json({ leaderboard: result.rows, category });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get leaderboard';
    logger.error('Leaderboard query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/submit-prediction
 * Submit a prediction for which caption style will perform better
 */
router.post('/submit-prediction', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { pairId, predictedStyle, confidence } = req.body;

    if (!pairId || !predictedStyle) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await pool.query(
      `INSERT INTO caption_predictions (pair_id, user_id, predicted_style, confidence_score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pair_id, user_id) DO UPDATE SET
         predicted_style = EXCLUDED.predicted_style,
         confidence_score = EXCLUDED.confidence_score`,
      [pairId, req.user.id, predictedStyle, confidence || 3]
    );

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to submit prediction';
    logger.error('Prediction submission error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/prediction-accuracy
 * Get user's prediction accuracy stats
 */
router.get('/prediction-accuracy', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM prediction_accuracy WHERE user_id = $1`,
      [req.user.id]
    );

    return res.status(200).json({ 
      accuracy: result.rows[0] || { total_predictions: 0, correct_predictions: 0, accuracy_rate: 0 }
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get prediction accuracy';
    logger.error('Prediction accuracy error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/daily-challenge
 * Get current daily challenge
 */
router.get('/daily-challenge', authenticateToken(false), async (_req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await pool.query(
      `SELECT * FROM daily_challenges WHERE challenge_date = $1`,
      [today]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No challenge for today' });
    }

    return res.status(200).json({ challenge: result.rows[0] });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get daily challenge';
    logger.error('Daily challenge query error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/submit-challenge
 * Submit entry for daily challenge
 */
router.post('/submit-challenge', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { challengeId, caption } = req.body;

    if (!challengeId || !caption) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await pool.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, caption)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id, user_id) DO UPDATE SET
         caption = EXCLUDED.caption`,
      [challengeId, req.user.id, caption]
    );

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to submit challenge';
    logger.error('Challenge submission error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/vote-challenge
 * Vote on a challenge submission
 */
router.post('/vote-challenge', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'Missing submission ID' });
    }

    await pool.query(
      `INSERT INTO challenge_votes (submission_id, voter_id)
       VALUES ($1, $2)
       ON CONFLICT (submission_id, voter_id) DO NOTHING`,
      [submissionId, req.user.id]
    );

    // Update vote count
    await pool.query(
      `UPDATE challenge_submissions
       SET vote_count = (
         SELECT COUNT(*) FROM challenge_votes WHERE submission_id = $1
       )
       WHERE submission_id = $1`,
      [submissionId]
    );

    return res.status(201).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to vote';
    logger.error('Challenge vote error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/caption-analytics/suggest-improvement
 * Get AI-powered improvement suggestion for a caption
 */
router.post('/suggest-improvement', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { captionId, caption, style } = req.body;

    if (!caption || !style) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use Grok to generate improvement
    const { openrouterChat } = await import('../lib/openrouter.js');
    
    const prompt = `This ${style} caption was NOT chosen by the user:
"${caption}"

Analyze why it might have been rejected and suggest ONE specific improvement.
Be concise (1-2 sentences). Focus on actionable changes.`;

    const suggestion = await openrouterChat({
      model: 'x-ai/grok-4-fast',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7
    });

    // Store the improvement
    if (captionId) {
      await pool.query(
        `INSERT INTO caption_improvements (caption_id, user_id, suggestion)
         VALUES ($1, $2, $3)`,
        [captionId, req.user.id, suggestion]
      );
    }

    return res.status(200).json({ suggestion });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to generate suggestion';
    logger.error('Improvement suggestion error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/caption-analytics/export-training-data
 * Export caption data in JSONL format for AI fine-tuning (Admin only)
 */
router.get('/export-training-data', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user is admin
    const { storage } = await import('../storage.js');
    const user = await storage.getUserById(req.user.id);
    
    if (!user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT 
        c.caption_id,
        c.text as caption,
        c.style,
        c.model,
        c.category,
        c.tags,
        cc.chosen_caption_id = c.caption_id as was_chosen,
        cc.edited,
        cc.edit_delta_chars,
        cc.time_to_choice_ms,
        pm.upvotes,
        pm.comments,
        p.subreddit,
        p.nsfw_flag,
        cp.device_bucket,
        p.posted_at
      FROM captions c
      JOIN caption_pairs cp ON c.caption_id IN (cp.caption_id_a, cp.caption_id_b)
      LEFT JOIN caption_choices cc ON cp.pair_id = cc.pair_id
      LEFT JOIN posts p ON c.caption_id = p.caption_id
      LEFT JOIN post_metrics pm ON p.post_id = pm.post_id AND pm.measured_at_hours = 24
      WHERE p.posted_at > NOW() - INTERVAL '90 days'
      ORDER BY p.posted_at DESC
    `);

    // Convert to JSONL for OpenAI/Anthropic fine-tuning
    const jsonl = result.rows.map(row => JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `Generate ${row.style} Reddit captions. Be playful, suggestive, under 200 chars.`
        },
        {
          role: 'user',
          content: `Create a ${row.style} caption for r/${row.subreddit || 'reddit'}. Category: ${row.category || 'general'}`
        },
        {
          role: 'assistant',
          content: row.caption
        }
      ],
      metadata: {
        caption_id: row.caption_id,
        was_chosen: row.was_chosen,
        upvotes: row.upvotes,
        comments: row.comments,
        edited: row.edited,
        edit_delta: row.edit_delta_chars,
        time_to_choice_ms: row.time_to_choice_ms,
        device: row.device_bucket,
        model: row.model,
        posted_at: row.posted_at
      }
    })).join('\n');

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="caption-training-${Date.now()}.jsonl"`);
    return res.send(jsonl);

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to export training data';
    logger.error('Training data export error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export { router as captionAnalyticsRouter };
