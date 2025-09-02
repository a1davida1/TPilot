/**
 * Phase 5: Redis BullMQ Queue Implementation
 * Wrapper around existing BullMQ functionality to implement IQueue interface
 */
import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
export class RedisBullQueue {
    redis;
    queues = new Map();
    workers = new Map();
    queueEvents = new Map();
    constructor(redisUrl) {
        this.redis = new IORedis(redisUrl, {
            maxRetriesPerRequest: 3,
        });
    }
    async initialize() {
        console.log('🚀 Initializing Redis BullMQ Queue backend');
        // Test Redis connection
        await this.redis.ping();
    }
    async close() {
        // Close all workers and queues
        for (const worker of Array.from(this.workers.values())) {
            await worker.close();
        }
        for (const queueEvents of Array.from(this.queueEvents.values())) {
            await queueEvents.close();
        }
        for (const queue of Array.from(this.queues.values())) {
            await queue.close();
        }
        await this.redis.quit();
        console.log('📦 Redis BullMQ Queue backend closed');
    }
    async enqueue(queueName, payload, options = {}) {
        const queue = this.getOrCreateQueue(queueName);
        const job = await queue.add('process', payload, {
            delay: options.delay,
            attempts: options.attempts || 3,
            priority: options.priority,
            removeOnComplete: options.removeOnComplete || 10,
            removeOnFail: options.removeOnFail || 10,
            backoff: {
                type: 'exponential',
                delay: 60000, // Start with 1 minute delay
            },
        });
        return job.id;
    }
    async process(queueName, handler, options = {}) {
        const worker = new Worker(queueName, async (job) => {
            await handler(job.data, job.id);
        }, {
            connection: this.redis,
            concurrency: options.concurrency || 1,
        });
        this.workers.set(queueName, worker);
        // Handle worker events
        worker.on('completed', (job) => {
            console.log(`✅ Job ${job.id} completed in queue ${queueName}`);
        });
        worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed in queue ${queueName}:`, err);
        });
    }
    async pause(queueName) {
        const worker = this.workers.get(queueName);
        if (worker) {
            await worker.pause();
        }
        const queue = this.queues.get(queueName);
        if (queue) {
            await queue.pause();
        }
    }
    async resume(queueName) {
        const worker = this.workers.get(queueName);
        if (worker) {
            await worker.resume();
        }
        const queue = this.queues.get(queueName);
        if (queue) {
            await queue.resume();
        }
    }
    async getFailureRate(queueName, windowMinutes) {
        const queueEvents = this.getOrCreateQueueEvents(queueName);
        const since = Date.now() - windowMinutes * 60 * 1000;
        // Get job counts within the window
        // Note: This is a simplified implementation
        // In production, you might want to store metrics in Redis or a separate store
        const queue = this.getOrCreateQueue(queueName);
        const [completed, failed] = await Promise.all([
            queue.getJobs(['completed'], since),
            queue.getJobs(['failed'], since),
        ]);
        const totalJobs = completed.length + failed.length;
        const failedJobs = failed.length;
        const failureRate = totalJobs > 0 ? failedJobs / totalJobs : 0;
        return {
            failureRate,
            totalJobs,
            failedJobs,
            windowMinutes,
        };
    }
    async getPendingCount(queueName) {
        const queue = this.getOrCreateQueue(queueName);
        return await queue.getWaiting().then(jobs => jobs.length);
    }
    getOrCreateQueue(queueName) {
        if (!this.queues.has(queueName)) {
            const queue = new Queue(queueName, {
                connection: this.redis,
                defaultJobOptions: {
                    removeOnComplete: 10,
                    removeOnFail: 10,
                },
            });
            this.queues.set(queueName, queue);
        }
        return this.queues.get(queueName);
    }
    getOrCreateQueueEvents(queueName) {
        if (!this.queueEvents.has(queueName)) {
            const queueEvents = new QueueEvents(queueName, {
                connection: this.redis,
            });
            this.queueEvents.set(queueName, queueEvents);
        }
        return this.queueEvents.get(queueName);
    }
}
