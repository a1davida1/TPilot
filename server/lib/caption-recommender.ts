/**
 * Caption Style Recommender
 * Uses historical performance data to recommend which caption style to show first
 */

import { pool } from '../db.js';
import { logger } from '../bootstrap/logger.js';

export interface StyleRecommendation {
  style: 'flirty' | 'slutty';
  confidence: number; // 0-1
  reason: string;
  stats?: {
    timesChosen: number;
    avgPerformance: number;
    totalPosts: number;
  };
}

/**
 * Recommend caption style based on user's historical performance
 */
export async function recommendStyle(
  userId: number,
  options: {
    subreddit?: string;
    device?: string;
  } = {}
): Promise<StyleRecommendation> {
  try {
    // Query user's historical preferences with performance data
    const result = await pool.query(
      `SELECT 
        c.style,
        COUNT(DISTINCT cc.choice_id) as times_chosen,
        AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) as avg_performance,
        COUNT(DISTINCT p.post_id) as total_posts
       FROM caption_pairs cp
       JOIN caption_choices cc ON cp.pair_id = cc.pair_id
       JOIN captions c ON cc.chosen_caption_id = c.caption_id
       LEFT JOIN posts p ON cc.chosen_caption_id = p.caption_id
       LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
       WHERE cp.creator_id = $1
         AND ($2::text IS NULL OR p.subreddit = $2)
         AND ($3::text IS NULL OR cp.device_bucket = $3)
         AND p.posted_at > NOW() - INTERVAL '90 days'
       GROUP BY c.style
       ORDER BY avg_performance DESC NULLS LAST, times_chosen DESC
       LIMIT 1`,
      [userId, options.subreddit || null, options.device || null]
    );

    if (result.rows.length > 0) {
      const topStyle = result.rows[0];
      const avgUpvotes = Math.round(topStyle.avg_performance || 0);
      
      // Calculate confidence based on sample size
      const sampleSize = parseInt(topStyle.times_chosen, 10);
      const confidence = Math.min(sampleSize / 15, 1); // Max confidence at 15+ selections
      
      let reason = `Your "${topStyle.style}" captions average ${avgUpvotes} upvotes`;
      if (options.subreddit) {
        reason += ` in r/${options.subreddit}`;
      }
      
      return {
        style: topStyle.style as 'flirty' | 'slutty',
        confidence,
        reason,
        stats: {
          timesChosen: sampleSize,
          avgPerformance: avgUpvotes,
          totalPosts: parseInt(topStyle.total_posts, 10)
        }
      };
    }

    // No user data - fall back to global best for this subreddit
    if (options.subreddit) {
      const globalResult = await pool.query(
        `SELECT 
          c.style,
          AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) as avg_performance,
          COUNT(DISTINCT p.post_id) as post_count
         FROM posts p
         JOIN captions c ON p.caption_id = c.caption_id
         LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
         WHERE p.subreddit = $1
           AND p.posted_at > NOW() - INTERVAL '90 days'
         GROUP BY c.style
         ORDER BY avg_performance DESC NULLS LAST
         LIMIT 1`,
        [options.subreddit]
      );

      if (globalResult.rows.length > 0) {
        const globalBest = globalResult.rows[0];
        return {
          style: globalBest.style as 'flirty' | 'slutty',
          confidence: 0.4, // Medium confidence for global data
          reason: `"${globalBest.style}" performs best in r/${options.subreddit} (community average)`
        };
      }
    }

    // Ultimate fallback - default to flirty (safer, broader appeal)
    return {
      style: 'flirty',
      confidence: 0.2,
      reason: 'No historical data yet - starting with playful style'
    };

  } catch (error) {
    logger.error('Error in recommendStyle:', error);
    
    // Fallback on error
    return {
      style: 'flirty',
      confidence: 0.1,
      reason: 'Using default style'
    };
  }
}

/**
 * Get style performance comparison for a user
 */
export async function getStyleComparison(userId: number): Promise<{
  flirty: { chosen: number; avgUpvotes: number; winRate: number };
  slutty: { chosen: number; avgUpvotes: number; winRate: number };
}> {
  const result = await pool.query(
    `SELECT 
      c.style,
      COUNT(DISTINCT cc.choice_id) as chosen_count,
      AVG(pm.upvotes) FILTER (WHERE pm.measured_at_hours = 24) as avg_upvotes
     FROM caption_pairs cp
     JOIN caption_choices cc ON cp.pair_id = cc.pair_id
     JOIN captions c ON cc.chosen_caption_id = c.caption_id
     LEFT JOIN posts p ON cc.chosen_caption_id = p.caption_id
     LEFT JOIN post_metrics pm ON p.post_id = pm.post_id
     WHERE cp.creator_id = $1
     GROUP BY c.style`,
    [userId]
  );

  const stats = {
    flirty: { chosen: 0, avgUpvotes: 0, winRate: 0 },
    slutty: { chosen: 0, avgUpvotes: 0, winRate: 0 }
  };

  let totalChosen = 0;
  for (const row of result.rows) {
    const style = row.style as 'flirty' | 'slutty';
    const chosen = parseInt(row.chosen_count, 10);
    totalChosen += chosen;
    
    stats[style] = {
      chosen,
      avgUpvotes: Math.round(row.avg_upvotes || 0),
      winRate: 0 // Will calculate after
    };
  }

  // Calculate win rates
  if (totalChosen > 0) {
    stats.flirty.winRate = Math.round((stats.flirty.chosen / totalChosen) * 100);
    stats.slutty.winRate = Math.round((stats.slutty.chosen / totalChosen) * 100);
  }

  return stats;
}
