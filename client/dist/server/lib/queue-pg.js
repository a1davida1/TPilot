/**
 * Phase 5: PostgreSQL Queue Implementation
 * Fallback queue implementation using PostgreSQL when Redis is not available
 */
import { db } from '../db.js';
import { queueJobs } from '../../shared/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
export class PgQueue {
    processors = new Map();
    polling = false;
    pollInterval = 2000; // 2 seconds
    pollTimer;
    async initialize() {
        console.log('🔧 Initializing PostgreSQL Queue backend');
        this.startPolling();
    }
    async close() {
        this.polling = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
        }
        console.log('📦 PostgreSQL Queue backend closed');
    }
    async enqueue(queueName, payload, options = {}) {
        const delayUntil = options.delay ? new Date(Date.now() + options.delay) : null;
        const [job] = await db.insert(queueJobs).values({
            queueName,
            payload: payload,
            maxAttempts: options.attempts || 3,
            delayUntil,
            status: delayUntil ? 'delayed' : 'pending',
        }).returning();
        return job.id.toString();
    }
    async process(queueName, handler, options = {}) {
        this.processors.set(queueName, {
            handler,
            concurrency: options.concurrency || 1,
            active: true,
        });
    }
    async pause(queueName) {
        const processor = this.processors.get(queueName);
        if (processor) {
            processor.active = false;
        }
    }
    async resume(queueName) {
        const processor = this.processors.get(queueName);
        if (processor) {
            processor.active = true;
        }
    }
    async getFailureRate(queueName, windowMinutes) {
        const since = new Date(Date.now() - windowMinutes * 60 * 1000);
        const [stats] = await db
            .select({
            total: sql `count(*)`.as('total'),
            failed: sql `count(*) filter (where status = 'failed')`.as('failed'),
        })
            .from(queueJobs)
            .where(and(eq(queueJobs.queueName, queueName), gte(queueJobs.createdAt, since)));
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
    async getPendingCount(queueName) {
        const [result] = await db
            .select({ count: sql `count(*)` })
            .from(queueJobs)
            .where(and(eq(queueJobs.queueName, queueName), eq(queueJobs.status, 'pending')));
        return Number(result?.count || 0);
    }
    startPolling() {
        if (this.polling)
            return;
        this.polling = true;
        this.pollForJobs();
    }
    async pollForJobs() {
        if (!this.polling)
            return;
        try {
            // Process delayed jobs that are ready
            await this.processDelayedJobs();
            // Process pending jobs for each active processor
            for (const [queueName, processor] of Array.from(this.processors.entries())) {
                if (!processor.active)
                    continue;
                await this.processQueueJobs(queueName, processor);
            }
        }
        catch (error) {
            console.error('Error in queue polling:', error);
        }
        // Schedule next poll
        this.pollTimer = setTimeout(() => this.pollForJobs(), this.pollInterval);
    }
    async processDelayedJobs() {
        await db
            .update(queueJobs)
            .set({ status: 'pending' })
            .where(and(eq(queueJobs.status, 'delayed'), sql `delay_until <= now()`));
    }
    async processQueueJobs(queueName, processor) {
        // Use PostgreSQL FOR UPDATE SKIP LOCKED for job claiming
        const jobs = await db
            .select()
            .from(queueJobs)
            .where(and(eq(queueJobs.queueName, queueName), eq(queueJobs.status, 'pending')))
            .limit(processor.concurrency)
            .for('update', { skipLocked: true });
        for (const job of jobs) {
            this.processJob(job, processor.handler);
        }
    }
    async processJob(job, handler) {
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
        }
        catch (error) {
            console.error(`Job ${job.id} failed:`, error);
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
            }
            else {
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
