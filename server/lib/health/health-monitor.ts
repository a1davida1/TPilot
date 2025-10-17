/**
 * Health Monitoring Service
 * Proactive monitoring of account and community health
 */

import { pool } from '../../db.js';
import { logger } from '../logger.js';

interface HealthCheckResult {
  status: 'pass' | 'warn' | 'fail' | 'unknown';
  score: number;
  details: Record<string, unknown>;
}

interface AlertParams {
  userId: number;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  actionRequired?: string;
  relatedTarget?: string;
}

/**
 * Check for shadowban indicators
 */
export async function checkShadowban(userId: number): Promise<HealthCheckResult> {
  try {
    // Query recent posts and check if they appear in subreddit listings
    const result = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE removed = true) as removed_count
       FROM reddit_posts
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    const total = parseInt(result.rows[0]?.total || '0', 10);
    const removed = parseInt(result.rows[0]?.removed_count || '0', 10);

    if (total === 0) {
      return {
        status: 'unknown',
        score: 50,
        details: { reason: 'Not enough recent posts to check' }
      };
    }

    const removalRate = (removed / total) * 100;

    // Shadowban suspected if >50% of posts not visible
    if (removalRate > 50) {
      return {
        status: 'fail',
        score: 0,
        details: {
          removalRate,
          totalPosts: total,
          removedPosts: removed,
          suspicion: 'high'
        }
      };
    } else if (removalRate > 30) {
      return {
        status: 'warn',
        score: 40,
        details: {
          removalRate,
          totalPosts: total,
          removedPosts: removed,
          suspicion: 'moderate'
        }
      };
    }

    return {
      status: 'pass',
      score: 100,
      details: {
        removalRate,
        totalPosts: total,
        removedPosts: removed
      }
    };
  } catch (error) {
    logger.error('Shadowban check failed', { error, userId });
    return { status: 'unknown', score: 50, details: { error: 'Check failed' } };
  }
}

/**
 * Check account removal rate
 */
export async function checkRemovalRate(userId: number): Promise<HealthCheckResult> {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE removed = true) as removed
       FROM reddit_posts
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );

    const total = parseInt(result.rows[0]?.total || '0', 10);
    const removed = parseInt(result.rows[0]?.removed || '0', 10);

    if (total === 0) {
      return {
        status: 'unknown',
        score: 50,
        details: { reason: 'No posts in last 30 days' }
      };
    }

    const removalRate = (removed / total) * 100;

    if (removalRate > 25) {
      return {
        status: 'fail',
        score: Math.max(0, 100 - removalRate),
        details: { removalRate, total, removed, threshold: 'critical' }
      };
    } else if (removalRate > 15) {
      return {
        status: 'warn',
        score: 60,
        details: { removalRate, total, removed, threshold: 'warning' }
      };
    }

    return {
      status: 'pass',
      score: 90,
      details: { removalRate, total, removed }
    };
  } catch (error) {
    logger.error('Removal rate check failed', { error, userId });
    return { status: 'unknown', score: 50, details: { error: 'Check failed' } };
  }
}

/**
 * Check engagement drop
 */
export async function checkEngagementDrop(userId: number): Promise<HealthCheckResult> {
  try {
    // Compare last 7 days vs previous 7 days
    const result = await pool.query(
      `WITH recent AS (
        SELECT AVG(pm.upvotes_24h) as avg_recent
        FROM reddit_posts rp
        JOIN post_metrics pm ON rp.id = pm.post_id
        WHERE rp.user_id = $1
          AND rp.created_at >= NOW() - INTERVAL '7 days'
          AND pm.upvotes_24h IS NOT NULL
      ),
      previous AS (
        SELECT AVG(pm.upvotes_24h) as avg_previous
        FROM reddit_posts rp
        JOIN post_metrics pm ON rp.id = pm.post_id
        WHERE rp.user_id = $1
          AND rp.created_at >= NOW() - INTERVAL '14 days'
          AND rp.created_at < NOW() - INTERVAL '7 days'
          AND pm.upvotes_24h IS NOT NULL
      )
      SELECT 
        COALESCE(r.avg_recent, 0) as recent,
        COALESCE(p.avg_previous, 0) as previous
      FROM recent r, previous p`,
      [userId]
    );

    const recent = parseFloat(result.rows[0]?.recent || '0');
    const previous = parseFloat(result.rows[0]?.previous || '0');

    if (previous === 0 || recent === 0) {
      return {
        status: 'unknown',
        score: 50,
        details: { reason: 'Not enough data for comparison' }
      };
    }

    const dropPercent = ((previous - recent) / previous) * 100;

    if (dropPercent > 50) {
      return {
        status: 'fail',
        score: 30,
        details: {
          dropPercent: Math.round(dropPercent),
          recentAvg: Math.round(recent),
          previousAvg: Math.round(previous)
        }
      };
    } else if (dropPercent > 25) {
      return {
        status: 'warn',
        score: 60,
        details: {
          dropPercent: Math.round(dropPercent),
          recentAvg: Math.round(recent),
          previousAvg: Math.round(previous)
        }
      };
    }

    return {
      status: 'pass',
      score: 90,
      details: {
        dropPercent: Math.round(dropPercent),
        recentAvg: Math.round(recent),
        previousAvg: Math.round(previous),
        trend: dropPercent > 0 ? 'declining' : 'improving'
      }
    };
  } catch (error) {
    logger.error('Engagement drop check failed', { error, userId });
    return { status: 'unknown', score: 50, details: { error: 'Check failed' } };
  }
}

/**
 * Check subreddit health
 */
export async function checkSubredditHealth(subreddit: string): Promise<HealthCheckResult> {
  try {
    // Analyze recent activity in the subreddit
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_posts,
        AVG(pm.upvotes_24h) as avg_upvotes,
        COUNT(*) FILTER (WHERE rp.removed = true) as removed_count
       FROM reddit_posts rp
       LEFT JOIN post_metrics pm ON rp.id = pm.post_id
       WHERE rp.subreddit = $1
         AND rp.created_at >= NOW() - INTERVAL '7 days'`,
      [subreddit]
    );

    const totalPosts = parseInt(result.rows[0]?.total_posts || '0', 10);
    const avgUpvotes = parseFloat(result.rows[0]?.avg_upvotes || '0');
    const removed = parseInt(result.rows[0]?.removed_count || '0');

    if (totalPosts === 0) {
      return {
        status: 'warn',
        score: 40,
        details: { reason: 'No recent activity - subreddit may be dying' }
      };
    }

    const removalRate = (removed / totalPosts) * 100;
    const postsPerDay = totalPosts / 7;

    // Red flags
    const isDying = postsPerDay < 1; // Less than 1 post per day
    const highRemovalRate = removalRate > 30;
    const lowEngagement = avgUpvotes < 10;

    if (isDying || highRemovalRate) {
      return {
        status: 'fail',
        score: 20,
        details: {
          postsPerDay: Math.round(postsPerDay * 10) / 10,
          avgUpvotes: Math.round(avgUpvotes),
          removalRate: Math.round(removalRate),
          isDying,
          highRemovalRate,
          lowEngagement
        }
      };
    } else if (lowEngagement) {
      return {
        status: 'warn',
        score: 50,
        details: {
          postsPerDay: Math.round(postsPerDay * 10) / 10,
          avgUpvotes: Math.round(avgUpvotes),
          removalRate: Math.round(removalRate),
          lowEngagement
        }
      };
    }

    return {
      status: 'pass',
      score: 80,
      details: {
        postsPerDay: Math.round(postsPerDay * 10) / 10,
        avgUpvotes: Math.round(avgUpvotes),
        removalRate: Math.round(removalRate)
      }
    };
  } catch (error) {
    logger.error('Subreddit health check failed', { error, subreddit });
    return { status: 'unknown', score: 50, details: { error: 'Check failed' } };
  }
}

/**
 * Check content similarity (repetitiveness)
 */
export async function checkContentSimilarity(userId: number): Promise<HealthCheckResult> {
  try {
    // Get recent titles and check for repetitive patterns
    const result = await pool.query(
      `SELECT title
       FROM reddit_posts
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const titles = result.rows.map((r: { title: string }) => r.title);

    if (titles.length < 5) {
      return {
        status: 'unknown',
        score: 50,
        details: { reason: 'Not enough posts to analyze' }
      };
    }

    // Simple pattern detection: check for repeated words/phrases
    const wordFreq: Record<string, number> = {};
    titles.forEach((title) => {
      const words = title.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 3) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });
    });

    const maxFreq = Math.max(...Object.values(wordFreq));
    const similarityScore = Math.min(100, (maxFreq / titles.length) * 200);

    // Check for template usage (titles that are too similar)
    const uniqueTitles = new Set(titles);
    const diversityScore = (uniqueTitles.size / titles.length) * 100;

    if (diversityScore < 30 || similarityScore > 70) {
      return {
        status: 'fail',
        score: 20,
        details: {
          diversityScore: Math.round(diversityScore),
          similarityScore: Math.round(similarityScore),
          totalTitles: titles.length,
          uniqueTitles: uniqueTitles.size,
          mostUsedWord: Object.entries(wordFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
        }
      };
    } else if (diversityScore < 50 || similarityScore > 50) {
      return {
        status: 'warn',
        score: 50,
        details: {
          diversityScore: Math.round(diversityScore),
          similarityScore: Math.round(similarityScore),
          totalTitles: titles.length,
          uniqueTitles: uniqueTitles.size
        }
      };
    }

    return {
      status: 'pass',
      score: 90,
      details: {
        diversityScore: Math.round(diversityScore),
        similarityScore: Math.round(similarityScore),
        totalTitles: titles.length,
        uniqueTitles: uniqueTitles.size
      }
    };
  } catch (error) {
    logger.error('Content similarity check failed', { error, userId });
    return { status: 'unknown', score: 50, details: { error: 'Check failed' } };
  }
}

/**
 * Store health check result
 */
export async function storeHealthCheck(
  checkType: string,
  targetType: 'user' | 'subreddit' | 'post',
  targetId: string,
  result: HealthCheckResult
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO health_checks (check_type, target_type, target_id, status, score, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [checkType, targetType, targetId, result.status, result.score, JSON.stringify(result.details)]
    );
  } catch (error) {
    logger.error('Failed to store health check', { error, checkType, targetId });
  }
}

/**
 * Create health alert
 */
export async function createAlert(params: AlertParams): Promise<void> {
  try {
    await pool.query(
      `SELECT create_health_alert($1, $2, $3, $4, $5, $6, $7)`,
      [
        params.userId,
        params.alertType,
        params.severity,
        params.title,
        params.message,
        params.actionRequired || null,
        params.relatedTarget || null
      ]
    );
  } catch (error) {
    logger.error('Failed to create alert', { error, params });
  }
}

/**
 * Run comprehensive account health check
 */
export async function runAccountHealthCheck(userId: number): Promise<{
  overallScore: number;
  checks: Record<string, HealthCheckResult>;
}> {
  logger.info('Running account health check', { userId });

  const checks: Record<string, HealthCheckResult> = {};

  // Run all checks in parallel
  const [shadowban, removalRate, engagement, similarity] = await Promise.all([
    checkShadowban(userId),
    checkRemovalRate(userId),
    checkEngagementDrop(userId),
    checkContentSimilarity(userId)
  ]);

  checks.shadowban = shadowban;
  checks.removal_rate = removalRate;
  checks.engagement = engagement;
  checks.content_similarity = similarity;

  // Store all results
  await Promise.all([
    storeHealthCheck('account_shadowban', 'user', userId.toString(), shadowban),
    storeHealthCheck('account_removal_rate', 'user', userId.toString(), removalRate),
    storeHealthCheck('engagement_drop', 'user', userId.toString(), engagement),
    storeHealthCheck('content_similarity', 'user', userId.toString(), similarity)
  ]);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    (shadowban.score * 0.4 + removalRate.score * 0.3 + engagement.score * 0.2 + similarity.score * 0.1)
  );

  // Create alerts for failures
  if (shadowban.status === 'fail') {
    await createAlert({
      userId,
      alertType: 'shadowban_suspected',
      severity: 'critical',
      title: '🚨 Possible Shadowban Detected',
      message: `${shadowban.details.removalRate}% of your recent posts are not visible. This may indicate a shadowban.`,
      actionRequired: 'Check r/ShadowBan or contact Reddit support',
      relatedTarget: 'account'
    });
  }

  if (removalRate.status === 'fail') {
    await createAlert({
      userId,
      alertType: 'high_removal_rate',
      severity: 'warning',
      title: '⚠️ High Post Removal Rate',
      message: `${removalRate.details.removalRate}% of your posts are being removed (normal: <15%).`,
      actionRequired: 'Review subreddit rules and avoid promotional content',
      relatedTarget: 'account'
    });
  }

  if (engagement.status === 'fail') {
    await createAlert({
      userId,
      alertType: 'engagement_drop',
      severity: 'warning',
      title: '📉 Engagement Trending Down',
      message: `Your average upvotes dropped ${engagement.details.dropPercent}% this week.`,
      actionRequired: 'Consider changing posting times or content strategy',
      relatedTarget: 'account'
    });
  }

  if (similarity.status === 'fail') {
    await createAlert({
      userId,
      alertType: 'content_repetitive',
      severity: 'info',
      title: 'ℹ️ Content Appears Repetitive',
      message: `Your titles have low diversity (${similarity.details.diversityScore}%). Reddit may flag this as spam.`,
      actionRequired: 'Vary your title format and wording',
      relatedTarget: 'account'
    });
  }

  return { overallScore, checks };
}
