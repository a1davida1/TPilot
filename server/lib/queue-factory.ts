/**
 * Phase 5: Queue Factory
 * Creates appropriate queue backend based on environment configuration
 */

import type { IQueue } from './queue-interface.js';
import { RedisBullQueue } from './queue-redis.js';
import { PgQueue } from './queue-pg.js';
import { env } from './config.js';

let queueInstance: IQueue | null = null;

export function getQueueBackend(): IQueue {
  if (queueInstance) {
    return queueInstance;
  }

  // Determine which backend to use
  const shouldUseRedis = !env.USE_PG_QUEUE && env.REDIS_URL;

  if (shouldUseRedis && env.REDIS_URL) {
    console.log('🚀 Using Redis BullMQ queue backend');
    queueInstance = new RedisBullQueue(env.REDIS_URL);
  } else {
    console.log('🔧 Using PostgreSQL queue backend (Redis not available)');
    queueInstance = new PgQueue();
  }

  return queueInstance;
}

export async function initializeQueue(): Promise<void> {
  const queue = getQueueBackend();
  await queue.initialize();
}

export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}

// Convenience functions for common queue operations
export async function enqueue<T = any>(
  queueName: string,
  payload: T,
  options?: Parameters<IQueue['enqueue']>[2]
): Promise<string> {
  const queue = getQueueBackend();
  return queue.enqueue(queueName, payload, options);
}

export async function registerProcessor<T = any>(
  queueName: string,
  handler: Parameters<IQueue['process']>[1],
  options?: Parameters<IQueue['process']>[2]
): Promise<void> {
  const queue = getQueueBackend();
  return queue.process(queueName, handler, options);
}

export async function pauseQueue(queueName: string): Promise<void> {
  const queue = getQueueBackend();
  return queue.pause(queueName);
}

export async function resumeQueue(queueName: string): Promise<void> {
  const queue = getQueueBackend();
  return queue.resume(queueName);
}