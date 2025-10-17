/**
 * Health Monitoring API Routes
 * Account and community health checks
 */

import { Router, type Response } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { pool } from '../db.js';
import { logger } from '../lib/logger.js';
import {
  runAccountHealthCheck,
  checkSubredditHealth,
  storeHealthCheck
} from '../lib/health/health-monitor.js';

const router = Router();

/**
 * GET /api/health/account-status
 * Get current account health status
 */
router.get('/account-status', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      'SELECT * FROM user_health_dashboard WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // No health data yet - run initial check
      const healthCheck = await runAccountHealthCheck(req.user.id);
      return res.status(200).json({
        overallScore: healthCheck.overallScore,
        checks: healthCheck.checks,
        alerts: [],
        message: 'Initial health check completed'
      });
    }

    const health = result.rows[0];

    // Get active alerts
    const alertsResult = await pool.query(
      `SELECT * FROM health_alerts
       WHERE user_id = $1 AND is_resolved = false
       ORDER BY severity DESC, created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    return res.status(200).json({
      overallScore: health.overall_health_score,
      metrics: {
        karma: health.karma_score,
        removalRate: health.post_removal_rate,
        shadowbanStatus: health.shadowban_status,
        engagementTrend: health.engagement_trend,
        postsLast7Days: health.posts_last_7_days,
        avgUpvotesLast7Days: health.avg_upvotes_last_7_days
      },
      alerts: alertsResult.rows,
      lastCheck: health.last_check_at
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get account status';
    logger.error('Account status error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/health/run-checks
 * Manually trigger health checks
 */
router.post('/run-checks', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const healthCheck = await runAccountHealthCheck(req.user.id);

    return res.status(200).json({
      overallScore: healthCheck.overallScore,
      checks: healthCheck.checks,
      message: 'Health checks completed'
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to run health checks';
    logger.error('Run checks error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/health/subreddit/:name
 * Get subreddit health status
 */
router.get('/subreddit/:name', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;

    if (!name) {
      return res.status(400).json({ error: 'Subreddit name required' });
    }

    const healthCheck = await checkSubredditHealth(name);
    await storeHealthCheck('subreddit_health', 'subreddit', name, healthCheck);

    return res.status(200).json({
      subreddit: name,
      status: healthCheck.status,
      score: healthCheck.score,
      details: healthCheck.details
    });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to check subreddit health';
    logger.error('Subreddit health error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/health/alerts
 * Get user's health alerts
 */
router.get('/alerts', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { resolved } = req.query;
    const showResolved = resolved === 'true';

    const query = showResolved
      ? 'SELECT * FROM health_alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50'
      : 'SELECT * FROM health_alerts WHERE user_id = $1 AND is_resolved = false ORDER BY severity DESC, created_at DESC';

    const result = await pool.query(query, [req.user.id]);

    return res.status(200).json({ alerts: result.rows });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get alerts';
    logger.error('Get alerts error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * PUT /api/health/alerts/:id/resolve
 * Mark alert as resolved
 */
router.put('/alerts/:id/resolve', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const alertId = parseInt(req.params.id, 10);

    await pool.query(
      `UPDATE health_alerts
       SET is_resolved = true, resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [alertId, req.user.id]
    );

    return res.status(200).json({ success: true });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to resolve alert';
    logger.error('Resolve alert error', { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * GET /api/health/history
 * Get health check history
 */
router.get('/history', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { days } = req.query;
    const daysBack = days ? Math.min(parseInt(days as string, 10), 90) : 30;

    const result = await pool.query(
      `SELECT check_type, status, score, details, checked_at
       FROM health_checks
       WHERE target_type = 'user' AND target_id = $1
         AND checked_at >= NOW() - INTERVAL '${daysBack} days'
       ORDER BY checked_at DESC
       LIMIT 100`,
      [req.user.id.toString()]
    );

    return res.status(200).json({ history: result.rows, daysBack });

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to get history';
    logger.error('Get history error', { error: message });
    return res.status(500).json({ error: message });
  }
});

export default router;
