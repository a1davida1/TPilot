import { pathToFileURL } from 'node:url';
import type { Express } from 'express';
import {
  createApp,
  type CreateAppOptions,
  type CreateAppResult,
} from './app.js';
import { API_PREFIX } from './lib/api-prefix.js';
import { logger } from './bootstrap/logger.js';

process.on('unhandledRejection', (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('Unhandled rejection', { error: message });
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

    const port = Number.parseInt(process.env.PORT ?? '5000', 10);
    logger.info(`[HEALTH] Target port from environment: ${port}`);
    logger.info(`[HEALTH] Starting server on 0.0.0.0:${port}`);

    // Promisify server.listen for better error handling
    await new Promise<void>((resolve, reject) => {
      server.listen(port, '0.0.0.0', () => {
        const totalTime = Date.now() - startTime;
        logger.info(`[HEALTH] ✅ Server started successfully on port ${port} in ${totalTime}ms`);
        logger.info(`serving on port ${port}`);
        clearTimeout(timeoutId);
        resolve();
      });

      server.on('error', (err: unknown) => {
        const error = err as NodeJS.ErrnoException;
        logger.error(`[HEALTH] ❌ Server startup failed:`, {
          code: error.code,
          message: error.message,
          port: port
        });
        clearTimeout(timeoutId);
        reject(error);
      });
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