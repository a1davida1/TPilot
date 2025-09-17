import { createApp } from './app.js';
import { logger } from './bootstrap/logger.js';

process.on('unhandledRejection', (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('Unhandled rejection', { error: message });
  process.exit(1);
});

(async () => {
  try {
    const { server } = await createApp();

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = Number.parseInt(process.env.PORT ?? '5000', 10);

    // Graceful port binding with EADDRINUSE error handling
    const startServer = (attemptPort: number, retryCount = 0): void => {
      const maxRetries = 3;

      // Remove any existing error listeners to prevent memory leaks
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
            // In Replit, we can only use the PORT environment variable
            // Try to kill any stray processes and retry the same port
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
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
})();