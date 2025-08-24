import { postWorker } from "./post-worker.js";
import { metricsWorker } from "./metrics-worker.js";
import { aiPromoWorker } from "./ai-promo-worker.js";
import { dunningWorker } from "./dunning-worker.js";
import { batchPostingWorker } from "./batch-posting-worker.js";

// Initialize all workers
export async function initializeWorkers() {
  console.log('🔄 Initializing background workers...');
  
  // Initialize each worker
  await postWorker.initialize();
  console.log('✅ Post worker initialized');
  
  await metricsWorker.initialize();
  console.log('✅ Metrics worker initialized');
  
  await aiPromoWorker.initialize();
  console.log('✅ AI Promo worker initialized');
  
  await dunningWorker.initialize();
  console.log('✅ Dunning worker initialized');
  
  await batchPostingWorker.initialize();
  console.log('✅ Batch posting worker initialized');
}

// Graceful shutdown
export async function shutdownWorkers() {
  console.log('🔄 Shutting down workers...');
  
  await postWorker.close();
  await metricsWorker.close();
  await aiPromoWorker.close();
  await dunningWorker.close();
  await batchPostingWorker.close();
  
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