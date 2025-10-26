/**
 * Centralized Cron Job Manager
 * Handles all scheduled tasks for the platform
 */
import * as cron from 'node-cron';
import { logger } from '../../bootstrap/logger.js';
import { db } from '../../db.js';
import { scheduledPosts } from '@shared/schema';
import { eq, lte, and, or } from 'drizzle-orm';
import { addJob, QUEUE_NAMES } from '../queue/index.js';
// import { syncRedditCommunityRules } from '../reddit-community-sync.js'; // File doesn't exist yet

interface CronJob {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  instance?: cron.ScheduledTask;
}
class CronManager {
  private jobs: Map<string, CronJob> = new Map();
  private isRunning = false;

  constructor() {
    this.registerJobs();
  }

  private registerJobs() {
    // Process scheduled posts every minute
    this.addJob({
      name: 'process-scheduled-posts',
      schedule: '* * * * *', // Every minute
      task: async () => {
        await this.processScheduledPosts();
      }
    });

    // Clean up old completed posts daily at 3 AM
    this.addJob({
      name: 'cleanup-old-posts',
      schedule: '0 3 * * *', // Daily at 3 AM
      task: async () => {
        await this.cleanupOldPosts();
      }
    });

    // Update analytics metrics every hour
    this.addJob({
      name: 'update-analytics',
      schedule: '0 * * * *', // Every hour
      task: async () => {
        await this.updateAnalyticsMetrics();
      }
    });

    // Check for stuck/failed jobs every 5 minutes
    this.addJob({
      name: 'check-stuck-jobs',
      schedule: '*/5 * * * *', // Every 5 minutes
      task: async () => {
        await this.checkStuckJobs();
      }
    });

    // Sync Reddit community data weekly
    this.addJob({
      name: 'sync-reddit-communities',
      schedule: '0 2 * * 1', // Weekly on Monday at 2 AM
      task: async () => {
        await this.syncRedditCommunities();
      }
    });

    // Database backup daily at 4 AM
    this.addJob({
      name: 'database-backup',
      schedule: '0 4 * * *', // Daily at 4 AM
      task: async () => {
        await this.performDatabaseBackup();
      }
    });

    // Poll caption metrics every hour
    this.addJob({
      name: 'poll-caption-metrics',
      schedule: '15 * * * *', // Every hour at :15 past
      task: async () => {
        await this.pollCaptionMetrics();
      }
    });

    // Update optimal posting times cache weekly
    this.addJob({
      name: 'update-optimal-times',
      schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
      task: async () => {
        await this.updateOptimalTimesCache();
      }
    });

    // Run health checks daily
    this.addJob({
      name: 'daily-health-checks',
      schedule: '0 2 * * *', // Daily at 2 AM
      task: async () => {
        await this.runDailyHealthChecks();
      }
    });
  }

  private addJob(job: CronJob) {
    this.jobs.set(job.name, job);
  }

  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ Cron manager already running');
      return;
    }

    logger.info('🚀 Starting cron job manager...');

    for (const [name, job] of this.jobs) {
      try {
        job.instance = cron.schedule(job.schedule, async () => {
          try {
            logger.debug(`⏰ Running cron job: ${name}`);
            await job.task();
          } catch (error) {
            logger.error(`❌ Cron job failed: ${name}`, {
              error: error instanceof Error ? error.message : error
            });
          }
        });

        // Stop immediately after creation, then start manually
        job.instance.stop();
        job.instance.start();
        logger.info(`✅ Started cron job: ${name} (${job.schedule})`);
      } catch (error) {
        logger.error(`❌ Failed to start cron job: ${name}`, {
          error: error instanceof Error ? error.message : error
        });
      }
    }

    this.isRunning = true;
    logger.info('✅ Cron job manager started successfully');
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('🛑 Stopping cron job manager...');

    for (const [name, job] of this.jobs) {
      if (job.instance) {
        job.instance.stop();
        logger.info(`⏹️ Stopped cron job: ${name}`);
      }
    }

    this.isRunning = false;
    logger.info('✅ Cron job manager stopped');
  }

  /**
   * Process scheduled posts that are due
   */
  private async processScheduledPosts() {
    try {
      const now = new Date();
      
      // Find all scheduled posts that are due
      const duePosts = await db
        .select()
        .from(scheduledPosts)
        .where(
          and(
            lte(scheduledPosts.scheduledFor, now),
            eq(scheduledPosts.status, 'pending')
          )
        )
        .limit(10); // Process max 10 at a time

      if (duePosts.length === 0) {
        return;
      }

      logger.info(`📅 Processing ${duePosts.length} scheduled posts`);

      for (const post of duePosts) {
        try {
          // Update status to processing
          await db
            .update(scheduledPosts)
            .set({ 
              status: 'processing',
              updatedAt: now 
            })
            .where(eq(scheduledPosts.id, post.id));

          // Queue the post for processing via Bull/PG-Boss
          await addJob(QUEUE_NAMES.POST, {
            userId: post.userId,
            postJobId: post.id, // Match field name expected by post-worker
            scheduleId: post.id, // Keep for reference
            subreddit: post.subreddit,
            titleFinal: post.title,
            bodyFinal: post.content || '',
            mediaKey: post.imageUrl,
            nsfw: post.nsfw ?? false,
            spoiler: post.spoiler ?? false,
            flairId: post.flairId || undefined,
            flairText: post.flairText || undefined
          });

          logger.info(`✅ Queued scheduled post ${post.id} for user ${post.userId}`);
        } catch (error) {
          logger.error(`❌ Failed to queue scheduled post ${post.id}`, {
            error: error instanceof Error ? error.message : error
          });

          // Mark as failed
          await db
            .update(scheduledPosts)
            .set({ 
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              updatedAt: now 
            })
            .where(eq(scheduledPosts.id, post.id));
        }
      }
    } catch (error) {
      logger.error('❌ Failed to process scheduled posts', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Clean up old completed/failed posts (older than 30 days)
   */
  private async cleanupOldPosts() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const _result = await db
        .delete(scheduledPosts)
        .where(
          and(
            lte(scheduledPosts.createdAt, thirtyDaysAgo),
            or(
              eq(scheduledPosts.status, 'completed'),
              eq(scheduledPosts.status, 'failed'),
              eq(scheduledPosts.status, 'cancelled')
            )
          )
        );

      logger.info(`🧹 Cleaned up old scheduled posts`);
    } catch (error) {
      logger.error('❌ Failed to cleanup old posts', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Update analytics metrics
   */
  private async updateAnalyticsMetrics() {
    try {
      // This would aggregate data for the analytics dashboard
      // For now, just log that it ran
      logger.info('📊 Updating analytics metrics');
      
      // You can add actual metric calculations here
      // e.g., calculate daily/weekly/monthly aggregates
    } catch (error) {
      logger.error('❌ Failed to update analytics', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Check for stuck jobs and retry or mark as failed
   */
  private async checkStuckJobs() {
    try {
      const tenMinutesAgo = new Date();
      tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

      // Find posts stuck in processing for more than 10 minutes
      const stuckPosts = await db
        .select()
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.status, 'processing'),
            lte(scheduledPosts.updatedAt, tenMinutesAgo)
          )
        );

      if (stuckPosts.length > 0) {
        logger.warn(`⚠️ Found ${stuckPosts.length} stuck scheduled posts`);

        for (const post of stuckPosts) {
          // Reset to pending to retry
          await db
            .update(scheduledPosts)
            .set({ 
              status: 'pending',
              updatedAt: new Date()
            })
            .where(eq(scheduledPosts.id, post.id));
        }
      }
    } catch (error) {
      logger.error('❌ Failed to check stuck jobs', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Sync Reddit community data
   */
  private async syncRedditCommunities() {
    try {
      logger.info('🔄 Syncing Reddit community data');
      
      // Queue community sync job
      await addJob(QUEUE_NAMES.COMMUNITY_SYNC, {
        triggeredBy: 'cron',
        timestamp: new Date()
      });
      
      logger.info('✅ Queued community sync job');
    } catch (error) {
      logger.error('❌ Failed to sync Reddit communities', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Perform database backup
   */
  private async performDatabaseBackup() {
    try {
      logger.info('💾 Starting database backup');
      
      // Run backup using child process
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run db:backup');
      
      logger.info('✅ Database backup completed');
    } catch (error) {
      logger.error('❌ Failed to perform database backup', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Poll caption metrics from Reddit
   */
  private async pollCaptionMetrics() {
    try {
      const { pollCaptionMetrics } = await import('./caption-metrics-poller.js');
      await pollCaptionMetrics();
    } catch (error) {
      logger.error('❌ Failed to poll caption metrics', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Update optimal posting times cache
   */
  private async updateOptimalTimesCache() {
    try {
      logger.info('⏰ Updating optimal posting times cache');
      
      const { updateOptimalTimesCache } = await import('./time-optimizer.js');
      const { pool } = await import('../../db.js');
      
      // Get list of active subreddits from recent posts
      const result = await pool.query(`
        SELECT DISTINCT subreddit
        FROM reddit_posts
        WHERE created_at >= NOW() - INTERVAL '30 days'
        AND subreddit IS NOT NULL
        GROUP BY subreddit
        HAVING COUNT(*) >= 5
        ORDER BY COUNT(*) DESC
        LIMIT 100
      `);

      const subreddits = result.rows.map((row: { subreddit: string }) => row.subreddit);
      
      logger.info(`📊 Updating optimal times for ${subreddits.length} subreddits`);
      
      for (const subreddit of subreddits) {
        try {
          await updateOptimalTimesCache(subreddit);
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to update times for r/${subreddit}`, {
            error: error instanceof Error ? error.message : error
          });
        }
      }
      
      logger.info('✅ Optimal times cache updated successfully');
    } catch (error) {
      logger.error('❌ Failed to update optimal times cache', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Run daily health checks for all active users
   */
  private async runDailyHealthChecks() {
    try {
      logger.info('🏥 Starting daily health checks');
      
      const { pool } = await import('../../db.js');
      const { runAccountHealthCheck } = await import('../health/health-monitor.js');
      
      // Get users who posted in last 30 days
      const result = await pool.query(`
        SELECT DISTINCT user_id
        FROM reddit_posts
        WHERE created_at >= NOW() - INTERVAL '30 days'
        ORDER BY user_id
      `);
      
      const userIds = result.rows.map((r: { user_id: number }) => r.user_id);
      
      logger.info(`📊 Running health checks for ${userIds.length} active users`);
      
      for (const userId of userIds) {
        try {
          await runAccountHealthCheck(userId);
          // Small delay to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Failed health check for user ${userId}`, {
            error: error instanceof Error ? error.message : error
          });
        }
      }
      
      logger.info('✅ Daily health checks completed');
    } catch (error) {
      logger.error('❌ Failed to run daily health checks', {
        error: error instanceof Error ? error.message : error
      });
    }
  }

  /**
   * Get status of all cron jobs
   */
  getStatus() {
    const status: Record<string, { schedule: string; running: boolean }> = {};
    
    for (const [name, job] of this.jobs) {
      status[name] = {
        schedule: job.schedule,
        running: job.instance ? true : false
      };
    }

    return {
      isRunning: this.isRunning,
      jobs: status
    };
  }
}

// Export singleton instance
export const cronManager = new CronManager();
