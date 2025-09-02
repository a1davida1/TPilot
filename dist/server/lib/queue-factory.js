/**
 * Phase 5: Queue Factory
 * Creates appropriate queue backend based on environment configuration
 */
import { RedisBullQueue } from './queue-redis.js';
import { PgQueue } from './queue-pg.js';
import { env } from './config.js';
let queueInstance = null;
export function getQueueBackend() {
    if (queueInstance) {
        return queueInstance;
    }
    // Determine which backend to use
    const shouldUseRedis = !env.USE_PG_QUEUE && env.REDIS_URL;
    if (shouldUseRedis && env.REDIS_URL) {
        console.log('🚀 Using Redis BullMQ queue backend');
        queueInstance = new RedisBullQueue(env.REDIS_URL);
    }
    else {
        console.log('🔧 Using PostgreSQL queue backend (Redis not available)');
        queueInstance = new PgQueue();
    }
    return queueInstance;
}
export async function initializeQueue() {
    const queue = getQueueBackend();
    await queue.initialize();
}
export async function closeQueue() {
    if (queueInstance) {
        await queueInstance.close();
        queueInstance = null;
    }
}
// Convenience functions for common queue operations
export async function enqueue(queueName, payload, options) {
    const queue = getQueueBackend();
    return queue.enqueue(queueName, payload, options);
}
export async function registerProcessor(queueName, handler, options) {
    const queue = getQueueBackend();
    return queue.process(queueName, handler, options);
}
export async function pauseQueue(queueName) {
    const queue = getQueueBackend();
    return queue.pause(queueName);
}
export async function resumeQueue(queueName) {
    const queue = getQueueBackend();
    return queue.resume(queueName);
}
