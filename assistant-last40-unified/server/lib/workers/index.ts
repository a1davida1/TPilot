import { postWorker } from "./post-worker.js";
import { metricsWorker } from "./metrics-worker.js";
import { aiPromoWorker } from "./ai-promo-worker.js";
import { dunningWorker } from "./dunning-worker.js";
import { batchPostingWorker } from "./batch-posting-worker.js";
import { communitySyncWorker } from "./community-sync-worker.js";
import { logger } from "../logger.js";

// Initialize all workers
export async function initializeWorkers() {
  logger.info('🔄 Initializing background workers...');
  
  // Initialize each worker
  await postWorker.initialize();
  logger.info('✅ Post worker initialized');
  
  await metricsWorker.initialize();
  logger.info('✅ Metrics worker initialized');
  
  await aiPromoWorker.initialize();
  logger.info('✅ AI Promo worker initialized');
  
  await dunningWorker.initialize();
  logger.info('✅ Dunning worker initialized');
  
  await batchPostingWorker.initialize();
  logger.info('✅ Batch posting worker initialized');
  
  await communitySyncWorker.initialize();
  logger.info('✅ Community sync worker initialized');

  const { queueMonitor } = await import("../queue-monitor.js");
  await queueMonitor.startMonitoring(30000);
  logger.info('🚀 Queue monitoring started');
}

// Graceful shutdown
export async function shutdownWorkers() {
  logger.info('🔄 Shutting down workers...');
  
  await postWorker.close();
  await metricsWorker.close();
  await aiPromoWorker.close();
  await dunningWorker.close();
  await batchPostingWorker.close();
  await communitySyncWorker.close();
  
  logger.info('✅ All workers shut down');
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