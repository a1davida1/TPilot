import * as Sentry from '@sentry/node';
// Sentry v7 types
import { logger } from './logger.js';

let sentryInitialized = false;

export function initializeSentry(): typeof Sentry | null {
  if (sentryInitialized) {
    logger.warn('Sentry already initialized, skipping duplicate init');
    return Sentry;
  }

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
      // Sentry v7 integrations (auto-included)
      // integrations: [],  
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        beforeSend(event: any, _hint: any) {
        const err = event.exception?.values?.[0];
        if (err?.type === 'ValidationError' || err?.type === 'AuthenticationError') {
          return null;
        }
        return event;
      },
      release: process.env.npm_package_version || '1.0.0',
      initialScope: { tags: { component: 'server' } },
    });

    sentryInitialized = true;
    logger.info('Sentry initialized successfully');
    return Sentry;
  } catch (e) {
    logger.error('Failed to initialize Sentry', e);
    return null;
  }
}

export { Sentry };