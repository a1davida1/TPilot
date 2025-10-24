/**
 * Phase 5: PostgreSQL Queue Implementation
 * Fallback queue implementation using PostgreSQL when Redis is not available
 */

import { db } from '../db';
import { queueJobs } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import type { IQueue, QueueJobHandler, QueueJobOptions, QueueFailureStats, QueueProcessOptions } from './queue-interface';
import { logger } from '../bootstrap/logger.js';

interface ProcessorConfig {
  handler: QueueJobHandler<unknown>;
  concurrency: number;
  active: boolean;
}

export class PgQueue implements IQueue {
  private processors = new Map<string, ProcessorConfig>();
  private polling = false;
  private pollInterval = 2000; // 2 seconds
  private pollTimer?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    logger.error('🔧 Initializing PostgreSQL Queue backend');
    this.startPolling();
  }

  async close(): Promise<void> {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    logger.error('📦 PostgreSQL Queue backend closed');
  }

  async enqueue<T = unknown>(
    queueName: string,
    payload: T,
    options: QueueJobOptions = {}
  ): Promise<string> {
    const delayUntil = options.delay ? new Date(Date.now() + options.delay) : null;
    
    const [job] = await db.insert(queueJobs).values({
      queueName,
      payload: payload as unknown,
      maxAttempts: options.attempts || 3,
      delayUntil,
      status: delayUntil ? 'delayed' : 'pending',
    }).returning();

    return job.id.toString();
  }

  async process<T = unknown>(
    queueName: string,
    handler: QueueJobHandler<T>,
    options: QueueProcessOptions<T> = {}
  ): Promise<void> {
    const { concurrency = 1, validatePayload } = options;
    const wrappedHandler: QueueJobHandler<unknown> = async (payload, jobId) => {
      if (validatePayload && !validatePayload(payload)) {
        throw new Error(`Invalid payload received for queue ${queueName}`);
      }

      await handler(payload as T, jobId);
    };

    this.processors.set(queueName, {
      handler: wrappedHandler,
      concurrency,
      active: true,
    });
  }

  async pause(queueName: string): Promise<void> {
    const processor = this.processors.get(queueName);
    if (processor) {
      processor.active = false;
    }
  }

  async resume(queueName: string): Promise<void> {
    const processor = this.processors.get(queueName);
    if (processor) {
      processor.active = true;
    }
  }

  async getFailureRate(queueName: string, windowMinutes: number): Promise<QueueFailureStats> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const [stats] = await db
      .select({
        total: sql<number>`count(*)`.as('total'),
        failed: sql<number>`count(*) filter (where status = 'failed')`.as('failed'),
      })
      .from(queueJobs)
      .where(
        and(
          eq(queueJobs.queueName, queueName),
          gte(queueJobs.createdAt, since)
        )
      );

    const totalJobs = Number(stats?.total || 0);
    const failedJobs = Number(stats?.failed || 0);
    const failureRate = totalJobs > 0 ? failedJobs / totalJobs : 0;

    return {
      failureRate,
      totalJobs,
      failedJobs,
      windowMinutes,
    };
  }

  async getPendingCount(queueName: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(queueJobs)
      .where(
        and(
          eq(queueJobs.queueName, queueName),
          eq(queueJobs.status, 'pending')
        )
      );

    return Number(result?.count || 0);
  }

  private startPolling(): void {
    if (this.polling) return;
    
    this.polling = true;
    this.pollForJobs();
  }

  private async pollForJobs(): Promise<void> {
    if (!this.polling) return;

    try {
      // Process delayed jobs that are ready
      await this.processDelayedJobs();
      
      // Process pending jobs for each active processor
      for (const [queueName, processor] of Array.from(this.processors.entries())) {
        if (!processor.active) continue;
        
        await this.processQueueJobs(queueName, processor);
      }
    } catch (error) {
      logger.error('Error in queue polling:', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => this.pollForJobs(), this.pollInterval);
  }

  private async processDelayedJobs(): Promise<void> {
    await db
      .update(queueJobs)
      .set({ status: 'pending' })
      .where(
        and(
          eq(queueJobs.status, 'delayed'),
          sql`delay_until <= now()`
        )
      );
  }

  private async processQueueJobs(queueName: string, processor: ProcessorConfig): Promise<void> {
    // Use PostgreSQL FOR UPDATE SKIP LOCKED for job claiming
    const jobs = await db
      .select()
      .from(queueJobs)
      .where(
        and(
          eq(queueJobs.queueName, queueName),
          eq(queueJobs.status, 'pending')
        )
      )
      .limit(processor.concurrency)
      .for('update', { skipLocked: true });

    for (const job of jobs) {
      this.processJob(job, processor.handler);
    }
  }

  private async processJob(
    job: typeof queueJobs.$inferSelect,
    handler: QueueJobHandler<unknown>
  ): Promise<void> {
    try {
      // Mark job as active
      await db
        .update(queueJobs)
        .set({
          status: 'active',
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(queueJobs.id, job.id));

      // Execute the job
      await handler(job.payload, job.id.toString());

      // Mark as completed
      await db
        .update(queueJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(queueJobs.id, job.id));

    } catch (error) {
      logger.error(`Job ${job.id} failed:`, error);
      
      const attempts = job.attempts + 1;
      const shouldRetry = attempts < job.maxAttempts;

      if (shouldRetry) {
        // Exponential backoff: 1min, 2min, 4min, etc.
        const delayMinutes = Math.pow(2, attempts - 1);
        const delayUntil = new Date(Date.now() + delayMinutes * 60 * 1000);

        await db
          .update(queueJobs)
          .set({
            status: 'delayed',
            attempts,
            delayUntil,
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(queueJobs.id, job.id));
      } else {
        // Mark as permanently failed
        await db
          .update(queueJobs)
          .set({
            status: 'failed',
            attempts,
            failedAt: new Date(),
            error: error instanceof Error ? error.message : String(error),
            updatedAt: new Date(),
          })
          .where(eq(queueJobs.id, job.id));
      }
    }
  }
}