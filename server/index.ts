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
  logger.info('[HEALTH] Starting application bootstrap...');
  logger.info(`[HEALTH] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[HEALTH] Platform: ${process.platform}`);
  logger.info(`[HEALTH] Architecture: ${process.arch}`);
  
  const { server } = await createApp();
  logger.info('[HEALTH] Express app created successfully');

  const port = Number.parseInt(process.env.PORT ?? '5000', 10);
  logger.info(`[HEALTH] Target port from environment: ${port}`);

  // Simplified server startup for autoscale deployment
  logger.info(`[HEALTH] Starting server on port ${port}`);
  
  server.listen(port, '0.0.0.0', () => {
    logger.info(`[HEALTH] ✅ Server started successfully on port ${port}`);
    logger.info(`serving on port ${port}`);
  });

  server.on('error', (err: unknown) => {
    const error = err as NodeJS.ErrnoException;
    logger.error(`[HEALTH] ❌ Server startup failed:`, {
      code: error.code,
      message: error.message,
      port: port
    });
    process.exit(1);
  });
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