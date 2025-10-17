/**
 * Caption Metrics Polling Worker
 * Automatically updates post performance metrics at specific intervals
 */

import { pool } from '../../db.js';
import { logger } from '../../bootstrap/logger.js';

interface PostToUpdate {
  post_id: number;
  reddit_post_id: string;
  subreddit: string;
  posted_at: Date;
  hours_ago: number;
}

/**
 * Poll Reddit for post metrics and update database
 * Runs at checkpoints: 1h, 6h, 12h, 24h, 48h after posting
 */
export async function pollCaptionMetrics(): Promise<void> {
  try {
    logger.info('⏰ Starting caption metrics polling...');

    // Get posts from last 48 hours that need updates
    const postsResult = await pool.query<PostToUpdate>(`
      SELECT 
        p.post_id,
        p.reddit_post_id,
        p.subreddit,
        p.posted_at,
        EXTRACT(EPOCH FROM (NOW() - p.posted_at)) / 3600 AS hours_ago
      FROM posts p
      WHERE p.posted_at > NOW() - INTERVAL '48 hours'
        AND p.reddit_post_id IS NOT NULL
        AND p.posted_at IS NOT NULL
      ORDER BY p.posted_at DESC
    `);

    const checkpoints = [1, 6, 12, 24, 48];
    let updated = 0;
    let errors = 0;

    for (const post of postsResult.rows) {
      const hoursAgo = Math.floor(post.hours_ago);
      
      // Find nearest checkpoint that we should be at
      const nearestCheckpoint = checkpoints.find(cp => 
        Math.abs(hoursAgo - cp) < 0.5 // Within 30 minutes of checkpoint
      );
      
      if (!nearestCheckpoint) continue;

      // Check if we already have metrics for this checkpoint
      const existingMetrics = await pool.query(
        `SELECT 1 FROM post_metrics 
         WHERE post_id = $1 AND measured_at_hours = $2
         AND measured_at > NOW() - INTERVAL '2 hours'`, // Don't re-poll if updated recently
        [post.post_id, nearestCheckpoint]
      );

      if (existingMetrics.rows.length > 0) continue;

      try {
        // Fetch from Reddit API
        const redditData = await fetchRedditPostMetrics(post.reddit_post_id);
        
        if (redditData) {
          await pool.query(`
            INSERT INTO post_metrics (
              post_id, measured_at_hours, upvotes, downvotes, comments, 
              vote_rate_per_min, removed, measured_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (post_id, measured_at_hours) DO UPDATE SET
              upvotes = EXCLUDED.upvotes,
              downvotes = EXCLUDED.downvotes,
              comments = EXCLUDED.comments,
              vote_rate_per_min = EXCLUDED.vote_rate_per_min,
              removed = EXCLUDED.removed,
              measured_at = NOW()
          `, [
            post.post_id,
            nearestCheckpoint,
            redditData.ups,
            redditData.downs || 0,
            redditData.num_comments,
            calculateVoteRate(redditData.ups, nearestCheckpoint),
            redditData.removed || false
          ]);
          
          updated++;
          logger.info(`✅ Updated metrics for post ${post.reddit_post_id} at ${nearestCheckpoint}h`);
        }
      } catch (error) {
        errors++;
        logger.error(`❌ Failed to poll ${post.reddit_post_id}:`, error);
      }

      // Rate limiting - don't hammer Reddit API
      await sleep(2000); // 2 second delay between requests
    }

    logger.info(`📊 Caption metrics polling complete: ${updated} updated, ${errors} errors`);

  } catch (error) {
    logger.error('Caption metrics polling failed:', error);
  }
}

/**
 * Fetch post data from Reddit API
 */
async function fetchRedditPostMetrics(redditPostId: string): Promise<{
  ups: number;
  downs: number;
  num_comments: number;
  removed: boolean;
} | null> {
  try {
    // Reddit API endpoint for post info
    const url = `https://www.reddit.com/api/info.json?id=${redditPostId}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ThottoPilot/1.0 (Analytics Bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.data?.children?.[0]?.data) {
      return null;
    }

    const postData = data.data.children[0].data;
    
    return {
      ups: postData.ups || 0,
      downs: postData.downs || 0,
      num_comments: postData.num_comments || 0,
      removed: postData.removed || postData.spam || false
    };

  } catch (error) {
    logger.error('Error fetching Reddit post metrics:', error);
    return null;
  }
}

/**
 * Calculate vote rate per minute
 */
function calculateVoteRate(upvotes: number, hoursAge: number): number {
  if (hoursAge === 0) return 0;
  const minutes = hoursAge * 60;
  return upvotes / minutes;
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
