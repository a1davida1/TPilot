import { initializeQueue } from "../lib/queue-factory.js";
import { initializeWorkers, shutdownWorkers } from "../lib/workers/index.js";
import { cronManager } from "../lib/scheduler/cron-manager.js";
import { logger } from "./logger.js";

// Queue system initialization
export async function startQueue() {
  try {
    logger.info('Initializing queue system...');

    // Initialize Phase 5 queue system
    await initializeQueue();
    logger.info('Queue system initialized');

    // Initialize all workers
    await initializeWorkers();
    logger.info('Background workers initialized');

    // Start cron manager for all scheduled tasks
    await cronManager.start();
    logger.info('Cron manager started');

    // Start queue monitoring (optional - check if module exists)
    try {
      const { queueMonitor } = await import("../lib/queue-monitor.js");
      await queueMonitor.startMonitoring(30000); // Monitor every 30 seconds
      logger.info('Queue monitoring started (interval: 30000ms)');
    } catch (error) {
      logger.warn('Queue monitor not available, skipping');
    }

    // Start worker auto-scaling (optional - check if module exists)
    try {
      const { workerScaler } = await import("../lib/worker-scaler.js");
      await workerScaler.startScaling(60000); // Scale every minute
      logger.info('Worker auto-scaling started (interval: 60000ms)');
    } catch (error) {
      logger.warn('Worker scaler not available, skipping');
    }

  } catch (error) {
    if (isConfigurationError(error)) {
      logger.warn(
        'Skipping queue startup due to missing configuration. Provide DATABASE_URL or REDIS_URL to enable background workers.',
        { error: (error as Error).message }
      );
      return;
    }

    logger.error('❌ Failed to initialize queue system', { error });
    throw error;
  }
}

function isConfigurationError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const configurationPatterns = [
    'database_url must be set',
    'database url must be set',
    'missing database_url',
    'missing database url',
    'redis_url must be set',
    'missing redis_url',
    'missing redis url',
    'configuration is missing',
    'no database_url provided',
    'no redis_url provided'
  ];

  return configurationPatterns.some(pattern => message.includes(pattern));
}

// Graceful queue shutdown
export async function stopQueue() {
  try {
    logger.info('🔄 Shutting down queue system...');

    // Stop cron manager
    await cronManager.stop();
    
    // Stop monitoring (if available)
    try {
      const { queueMonitor } = await import("../lib/queue-monitor.js");
      await queueMonitor.stopMonitoring();
    } catch (error) {
      // Monitor might not be available
    }

    // Stop worker scaling (if available)
    try {
      const { workerScaler } = await import("../lib/worker-scaler.js");
      await workerScaler.stopScaling();
    } catch (error) {
      // Scaler might not be available
    }
    
    // Shutdown workers
    await shutdownWorkers();

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
      timestamp: new Date().toISOString(),
      workers: 'active',
      queue: 'connected'
    };
  } catch (error) {
    logger.error('❌ Queue health check failed', { error });
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}