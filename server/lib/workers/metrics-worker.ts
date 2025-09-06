import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type MetricsJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { postJobs, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { RedditManager } from "../reddit.js";
import { logger } from "../logger.js";

export class MetricsWorker {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    await registerProcessor<MetricsJobData>(
      QUEUE_NAMES.METRICS,
      this.processJob.bind(this),
      { concurrency: 3 } // Process 3 metrics jobs at once
    );
    
    this.initialized = true;
    logger.info('✅ Metrics worker initialized with queue abstraction');
  }

  private async processJob(jobData: unknown, jobId: string) {
    const { postJobId, redditPostId, scheduledFor } = jobData as MetricsJobData;

    try {
      logger.info(`Processing metrics job for post ${redditPostId}`);

      // Get post job details
      const [postJob] = await db
        .select()
        .from(postJobs)
        .where(eq(postJobs.id, postJobId));

      if (!postJob) {
        throw new Error(`Post job ${postJobId} not found`);
      }

      // Get Reddit manager for user
      const reddit = await RedditManager.forUser(postJob.userId);
      if (!reddit) {
        logger.warn(`No Reddit access for user ${postJob.userId}, skipping metrics`);
        return { success: false, reason: 'No Reddit access' };
      }

      // Fetch post metrics from Reddit
      const metrics = await this.fetchPostMetrics(reddit, redditPostId);
      
      if (metrics) {
        // Update post job with latest metrics
        await this.updatePostMetrics(postJobId, metrics);

        // Log metrics collection event
        await this.logEvent(postJob.userId, 'metrics.collected', {
          postJobId,
          redditPostId,
          metrics,
        });

        // Schedule next metrics check if post is still recent (< 7 days)
        const daysSincePost = Math.floor((Date.now() - scheduledFor.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSincePost < 7) {
          await this.scheduleNextCheck(postJobId, redditPostId, daysSincePost);
        }

        return { success: true, metrics };
      } else {
        logger.warn(`Could not fetch metrics for post ${redditPostId}`);
        return { success: false, reason: 'Failed to fetch metrics' };
      }

    } catch (error: unknown) {
      logger.error(`Metrics job for post ${redditPostId} failed:`, { error: error.message });

      // Log failure event
      if (postJobId) {
        const [postJob] = await db
          .select()
          .from(postJobs)
          .where(eq(postJobs.id, postJobId));

        if (postJob) {
          await this.logEvent(postJob.userId, 'metrics.failed', {
            postJobId,
            redditPostId,
            error: error.message,
          });
        }
      }

      throw error;
    }
  }

  private async fetchPostMetrics(reddit: unknown, redditPostId: string) {
    try {
      // Use Reddit API to get post details
      const post = await reddit.getSubmission(redditPostId);
      
      return {
        score: post.score || 0,
        upvoteRatio: post.upvote_ratio || 0,
        numComments: post.num_comments || 0,
        views: post.view_count || 0,
        collectedAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to fetch Reddit post metrics:', { error });
      return null;
    }
  }

  private async updatePostMetrics(postJobId: number, metrics: unknown) {
    try {
      // Update the post job with latest metrics
      const currentMetrics = {
        score: metrics.score,
        upvoteRatio: metrics.upvoteRatio,
        comments: metrics.numComments,
        views: metrics.views,
        lastCollected: metrics.collectedAt.toISOString(),
      };

      await db
        .update(postJobs)
        .set({
          resultJson: currentMetrics,
          updatedAt: new Date(),
        })
        .where(eq(postJobs.id, postJobId));

    } catch (error) {
      logger.error('Failed to update post metrics:', { error });
    }
  }

  private async scheduleNextCheck(postJobId: number, redditPostId: string, daysSincePost: number) {
    try {
      // Import the queue functions
      const { addJob } = await import("../queue/index.js");
      
      // Determine delay based on post age
      let delayMinutes = 60; // Default 1 hour
      
      if (daysSincePost === 0) {
        delayMinutes = 15; // Check every 15 minutes on first day
      } else if (daysSincePost <= 2) {
        delayMinutes = 60; // Check hourly for first 2 days
      } else {
        delayMinutes = 360; // Check every 6 hours after that
      }

      const nextCheck = new Date();
      nextCheck.setMinutes(nextCheck.getMinutes() + delayMinutes);

      await addJob(QUEUE_NAMES.METRICS, {
        postJobId,
        redditPostId,
        scheduledFor: nextCheck,
      } as MetricsJobData, {
        delay: delayMinutes * 60 * 1000, // Convert to milliseconds
      });

      logger.info(`Scheduled next metrics check for post ${redditPostId} in ${delayMinutes} minutes`);

    } catch (error) {
      logger.error('Failed to schedule next metrics check:', { error });
    }
  }

  private async logEvent(userId: number, type: string, meta: unknown) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      logger.error('Failed to log metrics event:', { error });
    }
  }

  async close() {
    this.initialized = false;
  }
}

// Export singleton instance
export const metricsWorker = new MetricsWorker();

// Initialize the metrics worker
export async function initializeMetricsWorker() {
  await metricsWorker.initialize();
}