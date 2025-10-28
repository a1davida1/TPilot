import { and, eq, isNull, lt, lte, or } from 'drizzle-orm';

import { db } from '@server/db';
import { scheduleJobAttempts, scheduleJobs, scheduledPosts } from '@shared/schema';
import { addJob, QUEUE_NAMES } from '../lib/queue/index.js';
import { logger } from '../bootstrap/logger.js';

const POLL_INTERVAL_MS = Number.parseInt(process.env.SCHEDULER_POLL_INTERVAL_MS ?? '5000', 10);
const LOCK_TIMEOUT_MS = Number.parseInt(process.env.SCHEDULER_LOCK_TIMEOUT_MS ?? String(2 * 60 * 1000), 10);
const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.SCHEDULER_RATE_WINDOW_MS ?? String(60_000), 10);
const MAX_JOBS_PER_WINDOW = Number.parseInt(process.env.SCHEDULER_MAX_PER_MINUTE ?? '30', 10);
const MAX_BATCH_SIZE = Number.parseInt(process.env.SCHEDULER_MAX_BATCH ?? '5', 10);

function truncateMessage(message: string, length = 500): string {
  return message.length > length ? `${message.slice(0, length - 1)}…` : message;
}

export class SchedulerJobWorker {
  private timer: NodeJS.Timeout | null = null;

  private processing = false;

  private readonly workerId = `scheduler-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

  private readonly executionLog: number[] = [];

  start(): void {
    if (this.timer) {
      return;
    }
    logger.info('[scheduler] starting scheduling worker', { workerId: this.workerId });
    this.timer = setInterval(() => {
      void this.tick();
    }, POLL_INTERVAL_MS).unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('[scheduler] scheduling worker stopped', { workerId: this.workerId });
  }

  private canProcessNext(): boolean {
    const now = Date.now();
    while (this.executionLog.length > 0 && now - this.executionLog[0] > RATE_LIMIT_WINDOW_MS) {
      this.executionLog.shift();
    }
    return this.executionLog.length < MAX_JOBS_PER_WINDOW;
  }

  private recordExecution(): void {
    this.executionLog.push(Date.now());
  }

  private async tick(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      let processed = 0;
      while (processed < MAX_BATCH_SIZE && this.canProcessNext()) {
        const job = await this.claimNextJob();
        if (!job) {
          break;
        }
        await this.processJob(job);
        this.recordExecution();
        processed += 1;
      }
    } catch (error) {
      logger.error('[scheduler] tick failure', { error: error instanceof Error ? error.message : error });
    } finally {
      this.processing = false;
    }
  }

  private async claimNextJob(): Promise<typeof scheduleJobs.$inferSelect | null> {
    return db.transaction(async (trx) => {
      const now = new Date();
      const job = await trx.query.scheduleJobs.findFirst({
        where: (jobs, { and: whereAnd, or: whereOr, eq: whereEq, lte: whereLte, isNull: whereIsNull, lt: whereLt }) =>
          whereAnd(
            whereOr(whereEq(jobs.status, 'pending'), whereEq(jobs.status, 'queued')),
            whereLte(jobs.runAt, now),
            whereOr(whereIsNull(jobs.retryAt), whereLte(jobs.retryAt, now)),
            whereOr(whereIsNull(jobs.lockedAt), whereLt(jobs.lockedAt, new Date(now.getTime() - LOCK_TIMEOUT_MS))),
          ),
        orderBy: (jobs, { asc }) => [asc(jobs.priority), asc(jobs.runAt)],
      });

      if (!job) {
        return null;
      }

      const [updated] = await trx
        .update(scheduleJobs)
        .set({
          status: 'running',
          lockedAt: now,
          lockedBy: this.workerId,
          updatedAt: now,
        })
        .where(
          and(
            eq(scheduleJobs.id, job.id),
            or(eq(scheduleJobs.status, 'pending'), eq(scheduleJobs.status, 'queued')),
          ),
        )
        .returning();

      return updated ?? null;
    });
  }

  private async processJob(job: typeof scheduleJobs.$inferSelect): Promise<void> {
    const start = new Date();
    try {
      if (!job.scheduledPostId) {
        await this.markFailure(job, start, 'Scheduled post missing from job payload');
        return;
      }

      const scheduledPost = await db.query.scheduledPosts.findFirst({
        where: (posts, { eq: whereEq }) => whereEq(posts.id, job.scheduledPostId!),
      });

      if (!scheduledPost) {
        await this.markFailure(job, start, `Scheduled post ${job.scheduledPostId} not found`);
        return;
      }

      if (scheduledPost.status === 'cancelled') {
        await db
          .update(scheduleJobs)
          .set({
            status: 'cancelled',
            lockedAt: null,
            lockedBy: null,
            updatedAt: new Date(),
          })
          .where(eq(scheduleJobs.id, job.id));
        return;
      }

      await db
        .update(scheduledPosts)
        .set({
          status: 'processing',
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, scheduledPost.id));

      await addJob(QUEUE_NAMES.POST, {
        userId: scheduledPost.userId,
        postJobId: scheduledPost.id,
        scheduleId: scheduledPost.id,
        subreddit: scheduledPost.subreddit,
        titleFinal: scheduledPost.title,
        bodyFinal: scheduledPost.content ?? '',
        mediaKey: scheduledPost.imageUrl ?? undefined,
        nsfw: scheduledPost.nsfw ?? false,
        spoiler: scheduledPost.spoiler ?? false,
        flairId: scheduledPost.flairId ?? undefined,
        flairText: scheduledPost.flairText ?? undefined,
      });

      const now = new Date();
      await Promise.all([
        db.insert(scheduleJobAttempts).values({
          jobId: job.id,
          attemptNumber: job.attempts + 1,
          startedAt: start,
          finishedAt: now,
          result: { queued: true },
        }),
        db
          .update(scheduleJobs)
          .set({
            status: 'succeeded',
            attempts: job.attempts + 1,
            lastRunAt: now,
            lastError: null,
            retryAt: null,
            lockedAt: null,
            lockedBy: null,
            updatedAt: now,
          })
          .where(eq(scheduleJobs.id, job.id)),
      ]);
    } catch (error) {
      const message = error instanceof Error ? truncateMessage(error.message) : 'Unknown scheduler error';
      logger.error('[scheduler] job processing failed', {
        jobId: job.id,
        scheduledPostId: job.scheduledPostId,
        error: message,
      });
      await this.markFailure(job, start, message);
    }
  }

  private async markFailure(job: typeof scheduleJobs.$inferSelect, start: Date, errorMessage: string): Promise<void> {
    const now = new Date();
    const attemptNumber = job.attempts + 1;
    const hasRetriesRemaining = attemptNumber < job.maxAttempts;
    const retryAt = hasRetriesRemaining ? new Date(now.getTime() + job.retryBackoffSeconds * 1000) : null;
    const nextStatus = hasRetriesRemaining ? 'queued' : 'failed';

    await Promise.all([
      db.insert(scheduleJobAttempts).values({
        jobId: job.id,
        attemptNumber,
        startedAt: start,
        finishedAt: now,
        error: errorMessage,
      }),
      db
        .update(scheduleJobs)
        .set({
          status: nextStatus,
          attempts: attemptNumber,
          lastRunAt: now,
          lastError: errorMessage,
          retryAt,
          lockedAt: null,
          lockedBy: null,
          updatedAt: now,
        })
        .where(eq(scheduleJobs.id, job.id)),
    ]);

    if (!hasRetriesRemaining && job.scheduledPostId) {
      await db
        .update(scheduledPosts)
        .set({
          status: 'failed',
          errorMessage,
          updatedAt: now,
        })
        .where(eq(scheduledPosts.id, job.scheduledPostId));
    }
  }
}

export const schedulerJobWorker = new SchedulerJobWorker();

