/**
 * Phase 5: Queue Factory
 * Creates appropriate queue backend based on environment configuration
 */

import type { IQueue } from './queue-interface.js';
import { RedisBullQueue } from './queue-redis.js';
import { PgQueue } from './queue-pg.js';
import { env } from './config.js';
import { logger } from '../bootstrap/logger.js';

let queueInstance: IQueue | null = null;

export function getQueueBackend(): IQueue {
  if (queueInstance) {
    return queueInstance;
  }

  // Check if USE_PG_QUEUE is explicitly set via environment variable
  // Default to PostgreSQL only if Redis is not available OR explicitly requested
  const usePgQueue = process.env.USE_PG_QUEUE === 'true' || !env.REDIS_URL;

  logger.info(`Queue backend selection: USE_PG_QUEUE=${process.env.USE_PG_QUEUE}, REDIS_URL=${!!env.REDIS_URL}, computed=${usePgQueue}`);

  // Use Redis/BullMQ if Redis is available and PG queue not explicitly requested
  if (env.REDIS_URL && process.env.USE_PG_QUEUE !== 'true') {
    logger.info('🚀 Attempting to use Redis BullMQ queue backend');
    queueInstance = new RedisBullQueue(env.REDIS_URL);
  } else {
    logger.info('🔧 Using PostgreSQL queue backend');
    queueInstance = new PgQueue();
  }

  return queueInstance;
}

export async function initializeQueue(): Promise<void> {
  try {
    const queue = getQueueBackend();
    await queue.initialize();
  } catch (error: unknown) {
    // If Redis fails, fallback to PostgreSQL
    const errorMessage = error instanceof Error ? error.message : '';
    if ((errorMessage.includes('ECONNREFUSED') || errorMessage.includes("Stream isn't writeable")) && env.REDIS_URL) {
      logger.warn('Redis connection failed, falling back to PostgreSQL queue backend');
      env.USE_PG_QUEUE = true;
      queueInstance = new PgQueue();
      await queueInstance.initialize();
    } else {
      throw error;
    }
  }
}

export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = null;
  }
}

// Convenience functions for common queue operations
export async function enqueue<T = unknown>(
  queueName: string,
  payload: T,
  options?: Parameters<IQueue['enqueue']>[2]
): Promise<string> {
  const queue = getQueueBackend();
  return queue.enqueue(queueName, payload, options);
}

export async function registerProcessor<_T = unknown>(
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