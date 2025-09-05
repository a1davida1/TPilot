import { initializeQueue } from "../lib/queue-factory";
import { initializeWorkers } from "../lib/workers/index";
import { logger } from "./logger";

// Queue system initialization
export async function startQueue() {
  try {
    logger.info('🔄 Initializing queue system...');
    
    // Initialize Phase 5 queue system
    await initializeQueue();
    logger.info('✅ Queue system initialized');
    
    // Initialize all workers
    await initializeWorkers();
    logger.info('✅ Background workers initialized');

    // Start queue monitoring
    const { queueMonitor } = await import("../lib/queue-monitor.js");
    await queueMonitor.startMonitoring(30000); // Monitor every 30 seconds
    logger.info('✅ Queue monitoring started (interval: 30000ms)');

    // Start worker auto-scaling
    const { workerScaler } = await import("../lib/worker-scaler.js");
    await workerScaler.startScaling(60000); // Scale every minute
    logger.info('✅ Worker auto-scaling started (interval: 60000ms)');
    
  } catch (error) {
    logger.error('❌ Failed to initialize queue system', { error });
    throw error;
  }
}

// Graceful queue shutdown
export async function stopQueue() {
  try {
    logger.info('🔄 Shutting down queue system...');
    
    // Stop monitoring
    const { queueMonitor } = await import("../lib/queue-monitor.js");
    await queueMonitor.stopMonitoring();
    
    // Stop worker scaling
    const { workerScaler } = await import("../lib/worker-scaler.js");
    await workerScaler.stopScaling();
    
    logger.info('✅ Queue system shutdown complete');
  } catch (error) {
    logger.error('❌ Error during queue shutdown', { error });
  }
}

// Queue health check
export async function checkQueueHealth() {
  try {
    // This would typically check queue connection, worker status, etc.
    // For now, return a basic health status
    return {
      status: 'healthy',
      workers: 'running',
      monitoring: 'active',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('Queue health check failed', { error });
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}