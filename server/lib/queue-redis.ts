/**
 * Phase 5: Redis BullMQ Queue Implementation
 * Wrapper around existing BullMQ functionality to implement IQueue interface
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import type { IQueue, QueueJobHandler, QueueJobOptions, QueueFailureStats } from './queue-interface';

export class RedisBullQueue implements IQueue {
  private redis: IORedis;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private queueEvents = new Map<string, QueueEvents>();

  constructor(redisUrl: string) {
    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 3,
    });
  }

  async initialize(): Promise<void> {
    console.error('🚀 Initializing Redis BullMQ Queue backend');
    // Test Redis connection
    await this.redis.ping();
  }

  async close(): Promise<void> {
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
    console.error('📦 Redis BullMQ Queue backend closed');
  }

  async enqueue<T = unknown>(
    queueName: string,
    payload: T,
    options: QueueJobOptions = {}
  ): Promise<string> {
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

    return job.id ?? '';
  }

  async process<T = unknown>(
    queueName: string,
    handler: QueueJobHandler<T>,
    options: { concurrency?: number } = {}
  ): Promise<void> {
    const worker = new Worker(
      queueName,
      async (job) => {
        await handler(job.data, job.id ?? '');
      },
      {
        connection: this.redis,
        concurrency: options.concurrency || 1,
      }
    );

    this.workers.set(queueName, worker);

    // Handle worker events
    worker.on('completed', (job) => {
      console.log(`✅ Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Job ${job?.id} failed in queue ${queueName}:`, err);
    });
  }

  async pause(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.pause();
    }
    
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  async resume(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (worker) {
      await worker.resume();
    }
    
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  async getFailureRate(queueName: string, windowMinutes: number): Promise<QueueFailureStats> {
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

  async getPendingCount(queueName: string): Promise<number> {
    const queue = this.getOrCreateQueue(queueName);
    return await queue.getWaiting().then(jobs => jobs.length);
  }

  private getOrCreateQueue(queueName: string): Queue {
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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return queue;
  }

  private getOrCreateQueueEvents(queueName: string): QueueEvents {
    if (!this.queueEvents.has(queueName)) {
      const queueEvents = new QueueEvents(queueName, {
        connection: this.redis,
      });
      this.queueEvents.set(queueName, queueEvents);
    }
    const queueEvents = this.queueEvents.get(queueName);
    if (!queueEvents) {
      throw new Error(`QueueEvents ${queueName} not initialized`);
    }
    return queueEvents;
  }
}