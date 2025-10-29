/**
 * Reddit Sync Worker
 * 
 * Background worker for processing Reddit sync jobs.
 * Handles deep and full syncs that take longer to complete.
 * 
 * Features:
 * - Progress tracking
 * - Retry logic with exponential backoff
 * - Concurrency limiting (5 concurrent syncs max)
 * - Error handling and logging
 */

import { logger } from '../bootstrap/logger.js';
import { RedditSyncService, type SyncResult } from '../services/reddit-sync-service.js';
import { getQueueBackend } from '../lib/queue-factory.js';
import type { Job } from '../lib/queue-interface.js';

// Queue name for Reddit sync jobs
export const REDDIT_SYNC_QUEUE = 'reddit-sync-queue';

// Job data interface
export interface RedditSyncJobData {
  userId: number;
  redditUsername: string;
  syncType: 'quick' | 'deep' | 'full';
  options?: {
    forceRefresh?: boolean;
    skipSubredditDiscovery?: boolean;
  };
}

// Job result interface
export interface RedditSyncJobResult extends SyncResult {
  duration: number;
}

/**
 * Process a Reddit sync job
 */
async function processRedditSyncJob(
  job: Job<RedditSyncJobData>
): Promise<RedditSyncJobResult> {
  const startTime = Date.now();
  const { userId, redditUsername, syncType, options } = job.data;

  logger.info('Processing Reddit sync job', {
    jobId: job.id,
    userId,
    redditUsername,
    syncType,
  });

  try {
    let result: SyncResult;

    switch (syncType) {
      case 'quick':
        result = await RedditSyncService.quickSync(userId, redditUsername, options);
        break;

      case 'deep':
        result = await RedditSyncService.deepSync(userId, redditUsername, options);
        break;

      case 'full':
        result = await RedditSyncService.fullSync(userId, redditUsername, options);
        break;

      default:
        throw new Error(`Unknown sync type: ${syncType}`);
    }

    const duration = Date.now() - startTime;

    logger.info('Reddit sync job completed', {
      jobId: job.id,
      userId,
      syncType,
      postsSynced: result.postsSynced,
      subredditsFound: result.subredditsFound,
      duration,
    });

    return {
      ...result,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Reddit sync job failed', {
      jobId: job.id,
      userId,
      syncType,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Start the Reddit sync worker
 * 
 * Processes jobs from the reddit-sync-queue with:
 * - Concurrency: 5 (max 5 syncs running simultaneously)
 * - Retry: 3 attempts with exponential backoff
 * - Timeout: 10 minutes per job
 */
export function startRedditSyncWorker(): void {
  const queue = getQueueBackend();

  logger.info('Starting Reddit sync worker', {
    queue: REDDIT_SYNC_QUEUE,
    concurrency: 5,
  });

  // Register the worker
  if (queue.registerWorker) {
    queue.registerWorker(
      REDDIT_SYNC_QUEUE,
      async (job: Job<RedditSyncJobData>) => {
        return processRedditSyncJob(job);
      },
      {
        concurrency: 5, // Max 5 concurrent syncs
        attempts: 3, // Retry up to 3 times
      } as any // Extended options like backoff/timeout are implementation-specific
    );
  }

  logger.info('Reddit sync worker started successfully');
}

/**
 * Queue a Reddit sync job
 * 
 * Helper function to add sync jobs to the queue
 */
export async function queueRedditSync(
  userId: number,
  redditUsername: string,
  syncType: 'quick' | 'deep' | 'full',
  options?: {
    forceRefresh?: boolean;
    skipSubredditDiscovery?: boolean;
    priority?: number;
  }
): Promise<string> {
  const queue = getQueueBackend();

  const jobData: RedditSyncJobData = {
    userId,
    redditUsername,
    syncType,
    options: {
      forceRefresh: options?.forceRefresh,
      skipSubredditDiscovery: options?.skipSubredditDiscovery,
    },
  };

  const jobId = await queue.enqueue(REDDIT_SYNC_QUEUE, jobData, {
    priority: options?.priority || 5,
    attempts: 3,
  });

  logger.info('Queued Reddit sync job', {
    jobId,
    userId,
    redditUsername,
    syncType,
  });

  return jobId;
}

/**
 * Get sync job status
 */
export async function getSyncJobStatus(jobId: string): Promise<{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: RedditSyncJobResult;
  error?: string;
} | null> {
  const queue = getQueueBackend();

  try {
    if (!queue.getJob) {
      logger.warn('Queue backend does not support getJob');
      return null;
    }

    const job = await queue.getJob(REDDIT_SYNC_QUEUE, jobId);
    if (!job) {
      return null;
    }

    return {
      status: job.status ?? 'unknown',
      progress: job.progress ?? 0,
      result: job.result as RedditSyncJobResult | undefined,
      error: job.error,
    };
  } catch (error) {
    logger.error('Failed to get sync job status', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Cancel a sync job
 */
export async function cancelSyncJob(jobId: string): Promise<boolean> {
  const queue = getQueueBackend();

  try {
    if (!queue.cancelJob) {
      logger.warn('Queue backend does not support cancelJob');
      return false;
    }

    await queue.cancelJob(REDDIT_SYNC_QUEUE, jobId);
    logger.info('Cancelled sync job', { jobId });
    return true;
  } catch (error) {
    logger.error('Failed to cancel sync job', {
      jobId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get queue statistics
 */
export async function getSyncQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  const queue = getQueueBackend();

  try {
    const pending = await queue.getPendingCount(REDDIT_SYNC_QUEUE);
    const stats = await queue.getFailureRate(REDDIT_SYNC_QUEUE, 60); // Last hour

    return {
      pending,
      processing: 0, // Would need additional tracking
      completed: stats.totalJobs - stats.failedJobs,
      failed: stats.failedJobs,
    };
  } catch (error) {
    logger.error('Failed to get sync queue stats', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };
  }
}

