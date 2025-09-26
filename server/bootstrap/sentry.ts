import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

export function initializeSentry(): typeof Sentry | null {
  if (!process.env.SENTRY_DSN) {
    logger.info('Sentry DSN not configured, skipping Sentry initialization');
    return null;
  }

  try {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
      ],
      beforeSend(event: Sentry.ErrorEvent) {
        // Filter out sensitive information or unwanted errors
        if (event.exception) {
          const error = event.exception.values?.[0];
          if (error?.type === 'ValidationError' || error?.type === 'AuthenticationError') {
            return null; // Don't send validation/auth errors to Sentry
          }
        }
        return event;
      },
      release: process.env.npm_package_version || '1.0.0',
      initialScope: {
        tags: {
          component: 'server'
        }
      }
    });

    logger.info('Sentry initialized successfully');
    return Sentry;
  } catch (error) {
    logger.error('Failed to initialize Sentry', error);
    return null;
  }
}

export { Sentry };