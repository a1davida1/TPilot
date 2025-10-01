// IMPORTANT: This file must be imported first, before any other modules
// This ensures Sentry can capture all errors from the start of the application
import * as Sentry from '@sentry/node';

// Initialize Sentry as early as possible
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance Monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Integrations
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    
    // Send default PII data (IP addresses, etc.)
    sendDefaultPii: true,
    
    // Filter out unwanted errors before sending
    beforeSend(event) {
      // Filter out validation and authentication errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.type === 'ValidationError' || error?.type === 'AuthenticationError') {
          return null; // Don't send these to Sentry
        }
      }
      return event;
    },
    
    // Release version
    release: process.env.npm_package_version || '1.0.0',
    
    // Initial scope tags
    initialScope: {
      tags: {
        component: 'server',
        platform: 'node'
      }
    }
  });

  console.log('✅ Sentry initialized successfully');
} else {
  console.log('⚠️  Sentry DSN not configured, error tracking disabled');
}

export { Sentry };
