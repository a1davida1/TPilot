import { pathToFileURL } from 'node:url';
import type { Express } from 'express';
import {
  createApp,
  API_PREFIX,
  type CreateAppOptions,
  type CreateAppResult,
} from './app.js';
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
  const { server } = await createApp();

  const port = Number.parseInt(process.env.PORT ?? '5000', 10);

  const startServer = (attemptPort: number, retryCount = 0): void => {
    const maxRetries = 3;

    server.removeAllListeners('error');

    server.listen(
      {
        port: attemptPort,
        host: '0.0.0.0',
        reusePort: true,
      },
      () => {
        logger.info(`serving on port ${attemptPort}`);
        if (attemptPort !== port) {
          logger.info(`Note: Using fallback port ${attemptPort} instead of ${port}`);
        }
      },
    );

    server.on('error', (err: unknown) => {
      const error = err as NodeJS.ErrnoException;
      if (error.code === 'EADDRINUSE') {
        logger.warn(`Port ${attemptPort} is in use`, { error: (error as Error).message });

        if (retryCount < maxRetries) {
          logger.info(`Retrying port ${attemptPort} in 2 seconds (attempt ${retryCount + 1}/${maxRetries})`);
          setTimeout(() => {
            startServer(attemptPort, retryCount + 1);
          }, 2000);
        } else {
          logger.error(`Failed to bind to port ${attemptPort} after ${maxRetries} attempts`);
          logger.error('Please check if another process is using this port and restart the application');
          process.exit(1);
        }
      } else {
        logger.error('Server error:', error);
        process.exit(1);
      }
    });
  };

  startServer(port);
}

const isExecutedDirectly =
  typeof process.argv[1] === 'string' && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isExecutedDirectly) {
  bootstrap().catch((error: unknown) => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}