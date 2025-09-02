import { postWorker } from "./post-worker.js";
// Initialize all workers
export function initializeWorkers() {
    console.log('🔄 Initializing background workers...');
    // Workers are initialized when imported
    console.log('✅ Post worker initialized');
    // Future workers would be initialized here:
    // - metrics-worker (track engagement)
    // - ai-promo-worker (generate promotional content)
    // - dunning-worker (handle payment failures)
}
// Graceful shutdown
export async function shutdownWorkers() {
    console.log('🔄 Shutting down workers...');
    await postWorker.close();
    console.log('✅ All workers shut down');
}
// Health check for workers
export function getWorkersHealth() {
    return {
        postWorker: {
            status: 'running', // Would check actual worker status
            processed: 0, // Would get from worker stats
            failed: 0,
        },
    };
}
