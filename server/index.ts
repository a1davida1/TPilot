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
  logger.info('[HEALTH] Starting application bootstrap...');
  logger.info(`[HEALTH] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[HEALTH] Platform: ${process.platform}`);
  logger.info(`[HEALTH] Architecture: ${process.arch}`);
  
  const { server } = await createApp();
  logger.info('[HEALTH] Express app created successfully');

  const port = Number.parseInt(process.env.PORT ?? '5000', 10);
  logger.info(`[HEALTH] Target port from environment: ${port}`);

  const startServer = (attemptPort: number, retryCount = 0): void => {
    const maxRetries = 3;
    
    server.removeAllListeners('error');
    
    // Add health logging for port binding process
    logger.info(`[HEALTH] Attempting to bind to port ${attemptPort} (attempt ${retryCount + 1}/${maxRetries + 1})`);
    logger.info(`[HEALTH] Server configuration: host=0.0.0.0, reusePort=true`);

    server.listen(
      {
        port: attemptPort,
        host: '0.0.0.0',
        reusePort: true,
      },
      () => {
        logger.info(`[HEALTH] ✅ Server successfully started on port ${attemptPort}`);
        logger.info(`[HEALTH] Process ID: ${process.pid}`);
        logger.info(`[HEALTH] Node version: ${process.version}`);
        logger.info(`[HEALTH] Memory usage: ${JSON.stringify(process.memoryUsage())}`);
        
        if (attemptPort !== port) {
          logger.warn(`[HEALTH] Note: Using fallback port ${attemptPort} instead of requested port ${port}`);
        }
        
        // Log successful binding
        logger.info(`serving on port ${attemptPort}`);
      },
    );

    server.on('error', (err: unknown) => {
      const error = err as NodeJS.ErrnoException;
      
      logger.error(`[HEALTH] ❌ Server error on port ${attemptPort}:`, {
        code: error.code,
        message: error.message,
        syscall: error.syscall
      });
      
      if (error.code === 'EADDRINUSE') {
        logger.warn(`[HEALTH] Port ${attemptPort} is already in use`);
        
        // Try to identify what's using the port
        logger.info(`[HEALTH] Checking what process might be using port ${attemptPort}`);

        if (retryCount < maxRetries) {
          const waitTime = 2000 * (retryCount + 1); // Exponential backoff
          logger.info(`[HEALTH] Waiting ${waitTime}ms before retry (attempt ${retryCount + 2}/${maxRetries + 1})`);
          setTimeout(() => {
            startServer(attemptPort, retryCount + 1);
          }, waitTime);
        } else {
          logger.error(`[HEALTH] Failed to bind to port ${attemptPort} after ${maxRetries + 1} attempts`);
          logger.error('[HEALTH] Possible causes:');
          logger.error('[HEALTH]   - Another process is using this port');
          logger.error('[HEALTH]   - Previous server instance did not shut down cleanly');
          logger.error('[HEALTH]   - Port permissions issue');
          logger.error('[HEALTH] Try running: lsof -i :' + attemptPort + ' or netstat -tulpn | grep ' + attemptPort);
          process.exit(1);
        }
      } else if (error.code === 'EACCES') {
        logger.error(`[HEALTH] Permission denied for port ${attemptPort}`);
        logger.error('[HEALTH] Ports below 1024 require elevated privileges');
        process.exit(1);
      } else {
        logger.error('[HEALTH] Unexpected server error:', error);
        process.exit(1);
      }
    });
  };

  startServer(port);
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