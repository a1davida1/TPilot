import { z } from 'zod';
import { registerProcessor } from '../queue-factory.js';
import { addJob, QUEUE_NAMES, type CommunitySyncJobData } from '../queue/index.js';
import { logger } from '../logger.js';
import { syncRedditCommunities } from '../../scripts/sync-reddit-communities.js';

const communitySyncJobSchema = z.object({
  subreddits: z.array(z.string()).optional(),
  triggeredBy: z.string().optional(),
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class CommunitySyncWorker {
  private initialized = false;
  
  private canScheduleJobs(): boolean {
    return process.env.NODE_ENV !== 'test';
  }

  private hasRequiredCredentials(): boolean {
    // Check if all required Reddit service credentials are present
    const hasRefreshToken = Boolean(process.env.REDDIT_REFRESH_TOKEN);
    const hasUsernameAndPassword = Boolean(process.env.REDDIT_USERNAME && process.env.REDDIT_PASSWORD);
    const hasClientCredentials = Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
    
    return hasClientCredentials && (hasRefreshToken || hasUsernameAndPassword);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Skip initialization if Reddit service credentials are not configured
    if (!this.hasRequiredCredentials()) {
      logger.info('⏭️ Community sync worker skipped - Reddit service credentials not configured');
      return;
    }

    await registerProcessor<CommunitySyncJobData>(
      QUEUE_NAMES.COMMUNITY_SYNC,
      this.processJob.bind(this),
      { concurrency: 1 }
    );

    await this.enqueueInitialSync();

    this.initialized = true;
    logger.info('✅ Community sync worker initialized');
  }

  private async enqueueInitialSync(): Promise<void> {
    if (!this.canScheduleJobs()) {
      logger.info('Community sync worker scheduling skipped in test environment');
      return;
    }

    try {
      await addJob(
        QUEUE_NAMES.COMMUNITY_SYNC,
        { triggeredBy: 'startup' },
      );
    } catch (_error) {
      logger.warn('Community sync worker could not enqueue initial job', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async scheduleNextRun(): Promise<void> {
    if (!this.canScheduleJobs()) {
      return;
    }

    try {
      await addJob(
        QUEUE_NAMES.COMMUNITY_SYNC,
        { triggeredBy: 'schedule' },
        { delay: DAY_IN_MS }
      );
    } catch (_error) {
      logger.warn('Community sync worker could not schedule next run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processJob(jobData: unknown, jobId: string): Promise<void> {
    const payload = communitySyncJobSchema.parse(jobData ?? {});

    try {
      const result = await syncRedditCommunities({
        subreddits: payload.subreddits,
        runId: jobId,
      });

      logger.info('Community sync job completed', {
        jobId,
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
      });
    } catch (_error) {
      logger.error('Community sync job failed', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      await this.scheduleNextRun();
    }
  }

  async close(): Promise<void> {
    this.initialized = false;
  }
}

export const communitySyncWorker = new CommunitySyncWorker();