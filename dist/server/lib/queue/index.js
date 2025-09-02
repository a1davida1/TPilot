/**
 * Phase 5: Modern Queue System
 * Uses abstracted queue interface with Redis/PostgreSQL fallback
 */
import { getQueueBackend, enqueue } from "../queue-factory.js";
// Queue names for type safety
export const QUEUE_NAMES = {
    POST: 'post-queue',
    BATCH_POST: 'batch-post-queue',
    METRICS: 'metrics-queue',
    AI_PROMO: 'ai-promo-queue',
    DUNNING: 'dunning-queue',
};
// Helper function to add jobs with proper types
export async function addJob(queueName, jobData, options) {
    return enqueue(queueName, jobData, options);
}
// Queue management functions
export async function pauseQueue(queueName) {
    const backend = getQueueBackend();
    if (backend.pause) {
        await backend.pause(queueName);
    }
    else {
        console.warn(`Queue backend does not support pausing queue: ${queueName}`);
    }
}
export async function resumeQueue(queueName) {
    const backend = getQueueBackend();
    if (backend.resume) {
        await backend.resume(queueName);
    }
    else {
        console.warn(`Queue backend does not support resuming queue: ${queueName}`);
    }
}
// Queue health check
export async function getQueueHealth() {
    const queue = getQueueBackend();
    const health = {};
    for (const queueName of Object.values(QUEUE_NAMES)) {
        try {
            const pending = await queue.getPendingCount(queueName);
            const failureStats = await queue.getFailureRate(queueName, 60); // Last hour
            health[queueName] = {
                pending,
                failureRate: failureStats.failureRate,
                totalJobs: failureStats.totalJobs,
                failedJobs: failureStats.failedJobs,
            };
        }
        catch (error) {
            health[queueName] = { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
    return health;
}
// Graceful shutdown
export async function closeQueues() {
    const queue = getQueueBackend();
    await queue.close();
}
