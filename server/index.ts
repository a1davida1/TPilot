import { pathToFileURL } from 'node:url';
import type { Express } from 'express';
import {
  createApp,
  type CreateAppOptions,
  type CreateAppResult,
} from './app.js';
import { API_PREFIX } from './lib/api-prefix.js';
import { logger } from './bootstrap/logger.js';
import { sentryService } from './lib/sentry.js';

process.on('unhandledRejection', (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('Unhandled rejection', { error: message });
  if (err instanceof Error) {
    sentryService.captureException(err);
  }
  process.exit(1);
});

export { createApp, API_PREFIX };
export type { CreateAppOptions, CreateAppResult };

export async function createExpressApp(options: CreateAppOptions = {}): Promise<Express> {
  const { app } = await createApp(options);
  return app;
}

async function bootstrap(): Promise<void> {
  const startTime = Date.now();
  logger.info('[HEALTH] Starting application bootstrap...');
  logger.info(`[HEALTH] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[HEALTH] Platform: ${process.platform}`);
  logger.info(`[HEALTH] Architecture: ${process.arch}`);
  
  // Initialize Sentry for error tracking
  if (process.env.NODE_ENV === 'production') {
    sentryService.initialize();
  }
  
  // Set startup timeout for deployment
  const STARTUP_TIMEOUT = 30000; // 30 seconds
  const timeoutId = setTimeout(() => {
    logger.error('[HEALTH] ❌ Server startup timeout exceeded');
    process.exit(1);
  }, STARTUP_TIMEOUT);

  try {
    const { server } = await createApp();
    const createAppTime = Date.now() - startTime;
    logger.info(`[HEALTH] Express app created successfully in ${createAppTime}ms`);

    // Initialize background workers
    logger.info('[HEALTH] Starting background workers...');
    try {
      const { 
        createRemovalDetectionWorker, 
        createRemovalSchedulerWorker, 
        scheduleRemovalChecks 
      } = await import('./jobs/removal-detection-worker.js');
      
      createRemovalDetectionWorker();
      createRemovalSchedulerWorker();
      await scheduleRemovalChecks();
      
      logger.info('[HEALTH] ✅ Background workers started successfully');
    } catch (workerError) {
      logger.warn('[HEALTH] ⚠️ Failed to start background workers (non-fatal):', workerError);
      // Don't fail startup if workers fail - they're non-critical
    }

    // Use dynamic port selection to avoid collisions
    const defaultPort = process.env.NODE_ENV === 'production' ? 3005 : 3005;
    const port = Number.parseInt(process.env.PORT ?? String(defaultPort), 10);
    logger.info(`[HEALTH] Target port from environment: ${port}`);
    logger.info(`[HEALTH] Starting server on 0.0.0.0:${port}`);

    // Promisify server.listen for better error handling
    await new Promise<void>((resolve, reject) => {
      const handleError = (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`[HEALTH] ❌ Port ${port} is already in use`);
          logger.info('[HEALTH] Tip: Use PORT env variable to specify a different port');
          logger.info('[HEALTH] Example: PORT=3006 npm run dev');
        } else {
          logger.error(`[HEALTH] ❌ Server startup failed:`, {
            code: err.code,
            message: err.message,
            port: port
          });
        }
        clearTimeout(timeoutId);
        reject(err);
      };

      server.listen(port, '0.0.0.0', () => {
        const totalTime = Date.now() - startTime;
        logger.info(`[HEALTH] ✅ Server started successfully on port ${port} in ${totalTime}ms`);
        logger.info(`serving on port ${port}`);
        clearTimeout(timeoutId);
        resolve();
      });

      server.on('error', handleError);
    });
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

const isExecutedDirectly =
  typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isExecutedDirectly) {
  logger.info('[HEALTH] Script executed directly, starting bootstrap...');
  bootstrap().catch((error: unknown) => {
    logger.error('[HEALTH] ❌ Failed to start application:', error);
    if (error instanceof Error) {
      logger.error('[HEALTH] Error stack:', error.stack);
    }
    process.exit(1);
  });
}