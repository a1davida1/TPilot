/**
 * Sentry Error Tracking Configuration
 * Provides comprehensive error monitoring for production
 */

import * as Sentry from '@sentry/node';
// import { nodeProfilingIntegration } from '@sentry/profiling-node'; // Commented out - package not installed
import { logger } from '../bootstrap/logger.js';

interface SentryConfig {
  dsn?: string;
  environment: string;
  release?: string;
  sampleRate: number;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

class SentryService {
  private config: SentryConfig;
  private initialized: boolean = false;

  constructor() {
    this.config = {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '1.0'),
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
      enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN
    };
  }

  /**
   * Initialize Sentry with configuration
   */
  initialize(): void {
    if (!this.config.enabled) {
      logger.info('Sentry disabled - not in production or DSN not configured');
      return;
    }

    if (this.initialized) {
      logger.warn('Sentry already initialized');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        profilesSampleRate: this.config.profilesSampleRate,
        
        integrations: [
          // HTTP integration
          new Sentry.Integrations.Http({ tracing: true }),
          // Express integration
          new Sentry.Integrations.Express({
            app: true,
            router: true,
            transaction: true
          }),
          // Postgres integration
          new Sentry.Integrations.Postgres(),
          // Redis integration if available
          ...(process.env.REDIS_URL ? [new Sentry.Integrations.Redis()] : []),
          // Performance profiling - disabled until package installed
          // nodeProfilingIntegration(),
        ],

        // Before send hook for data sanitization
        beforeSend: (event, hint) => {
          // Sanitize sensitive data
          if (event.request) {
            // Remove auth headers
            if (event.request.headers) {
              delete event.request.headers['authorization'];
              delete event.request.headers['x-api-key'];
              delete event.request.headers['cookie'];
            }
            // Remove sensitive body fields
            if (event.request.data && typeof event.request.data === 'object') {
              const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];
              sensitiveFields.forEach(field => {
                if (field in event.request.data) {
                  event.request.data[field] = '[REDACTED]';
                }
              });
            }
          }

          // Add custom tags
          event.tags = {
            ...event.tags,
            component: 'backend',
            tier: process.env.TIER || 'unknown'
          };

          // Filter out certain errors
          const error = hint.originalException;
          if (error && error instanceof Error) {
            // Don't send 404 errors
            if (error.message?.includes('404') || error.message?.includes('Not Found')) {
              return null;
            }
            // Don't send validation errors
            if (error.name === 'ValidationError' || error.name === 'ZodError') {
              return null;
            }
          }

          return event;
        },

        // Breadcrumb filtering
        beforeBreadcrumb: (breadcrumb) => {
          // Filter out noisy breadcrumbs
          if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
            return null;
          }
          
          // Sanitize data in breadcrumbs
          if (breadcrumb.data) {
            const sensitiveKeys = ['password', 'token', 'apiKey'];
            sensitiveKeys.forEach(key => {
              if (key in breadcrumb.data) {
                breadcrumb.data[key] = '[REDACTED]';
              }
            });
          }

          return breadcrumb;
        },

        // Ignore specific errors
        ignoreErrors: [
          // Browser errors
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          // Network errors
          'NetworkError',
          'Failed to fetch',
          // User cancellations
          'AbortError',
          'Non-Error promise rejection captured',
        ],

        // Transaction naming
        beforeTransaction: (context) => {
          // Normalize transaction names
          if (context.name?.startsWith('GET /api/')) {
            // Remove IDs from URLs
            context.name = context.name.replace(/\/\d+/g, '/:id');
          }
          return context;
        }
      });

      this.initialized = true;
      logger.info('Sentry initialized successfully', {
        dsn: this.config.dsn?.substring(0, 20) + '...',
        environment: this.config.environment,
        release: this.config.release
      });
    } catch (error) {
      logger.error('Failed to initialize Sentry', { error });
    }
  }

  /**
   * Capture an exception
   */
  captureException(error: Error, context?: Record<string, any>): string | undefined {
    if (!this.initialized) return undefined;
    
    return Sentry.captureException(error, {
      contexts: {
        custom: context
      }
    });
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string | undefined {
    if (!this.initialized) return undefined;
    
    return Sentry.captureMessage(message, level);
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.initialized) return;
    
    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; username?: string; tier?: string }): void {
    if (!this.initialized) return;
    
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
      tier: user.tier
    });
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (!this.initialized) return;
    
    Sentry.setUser(null);
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.initialized) return;
    
    Sentry.setTag(key, value);
  }

  /**
   * Set context
   */
  setContext(name: string, context: Record<string, any>): void {
    if (!this.initialized) return;
    
    Sentry.setContext(name, context);
  }

  /**
   * Start a transaction
   */
  startTransaction(name: string, op: string): any {
    if (!this.initialized) return null;
    
    return Sentry.startTransaction({
      name,
      op
    });
  }

  /**
   * Flush events before shutdown
   */
  async flush(timeout: number = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    
    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      logger.error('Failed to flush Sentry events', { error });
      return false;
    }
  }

  /**
   * Close Sentry client
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.initialized) return true;
    
    try {
      await Sentry.close(timeout);
      this.initialized = false;
      return true;
    } catch (error) {
      logger.error('Failed to close Sentry', { error });
      return false;
    }
  }

  /**
   * Express error handler middleware
   */
  errorHandler() {
    return Sentry.Handlers.errorHandler({
      shouldHandleError: (error) => {
        // Capture all 500 errors
        if (error.status && error.status >= 500) {
          return true;
        }
        // Capture specific error types
        if (error.name === 'DatabaseError' || error.name === 'RedisError') {
          return true;
        }
        return false;
      }
    });
  }

  /**
   * Express request handler middleware
   */
  requestHandler() {
    return Sentry.Handlers.requestHandler({
      user: ['id', 'email', 'username', 'tier'],
      ip: true,
      request: ['method', 'url', 'query'],
      transaction: true
    });
  }

  /**
   * Express tracing handler middleware
   */
  tracingHandler() {
    return Sentry.Handlers.tracingHandler();
  }

  /**
   * Check if Sentry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Export singleton instance
export const sentryService = new SentryService();

// Export Sentry for direct access if needed
export { Sentry };
