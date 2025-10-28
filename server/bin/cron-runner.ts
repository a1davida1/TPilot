#!/usr/bin/env node
/**
 * Cron Runner - Entry point for Render cron service
 *
 * This script starts the cron manager and keeps the process alive
 * to handle scheduled tasks like:
 * - Processing scheduled posts every minute
 * - Cleaning up old posts daily
 * - Updating analytics hourly
 * - Syncing Reddit communities weekly
 */

import { logger } from '../bootstrap/logger.js';
import { startQueue, stopQueue } from '../bootstrap/queue.js';

async function main() {
  logger.info('🚀 Starting cron runner...');

  try {
    // Start the queue system (which includes cron manager)
    await startQueue();

    logger.info('✅ Cron runner started successfully');
    logger.info('📋 Active cron jobs: process-scheduled-posts, cleanup-old-posts, update-analytics, check-stuck-jobs, sync-reddit-communities, database-backup');

  } catch (error) {
    logger.error('❌ Failed to start cron runner', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`📥 Received ${signal}, shutting down gracefully...`);
    await stopQueue();
    logger.info('👋 Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Keep the process alive
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    // Don't exit - let the cron jobs continue running
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('💥 Unhandled promise rejection', { reason });
    // Don't exit - let the cron jobs continue running
  });
}

main();
