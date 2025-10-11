/**
 * Test endpoint for Sentry error tracking
 * Remove this file after verifying Sentry works
 */

import { Router } from 'express';
import * as Sentry from '@sentry/node';
import { logger } from '../bootstrap/logger.js';

const router = Router();

router.get('/test-sentry', (req, res) => {
  logger.info('Testing Sentry error tracking...');
  
  // Create a test error
  const testError = new Error('Test error from ThottoPilot - Sentry is working!');
  
  // Capture it with Sentry
  Sentry.captureException(testError, {
    tags: {
      test: true,
      environment: process.env.NODE_ENV || 'development'
    },
    user: {
      id: 'test-user',
      email: 'test@thottopilot.com'
    }
  });
  
  // Also log it
  logger.error('Test error sent to Sentry', { error: testError.message });
  
  res.status(500).json({
    message: 'Test error sent to Sentry! Check your Sentry dashboard.',
    sentryEnabled: !!process.env.SENTRY_DSN,
    timestamp: new Date().toISOString()
  });
});

export { router as testSentryRouter };
