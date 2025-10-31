/**
 * Removal Detection Worker
 * 
 * Automatically detects post removals by checking Reddit API
 * Runs hourly to check recent posts for removal status
 */

import { Worker, Job } from 'bullmq';
import { db } from '../db.js';
import { redditPostOutcomes, users } from '@shared/schema';
import { eq, and, gte, isNull, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { HybridRedditClient } from '../lib/reddit/hybrid-client.js';
import { getRedisConnection } from '../lib/queue/index.js';

interface RemovalCheckJob {
  userId: number;
  postId: number;
  redditPostId: string;
  subreddit: string;
  postedAt: Date;
}

/**
 * Check if a post has been removed
 */
async function checkPostRemoval(job: Job<RemovalCheckJob>): Promise<void> {
  const { userId, postId, redditPostId, subreddit, postedAt } = job.data;

  try {
    logger.info('Checking post for removal', { postId, redditPostId, subreddit });

    // Get Reddit client for user
    const reddit = await HybridRedditClient.forUser(userId);
    if (!reddit) {
      logger.warn('No Reddit client available for user', { userId });
      return;
    }

    // Fetch post from Reddit
    const post = await reddit.getPost(redditPostId);

    if (!post) {
      logger.warn('Post not found on Reddit', { redditPostId });
      return;
    }

    // Check if post is removed
    const isRemoved = post.removed || post.spam || post.removed_by_category;
    
    if (isRemoved) {
      // Calculate time until removal
      const postedTime = new Date(postedAt).getTime();
      const now = Date.now();
      const timeUntilRemovalMinutes = Math.round((now - postedTime) / 60000);

      // Determine removal type and reason
      let removalType = 'unknown';
      let removalReason = 'Post was removed';

      if (post.removed_by_category) {
        removalType = post.removed_by_category; // 'moderator', 'automod_filtered', 'spam', etc.
      } else if (post.spam) {
        removalType = 'spam';
        removalReason = 'Marked as spam';
      } else if (post.removed) {
        removalType = 'moderator';
        removalReason = 'Removed by moderator';
      }

      // Try to get removal reason from mod note
      if (post.mod_note) {
        removalReason = post.mod_note;
      } else if (post.removal_reason) {
        removalReason = post.removal_reason;
      }

      // Update database
      await db
        .update(redditPostOutcomes)
        .set({
          removalType,
          removalReason,
          detectedAt: new Date(),
          timeUntilRemovalMinutes,
          status: 'removed',
          success: false,
        })
        .where(eq(redditPostOutcomes.id, postId));

      logger.info('Post removal detected and recorded', {
        postId,
        redditPostId,
        removalType,
        timeUntilRemovalMinutes,
      });
    } else {
      // Post is still live - update engagement metrics
      await db
        .update(redditPostOutcomes)
        .set({
          upvotes: post.score || 0,
          commentCount: post.num_comments || 0,
        })
        .where(eq(redditPostOutcomes.id, postId));

      logger.debug('Post still live, updated metrics', {
        postId,
        upvotes: post.score,
        comments: post.num_comments,
      });
    }
  } catch (error) {
    logger.error('Failed to check post removal', {
      error: error instanceof Error ? error.message : String(error),
      postId,
      redditPostId,
    });
    throw error; // Let Bull handle retry
  }
}

/**
 * Queue removal checks for recent posts
 */
export async function queueRemovalChecks(): Promise<number> {
  try {
    logger.info('Queueing removal checks for recent posts');

    // Get posts from last 7 days that haven't been checked for removal yet
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const postsToCheck = await db
      .select({
        id: redditPostOutcomes.id,
        userId: redditPostOutcomes.userId,
        redditPostId: redditPostOutcomes.redditPostId,
        subreddit: redditPostOutcomes.subreddit,
        occurredAt: redditPostOutcomes.occurredAt,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          gte(redditPostOutcomes.occurredAt, sevenDaysAgo),
          isNull(redditPostOutcomes.removalType), // Not yet checked
          sql`${redditPostOutcomes.redditPostId} IS NOT NULL` // Has Reddit post ID
        )
      )
      .limit(100); // Check max 100 posts per run

    if (postsToCheck.length === 0) {
      logger.info('No posts to check for removal');
      return 0;
    }

    // Get Redis connection for queue
    const redis = getRedisConnection();
    const { Queue } = await import('bullmq');
    const removalQueue = new Queue('removal-detection', { connection: redis });

    // Queue each post for checking
    let queued = 0;
    for (const post of postsToCheck) {
      if (!post.redditPostId) continue;

      await removalQueue.add(
        'check-removal',
        {
          userId: post.userId,
          postId: post.id,
          redditPostId: post.redditPostId,
          subreddit: post.subreddit,
          postedAt: post.occurredAt,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      queued++;
    }

    logger.info('Queued removal checks', { count: queued });
    return queued;
  } catch (error) {
    logger.error('Failed to queue removal checks', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create and start the removal detection worker
 */
export function createRemovalDetectionWorker(): Worker {
  const redis = getRedisConnection();

  const worker = new Worker('removal-detection', checkPostRemoval, {
    connection: redis,
    concurrency: 5, // Check 5 posts concurrently
    limiter: {
      max: 60, // Max 60 requests
      duration: 60000, // Per minute (Reddit API limit)
    },
  });

  worker.on('completed', (job) => {
    logger.debug('Removal check completed', { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    logger.error('Removal check failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('Removal detection worker error', { error: error.message });
  });

  logger.info('Removal detection worker started');

  return worker;
}

/**
 * Schedule hourly removal checks
 */
export async function scheduleRemovalChecks(): Promise<void> {
  try {
    const redis = getRedisConnection();
    const { Queue } = await import('bullmq');
    const schedulerQueue = new Queue('removal-scheduler', { connection: redis });

    // Add repeatable job that runs every hour
    await schedulerQueue.add(
      'queue-removal-checks',
      {},
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
        removeOnComplete: true,
      }
    );

    logger.info('Scheduled hourly removal checks');
  } catch (error) {
    logger.error('Failed to schedule removal checks', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Create scheduler worker that queues removal checks
 */
export function createRemovalSchedulerWorker(): Worker {
  const redis = getRedisConnection();

  const worker = new Worker(
    'removal-scheduler',
    async () => {
      await queueRemovalChecks();
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on('completed', () => {
    logger.info('Removal checks queued successfully');
  });

  worker.on('failed', (job, error) => {
    logger.error('Failed to queue removal checks', {
      jobId: job?.id,
      error: error.message,
    });
  });

  logger.info('Removal scheduler worker started');

  return worker;
}
