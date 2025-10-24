/**
 * Worker for processing scheduled Reddit posts
 * Handles retries, failures, and status updates
 */

import { Worker, Job } from 'bullmq';
import { logger } from '../../bootstrap/logger.js';
import { db } from '../../db.js';
import { scheduledPosts, redditPostOutcomes } from '@shared/schema';
import { eq, and, lte } from 'drizzle-orm';
import { RedditManager } from '../reddit.js';
import { RedditNativeUploadService } from '../../services/reddit-native-upload.js';
import Redis from 'ioredis';

interface ScheduledPostJob {
  postId: number;
  userId: number;
  subreddit: string;
  title: string;
  content: string;
  imageUrl?: string;
  flairText?: string;
  nsfw: boolean;
  attempt?: number;
}

let redis: Redis | null = null;

// Only create Redis connection if available and not using PG queue
if (process.env.REDIS_URL && process.env.USE_PG_QUEUE !== 'true') {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null
    });
    redis.on('error', () => {
      // Silently handle errors
    });
  } catch {
    redis = null;
  }
}

export function createPostSchedulerWorker() {
  // Only create worker if Redis is available (BullMQ requires Redis)
  if (!redis) {
    logger.warn('Post scheduler worker not created - Redis unavailable');
    return null;
  }
  
  const worker = new Worker<ScheduledPostJob>(
    'scheduled-posts',
    async (job: Job<ScheduledPostJob>) => {
      const [post] = await db.select().from(scheduledPosts).where(eq(scheduledPosts.id, job.data.postId));
      if (!post) {
        throw new Error('Scheduled post not found');
      }

      const { id: postId, userId } = post;
      const { subreddit } = post;
      // These will be used when Reddit API is implemented
      // const { title, content, imageUrl, flairText, nsfw } = post;
      const attempt = job.data.attempt || 1;

      logger.info('Processing scheduled post', {
        postId,
        userId,
        subreddit,
        attempt,
        jobId: job.id
      });

      try {
        // Update status to processing
        await db.update(scheduledPosts)
          .set({ 
            status: 'processing',
            updatedAt: new Date()
          })
          .where(eq(scheduledPosts.id, postId));

        // Get RedditManager instance for this user
        const redditManager = await RedditManager.forUser(userId);
        
        if (!redditManager) {
          throw new Error('Reddit OAuth not configured for user. Please reconnect Reddit account.');
        }

        // Submit post to Reddit
        let result;
        
        if (post.imageUrl) {
          // Image post
          result = await RedditNativeUploadService.uploadAndPost({
            userId,
            subreddit,
            title: post.title,
            imageUrl: post.imageUrl,
            nsfw: post.nsfw ?? false,
            spoiler: post.spoiler ?? false,
          });
        } else {
          // Link or text post
          result = await redditManager.submitPost({
            subreddit,
            title: post.title,
            body: post.content ?? undefined,
            url: undefined, // Could add link support later
            nsfw: post.nsfw ?? false,
            spoiler: post.spoiler ?? false
          });
        }

        if (result.success && result.postId) {
          // Update as completed
          await db.update(scheduledPosts)
            .set({
              status: 'completed',
              redditPostId: result.postId,
              redditPostUrl: result.url,
              executedAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(scheduledPosts.id, postId));

          // Record outcome
          await db.insert(redditPostOutcomes).values({
            userId,
            subreddit,
            status: 'completed',
            reason: null,
            occurredAt: new Date()
          });

          logger.info('Scheduled post completed successfully', {
            postId,
            redditPostId: result.postId,
            url: result.url
          });

          return { success: true, postId: result.postId, url: result.url };
        } else {
          throw new Error(result.error || 'Failed to submit to Reddit');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to process scheduled post', {
          postId,
          error: errorMessage,
          attempt
        });

        // Check if we should retry
        if (attempt < 3) {
          // Schedule retry with exponential backoff
          // const delay = Math.pow(2, attempt) * 60000; // 2min, 4min, 8min - BullMQ handles retry delays
          
          await job.updateData({
            ...job.data,
            attempt: attempt + 1
          });

          throw new Error(`Retry attempt ${attempt} failed: ${errorMessage}`);
        } else {
          // Final failure - update status
          await db.update(scheduledPosts)
            .set({
              status: 'failed',
              errorMessage: errorMessage,
              updatedAt: new Date()
            })
            .where(eq(scheduledPosts.id, postId));

          // Record failed outcome
          await db.insert(redditPostOutcomes).values({
            userId,
            subreddit,
            status: 'failed',
            reason: errorMessage,
            occurredAt: new Date()
          });

          throw error;
        }
      }
    },
    {
      connection: redis,
      concurrency: 5,
      // Default job options are set at queue level, not worker level in BullMQ
    }
  );

  worker.on('completed', (job) => {
    logger.info('Scheduled post job completed', {
      jobId: job.id,
      postId: job.data.postId
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Scheduled post job failed', {
      jobId: job?.id,
      postId: job?.data.postId,
      error: error.message
    });
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Scheduled post job stalled', { jobId });
  });

  return worker;
}

// Recovery function for stuck jobs
export async function recoverStuckJobs() {
  try {
    // Find posts that have been processing for more than 10 minutes
    const tenMinutesAgo = new Date();
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

    const stuckPosts = await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, 'processing'),
          lte(scheduledPosts.updatedAt, tenMinutesAgo)
        )
      );

    for (const post of stuckPosts) {
      logger.warn('Recovering stuck scheduled post', {
        postId: post.id,
        scheduledFor: post.scheduledFor
      });

      // Reset to pending so it gets picked up again
      await db.update(scheduledPosts)
        .set({
          status: 'pending',
          updatedAt: new Date()
        })
        .where(eq(scheduledPosts.id, post.id));
    }

    if (stuckPosts.length > 0) {
      logger.info(`Recovered ${stuckPosts.length} stuck scheduled posts`);
    }
  } catch (error) {
    logger.error('Failed to recover stuck jobs', { error });
  }
}
