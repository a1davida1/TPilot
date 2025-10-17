/**
 * Time Optimizer
 * Analyzes historical post performance to find optimal posting times
 */

import { pool } from '../../db.js';
import { logger } from '../../lib/logger.js';

interface TimeSlot {
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes: number;
  medianUpvotes: number;
  postCount: number;
  successRate: number;
  score: number;
}

interface UserPattern {
  subreddit: string | null;
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes: number;
  postCount: number;
  lastPostAt: Date | null;
}

interface OptimalTime {
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * Calculate optimal posting times for a specific subreddit
 */
export async function analyzeSubredditTimes(subreddit: string): Promise<TimeSlot[]> {
  try {
    const query = `
      SELECT
        EXTRACT(DOW FROM rp.created_at)::INTEGER as day_of_week,
        EXTRACT(HOUR FROM rp.created_at)::INTEGER as hour_of_day,
        AVG(pm.upvotes_24h)::DECIMAL(10,2) as avg_upvotes,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.upvotes_24h) as median_upvotes,
        COUNT(*) as post_count,
        (COUNT(*) FILTER (WHERE pm.upvotes_24h > (
          SELECT AVG(upvotes_24h) FROM post_metrics WHERE subreddit = $1
        )) * 100.0 / COUNT(*))::DECIMAL(5,2) as success_rate
      FROM reddit_posts rp
      JOIN post_metrics pm ON rp.id = pm.post_id
      WHERE rp.subreddit = $1
        AND pm.upvotes_24h IS NOT NULL
        AND rp.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY day_of_week, hour_of_day
      HAVING COUNT(*) >= 3
      ORDER BY avg_upvotes DESC
    `;

    const result = await pool.query(query, [subreddit]);

    const timeSlots: TimeSlot[] = result.rows.map((row) => ({
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
      avgUpvotes: parseFloat(row.avg_upvotes),
      medianUpvotes: parseInt(row.median_upvotes, 10),
      postCount: parseInt(row.post_count, 10),
      successRate: parseFloat(row.success_rate),
      score: 0 // Will be calculated next
    }));

    // Calculate scores using the database function
    for (const slot of timeSlots) {
      const scoreResult = await pool.query(
        'SELECT calculate_optimal_score($1, $2, $3) as score',
        [slot.avgUpvotes, slot.postCount, slot.successRate]
      );
      slot.score = scoreResult.rows[0].score;
    }

    return timeSlots;
  } catch (error) {
    logger.error('Failed to analyze subreddit times', { error, subreddit });
    return [];
  }
}

/**
 * Analyze user's personal posting patterns
 */
export async function analyzeUserPatterns(userId: number, subreddit?: string): Promise<UserPattern[]> {
  try {
    const query = `
      SELECT
        rp.subreddit,
        EXTRACT(DOW FROM rp.created_at)::INTEGER as day_of_week,
        EXTRACT(HOUR FROM rp.created_at)::INTEGER as hour_of_day,
        AVG(pm.upvotes_24h)::DECIMAL(10,2) as avg_upvotes,
        COUNT(*) as post_count,
        MAX(rp.created_at) as last_post_at
      FROM reddit_posts rp
      JOIN post_metrics pm ON rp.id = pm.post_id
      WHERE rp.user_id = $1
        ${subreddit ? 'AND rp.subreddit = $2' : ''}
        AND pm.upvotes_24h IS NOT NULL
        AND rp.created_at >= NOW() - INTERVAL '90 days'
      GROUP BY rp.subreddit, day_of_week, hour_of_day
      HAVING COUNT(*) >= 2
      ORDER BY avg_upvotes DESC
    `;

    const params = subreddit ? [userId, subreddit] : [userId];
    const result = await pool.query(query, params);

    return result.rows.map((row) => ({
      subreddit: row.subreddit,
      dayOfWeek: row.day_of_week,
      hourOfDay: row.hour_of_day,
      avgUpvotes: parseFloat(row.avg_upvotes),
      postCount: parseInt(row.post_count, 10),
      lastPostAt: row.last_post_at ? new Date(row.last_post_at) : null
    }));
  } catch (error) {
    logger.error('Failed to analyze user patterns', { error, userId });
    return [];
  }
}

/**
 * Get optimal posting times combining subreddit and user data
 */
export async function getOptimalTimes(
  userId: number,
  subreddit: string,
  count: number = 3
): Promise<OptimalTime[]> {
  try {
    // Get both subreddit-wide and user-specific patterns
    const [subredditTimes, userPatterns] = await Promise.all([
      analyzeSubredditTimes(subreddit),
      analyzeUserPatterns(userId, subreddit)
    ]);

    if (subredditTimes.length === 0) {
      logger.warn('No subreddit data available', { subreddit });
      return getDefaultOptimalTimes();
    }

    // Merge user patterns with subreddit data for personalization
    const personalizedTimes = subredditTimes.map((slot) => {
      const userPattern = userPatterns.find(
        (p) => p.dayOfWeek === slot.dayOfWeek && p.hourOfDay === slot.hourOfDay && p.subreddit === subreddit
      );

      let finalScore = slot.score;
      let confidence: 'low' | 'medium' | 'high' = 'medium';

      if (userPattern) {
        // User has posted at this time before - boost score
        const userBoost = Math.min(20, userPattern.postCount * 5);
        finalScore += userBoost;
        confidence = 'high';
      }

      // Confidence based on data quality
      if (slot.postCount < 5) confidence = 'low';
      else if (slot.postCount >= 20) confidence = 'high';

      return {
        dayOfWeek: slot.dayOfWeek,
        hourOfDay: slot.hourOfDay,
        avgUpvotes: Math.round(userPattern?.avgUpvotes || slot.avgUpvotes),
        score: finalScore,
        confidence,
        reason: generateReason(slot, userPattern)
      };
    });

    // Sort by score and return top N
    return personalizedTimes
      .sort((a, b) => b.score - a.score)
      .slice(0, count);

  } catch (error) {
    logger.error('Failed to get optimal times', { error, userId, subreddit });
    return getDefaultOptimalTimes();
  }
}

/**
 * Generate human-readable reason for why a time is optimal
 */
function generateReason(slot: TimeSlot, userPattern?: UserPattern): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[slot.dayOfWeek];
  const hour12 = slot.hourOfDay % 12 || 12;
  const ampm = slot.hourOfDay < 12 ? 'AM' : 'PM';
  const timeStr = `${dayName}s at ${hour12}${ampm}`;

  if (userPattern && userPattern.postCount >= 3) {
    return `Your posts at ${timeStr} average ${Math.round(userPattern.avgUpvotes)} upvotes`;
  }

  return `${timeStr} averages ${Math.round(slot.avgUpvotes)} upvotes in this subreddit`;
}

/**
 * Get default optimal times when no data available
 */
function getDefaultOptimalTimes(): OptimalTime[] {
  // Industry best practices: Evening hours on weekdays
  return [
    {
      dayOfWeek: 2, // Tuesday
      hourOfDay: 18, // 6 PM
      avgUpvotes: 0,
      score: 50,
      confidence: 'low',
      reason: 'Recommended based on platform-wide trends'
    },
    {
      dayOfWeek: 3, // Wednesday
      hourOfDay: 20, // 8 PM
      avgUpvotes: 0,
      score: 48,
      confidence: 'low',
      reason: 'Peak engagement time across Reddit'
    },
    {
      dayOfWeek: 5, // Friday
      hourOfDay: 19, // 7 PM
      avgUpvotes: 0,
      score: 45,
      confidence: 'low',
      reason: 'Weekend traffic starts building'
    }
  ];
}

/**
 * Update optimal_posting_times table with fresh analysis
 */
export async function updateOptimalTimesCache(subreddit: string): Promise<void> {
  try {
    const timeSlots = await analyzeSubredditTimes(subreddit);

    for (const slot of timeSlots) {
      await pool.query(
        `INSERT INTO optimal_posting_times 
         (subreddit, day_of_week, hour_of_day, avg_upvotes, median_upvotes, post_count, success_rate, score, last_calculated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (subreddit, day_of_week, hour_of_day)
         DO UPDATE SET
           avg_upvotes = EXCLUDED.avg_upvotes,
           median_upvotes = EXCLUDED.median_upvotes,
           post_count = EXCLUDED.post_count,
           success_rate = EXCLUDED.success_rate,
           score = EXCLUDED.score,
           last_calculated_at = NOW()`,
        [
          subreddit,
          slot.dayOfWeek,
          slot.hourOfDay,
          slot.avgUpvotes,
          slot.medianUpvotes,
          slot.postCount,
          slot.successRate,
          slot.score
        ]
      );
    }

    logger.info('Updated optimal times cache', { subreddit, slotsUpdated: timeSlots.length });
  } catch (error) {
    logger.error('Failed to update optimal times cache', { error, subreddit });
  }
}

/**
 * Update user_posting_patterns table
 */
export async function updateUserPatternsCache(userId: number): Promise<void> {
  try {
    const patterns = await analyzeUserPatterns(userId);

    for (const pattern of patterns) {
      const preferenceScore = Math.min(100, Math.round(pattern.avgUpvotes / 5));

      await pool.query(
        `INSERT INTO user_posting_patterns
         (user_id, subreddit, day_of_week, hour_of_day, avg_upvotes, post_count, last_post_at, preference_score, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (user_id, subreddit, day_of_week, hour_of_day)
         DO UPDATE SET
           avg_upvotes = EXCLUDED.avg_upvotes,
           post_count = EXCLUDED.post_count,
           last_post_at = EXCLUDED.last_post_at,
           preference_score = EXCLUDED.preference_score,
           updated_at = NOW()`,
        [
          userId,
          pattern.subreddit,
          pattern.dayOfWeek,
          pattern.hourOfDay,
          pattern.avgUpvotes,
          pattern.postCount,
          pattern.lastPostAt,
          preferenceScore
        ]
      );
    }

    logger.info('Updated user patterns cache', { userId, patternsUpdated: patterns.length });
  } catch (error) {
    logger.error('Failed to update user patterns cache', { error, userId });
  }
}

/**
 * Predict upvotes for a specific time slot
 */
export async function predictUpvotes(
  userId: number,
  subreddit: string,
  scheduledTime: Date
): Promise<{ predicted: number; confidence: 'low' | 'medium' | 'high' }> {
  const dayOfWeek = scheduledTime.getDay();
  const hourOfDay = scheduledTime.getHours();

  try {
    // Check user's historical performance at this time
    const userResult = await pool.query(
      `SELECT avg_upvotes, post_count
       FROM user_posting_patterns
       WHERE user_id = $1 AND subreddit = $2 AND day_of_week = $3 AND hour_of_day = $4`,
      [userId, subreddit, dayOfWeek, hourOfDay]
    );

    if (userResult.rows.length > 0 && userResult.rows[0].post_count >= 3) {
      return {
        predicted: Math.round(parseFloat(userResult.rows[0].avg_upvotes)),
        confidence: 'high'
      };
    }

    // Fall back to subreddit average
    const subredditResult = await pool.query(
      `SELECT avg_upvotes, post_count
       FROM optimal_posting_times
       WHERE subreddit = $1 AND day_of_week = $2 AND hour_of_day = $3`,
      [subreddit, dayOfWeek, hourOfDay]
    );

    if (subredditResult.rows.length > 0) {
      const postCount = parseInt(subredditResult.rows[0].post_count, 10);
      return {
        predicted: Math.round(parseFloat(subredditResult.rows[0].avg_upvotes)),
        confidence: postCount >= 10 ? 'medium' : 'low'
      };
    }

    // No data available
    return { predicted: 100, confidence: 'low' };

  } catch (error) {
    logger.error('Failed to predict upvotes', { error, userId, subreddit });
    return { predicted: 100, confidence: 'low' };
  }
}
