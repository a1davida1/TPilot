/**
 * Centralized Cron Job Manager
 * Handles all scheduled tasks for the platform
 */
import * as cron from 'node-cron';
import { logger } from '../../bootstrap/logger.js';
import { db } from '../../db.js';
import { scheduledPosts } from '@shared/schema';
import { eq, lte, and, or } from 'drizzle-orm';
// import { addJob, QUEUE_NAMES } from '../../bootstrap/queue.js'; // Queue system not yet implemented
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

          /**
           * Queue-based post processing
           * 
           * @todo Enable queue system for scheduled posts
           * The queue infrastructure exists (Bull/PG-Boss) but is disabled for beta.
           * Uncomment when USE_PG_QUEUE=true and Redis/PostgreSQL queue is confirmed stable.
           * 
           * await addJob(QUEUE_NAMES.POST, {
           *   userId: post.userId,
           *   scheduleId: post.id,
           *   subreddit: post.subreddit,
           *   titleFinal: post.title,
           *   bodyFinal: post.content || '',
           *   mediaKey: post.imageUrl
           * });
           */  
          await addJob(QUEUE_NAMES.POST, {
            userId: post.userId,
            scheduleId: post.id,
            subreddit: post.subreddit,
            titleFinal: post.title,
            bodyFinal: post.content || '',
            mediaKey: post.imageUrl
          });
          
          // For now, just log that we would process this post

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
      
      /**
       * Queue-based community sync
       * 
       * @todo Enable queue system for community data sync
       * Disabled for beta - runs in-process via scripts/sync-reddit-communities.ts
       * Enable when queue infrastructure is production-ready.
       * 
       * await addJob(QUEUE_NAMES.COMMUNITY_SYNC, {
       *   timestamp: new Date()
       * });
       */
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
   * Get status of all cron jobs
   */
  getStatus() {
    const status: Record<string, any> = {};
    
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
