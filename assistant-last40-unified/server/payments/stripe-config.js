/**
 * Stripe configuration and setup utilities
 */

// Mock Stripe configuration for testing
export function deriveStripeConfig(environment = 'test') {
  return {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_key',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_mock_key',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_secret',
    environment: environment,
    apiVersion: '2023-10-16'
  };
}

export const stripeConfig = deriveStripeConfig();

export default stripeConfig;