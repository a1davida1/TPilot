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
