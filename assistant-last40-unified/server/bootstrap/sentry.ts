
import * as loggerModule from './logger.js';

export type SentryModule = typeof import('@sentry/node');

type ValidateResult = { isValid: boolean; warnings: string[]; errors: string[] };

const logger = loggerModule.logger ?? {
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

const validateSentryConfig: () => ValidateResult =
  typeof loggerModule.validateSentryConfig === 'function'
    ? loggerModule.validateSentryConfig
    : () => ({ isValid: true, warnings: [], errors: [] });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

export async function initializeSentry(): Promise<SentryModule | null> {
  let Sentry: SentryModule | null = null;

  const configValidation = validateSentryConfig();

  configValidation.warnings.forEach((warning) => {
    logger.warn(`Sentry configuration warning: ${warning}`);
  });

  if (!configValidation.isValid) {
    configValidation.errors.forEach((error) => {
      logger.error(`Sentry configuration error: ${error}`);
    });
    return null;
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return null;
  }

  try {
    let SentryModule: SentryModule | null = null;
    try {
      SentryModule = await import('@sentry/node');
    } catch {
      SentryModule = null;
    }

    if (!SentryModule) {
      logger.warn('Sentry module not available, continuing without error tracking');
      return null;
    }

    Sentry = SentryModule;

    const tracesSampleRate = Number.parseFloat(process.env.SENTRY_SAMPLE_RATE ?? '0.1');
    const profilesSampleRate = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;

    const sentryConfig: Parameters<SentryModule['init']>[0] = {
      dsn,
      environment: process.env.NODE_ENV,
      tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
      profilesSampleRate,
      integrations: [Sentry.expressIntegration()],
      beforeSend(event, hint) {
        if (process.env.NODE_ENV === 'development' && isRecord(event.request)) {
          const url = event.request.url;
          if (typeof url === 'string' && url.includes('/_vite/')) {
            return null;
          }
        }

        if (hint && isRecord(hint)) {
          const originalException = hint.originalException;
          if (isRecord(originalException) && typeof originalException.message === 'string') {
            if (originalException.message.includes('ECONNRESET') || originalException.message.includes('EPIPE')) {
              return null;
            }
          }
        }

        return event;
      },
      release: process.env.GIT_COMMIT_SHA,
      initialScope: {
        tags: {
          component: 'backend',
          node_env: process.env.NODE_ENV,
        },
      },
    };

    Sentry.init(sentryConfig);

    logger.info('Sentry initialized successfully', {
      environment: sentryConfig.environment,
      tracesSampleRate: sentryConfig.tracesSampleRate,
      release: sentryConfig.release,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    logger.error('Sentry initialization failed', { error: message, stack });
  }

  return Sentry;
}
