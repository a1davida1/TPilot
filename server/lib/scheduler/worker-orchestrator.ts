/**
 * Worker Orchestration Module
 * Handles retries, cancellation, and advanced job management
 */

import { db } from '../../db.js';
import { scheduledPosts, redditPostOutcomes } from '@shared/schema';
import { eq, and, lte, gte, or, sql } from 'drizzle-orm';
import { logger } from '../../bootstrap/logger.js';
import { addJob, QUEUE_NAMES } from '../queue/index.js';

interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

interface JobMetadata {
  postId: number;
  userId: number;
  attempt: number;
  lastError?: string;
  nextRetryAt?: Date;
}

export class WorkerOrchestrator {
  private static instance: WorkerOrchestrator;
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    backoffMultiplier: 2,
    initialDelayMs: 5000,
    maxDelayMs: 60000
  };

  private constructor() {}

  public static getInstance(): WorkerOrchestrator {
    if (!WorkerOrchestrator.instance) {
      WorkerOrchestrator.instance = new WorkerOrchestrator();
    }
    return WorkerOrchestrator.instance;
  }

  /**
   * Process a scheduled post with retry logic
   */
  async processScheduledPost(postId: number, attempt: number = 1): Promise<void> {
    try {
      const post = await db
        .select()
        .from(scheduledPosts)
        .where(eq(scheduledPosts.id, postId))
        .limit(1);

      if (!post[0]) {
        logger.error(`Post ${postId} not found`);
        return;
      }

      const currentPost = post[0];

      // Check if cancelled
      if (currentPost.status === 'cancelled') {
        logger.info(`Post ${postId} is cancelled, skipping`);
        return;
      }

      // Update status to processing
      await db
        .update(scheduledPosts)
        .set({
          status: 'processing',
          updatedAt: new Date()
        })
        .where(eq(scheduledPosts.id, postId));

      try {
        // Queue the actual post job
        const jobResult = await addJob(QUEUE_NAMES.POST, {
          userId: currentPost.userId,
          scheduleId: currentPost.id,
          subreddit: currentPost.subreddit,
          titleFinal: currentPost.title,
          bodyFinal: currentPost.content || '',
          mediaKey: currentPost.imageUrl,
          nsfw: currentPost.nsfw || false
        });

        // If job queued successfully, wait for completion
        await this.waitForJobCompletion(postId, jobResult);
        
      } catch (error) {
        // Handle posting error with retry logic
        await this.handlePostError(postId, error, attempt);
      }

    } catch (error) {
      logger.error(`Failed to process scheduled post ${postId}`, {
        error: error instanceof Error ? error.message : error,
        attempt
      });
    }
  }

  /**
   * Handle post error with exponential backoff retry
   */
  private async handlePostError(postId: number, error: any, attempt: number): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (attempt >= this.retryConfig.maxRetries) {
      // Max retries reached, mark as failed
      await db
        .update(scheduledPosts)
        .set({
          status: 'failed',
          errorMessage,
          updatedAt: new Date()
        })
        .where(eq(scheduledPosts.id, postId));

      logger.error(`Post ${postId} failed after ${attempt} attempts: ${errorMessage}`);
      
      // Create failure outcome record
      await db.insert(redditPostOutcomes).values({
        userId: (await this.getPost(postId))?.userId || 0,
        subreddit: (await this.getPost(postId))?.subreddit || 'unknown',
        status: 'failed',
        reason: errorMessage,
        occurredAt: new Date()
      });
      
      return;
    }

    // Calculate next retry time with exponential backoff
    const delay = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelayMs
    );
    const nextRetryAt = new Date(Date.now() + delay);

    // Update post with retry information
    await db
      .update(scheduledPosts)
      .set({
        status: 'pending',
        errorMessage,
        updatedAt: new Date()
      })
      .where(eq(scheduledPosts.id, postId));

    logger.warn(`Post ${postId} will retry (attempt ${attempt + 1}/${this.retryConfig.maxRetries}) at ${nextRetryAt.toISOString()}`);

    // Schedule retry
    setTimeout(() => {
      this.processScheduledPost(postId, attempt + 1);
    }, delay);
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(postId: number, userId: number, reason?: string): Promise<boolean> {
    try {
      const post = await this.getPost(postId);
      
      if (!post) {
        logger.error(`Post ${postId} not found for cancellation`);
        return false;
      }

      // Verify ownership
      if (post.userId !== userId) {
        logger.error(`User ${userId} cannot cancel post ${postId} (owned by ${post.userId})`);
        return false;
      }

      // Check if post can be cancelled
      if (post.status && ['completed', 'failed', 'cancelled'].includes(post.status)) {
        logger.warn(`Post ${postId} cannot be cancelled (status: ${post.status})`);
        return false;
      }

      // Cancel the post
      await db
        .update(scheduledPosts)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          errorMessage: reason || 'User requested cancellation',
          updatedAt: new Date()
        })
        .where(eq(scheduledPosts.id, postId));

      logger.info(`Post ${postId} cancelled by user ${userId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to cancel post ${postId}`, {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Bulk cancel scheduled posts
   */
  async bulkCancelPosts(postIds: number[], userId: number, reason?: string): Promise<number> {
    let cancelledCount = 0;

    for (const postId of postIds) {
      const success = await this.cancelScheduledPost(postId, userId, reason);
      if (success) cancelledCount++;
    }

    return cancelledCount;
  }

  /**
   * Get retry status for a post
   */
  async getRetryStatus(postId: number): Promise<any> {
    const post = await this.getPost(postId);
    
    if (!post) {
      return null;
    }

    return {
      postId,
      status: post.status,
      attempt: 1, // We don't track attempts in schema yet
      maxRetries: this.retryConfig.maxRetries,
      lastError: post.errorMessage,
      nextRetryAt: null, // Would need to add this to schema
      canRetry: post.status === 'failed'
    };
  }

  /**
   * Force retry a failed post
   */
  async forceRetry(postId: number, userId: number): Promise<boolean> {
    try {
      const post = await this.getPost(postId);
      
      if (!post) {
        logger.error(`Post ${postId} not found for retry`);
        return false;
      }

      // Verify ownership
      if (post.userId !== userId) {
        logger.error(`User ${userId} cannot retry post ${postId} (owned by ${post.userId})`);
        return false;
      }

      // Only retry failed posts
      if (post.status !== 'failed') {
        logger.warn(`Post ${postId} cannot be retried (status: ${post.status})`);
        return false;
      }

      // Reset post for retry
      await db
        .update(scheduledPosts)
        .set({
          status: 'pending',
          errorMessage: null,
          updatedAt: new Date()
        })
        .where(eq(scheduledPosts.id, postId));

      // Process immediately
      await this.processScheduledPost(postId, 1);

      logger.info(`Post ${postId} force retried by user ${userId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to force retry post ${postId}`, {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config
    };
    logger.info('Retry configuration updated', this.retryConfig);
  }

  /**
   * Get post by ID
   */
  private async getPost(postId: number) {
    const posts = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, postId))
      .limit(1);
    
    return posts[0] || null;
  }

  /**
   * Wait for job completion with timeout
   */
  private async waitForJobCompletion(postId: number, jobId: any, timeoutMs: number = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(async () => {
        try {
          const post = await this.getPost(postId);
          
          if (!post) {
            clearInterval(checkInterval);
            reject(new Error('Post not found'));
            return;
          }

          // Check if completed or failed
          if (post.status === 'completed') {
            clearInterval(checkInterval);
            resolve();
            return;
          }

          if (post.status === 'failed') {
            clearInterval(checkInterval);
            reject(new Error(post.errorMessage || 'Job failed'));
            return;
          }

          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            clearInterval(checkInterval);
            reject(new Error('Job timeout'));
            return;
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 2000); // Check every 2 seconds
    });
  }

  /**
   * Get worker statistics
   */
  async getWorkerStats(): Promise<any> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        pending: sql<number>`count(case when status = 'pending' then 1 end)`,
        processing: sql<number>`count(case when status = 'processing' then 1 end)`,
        completed: sql<number>`count(case when status = 'completed' then 1 end)`,
        failed: sql<number>`count(case when status = 'failed' then 1 end)`,
        cancelled: sql<number>`count(case when status = 'cancelled' then 1 end)`,
        recentCompleted: sql<number>`count(case when status = 'completed' and updated_at >= ${oneDayAgo} then 1 end)`,
        recentFailed: sql<number>`count(case when status = 'failed' and updated_at >= ${oneDayAgo} then 1 end)`
      })
      .from(scheduledPosts);

    return {
      ...stats[0],
      retryConfig: this.retryConfig,
      successRate: stats[0]?.total > 0 
        ? ((stats[0]?.completed || 0) / (stats[0]?.total || 1) * 100).toFixed(2) + '%'
        : 'N/A'
    };
  }
}

// Export singleton instance
export const workerOrchestrator = WorkerOrchestrator.getInstance();
