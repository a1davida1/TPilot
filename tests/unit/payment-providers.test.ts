import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { makePaxum, makeCoinbase, makeStripe } from '../../server/payments/payment-providers';

describe('Payment Providers', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Paxum Provider', () => {
    test('creates checkout URL with valid API key', async () => {
      process.env.PAXUM_API_KEY = 'test_paxum_merchant_id';
      process.env.APP_BASE_URL = 'https://test.com';

      const provider = makePaxum();
      expect(provider.enabled).toBe(true);
      expect(provider.name).toBe('paxum');

      const result = await provider.createCheckout({
        userId: 'user123',
        planId: 'pro',
        amountCents: 2999,
        returnUrl: 'https://test.com/success'
      });

      expect(result.url).toContain('https://www.paxum.com/payment/checkout');
      expect(result.url).toContain('business=test_paxum_merchant_id');
      expect(result.url).toContain('button_id=pro');
      expect(result.url).toContain('amount=29.99');
      expect(result.url).toContain('custom=user123');
      expect(result.url).toContain('return_url=https%3A%2F%2Ftest.com%2Fsuccess');
    });

    test('uses default return URL when none provided', async () => {
      process.env.PAXUM_API_KEY = 'test_merchant';
      process.env.APP_BASE_URL = 'https://thottopilot.com';

      const provider = makePaxum();
      const result = await provider.createCheckout({
        userId: 'user123',
        planId: 'basic'
      });

      expect(result.url).toContain('return_url=https%3A%2F%2Fthottopilot.com%2Fbilling%2Fsuccess');
      expect(result.url).toContain('cancel_url=https%3A%2F%2Fthottopilot.com%2Fbilling%2Fcancelled');
    });

    test('returns disabled provider when API key missing', () => {
      delete process.env.PAXUM_API_KEY;

      const provider = makePaxum();
      expect(provider.enabled).toBe(false);
      expect(provider.name).toBe('paxum');
    });

    test('throws error when disabled provider used', async () => {
      delete process.env.PAXUM_API_KEY;

      const provider = makePaxum();
      await expect(provider.createCheckout({
        userId: 'user123',
        planId: 'pro'
      })).rejects.toThrow('Payment provider "paxum" is disabled (missing secrets).');
    });

    test('handles zero amount correctly', async () => {
      process.env.PAXUM_API_KEY = 'test_merchant';
      process.env.APP_BASE_URL = 'https://test.com';

      const provider = makePaxum();
      const result = await provider.createCheckout({
        userId: 'user123',
        planId: 'free',
        amountCents: 0
      });

      expect(result.url).toContain('amount=0.00');
    });
  });

  describe('Coinbase Provider', () => {
    test('creates checkout with valid API key', async () => {
      process.env.COINBASE_COMMERCE_KEY = 'test_coinbase_key';
      process.env.APP_BASE_URL = 'https://test.com';

      // Mock fetch for this test
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        json: async () => ({
          data: {
            hosted_url: 'https://commerce.coinbase.com/checkout/test123'
          }
        })
      } as Response);

      const provider = makeCoinbase();
      expect(provider.enabled).toBe(true);
      expect(provider.name).toBe('coinbase');

      const result = await provider.createCheckout({
        userId: 'user456',
        planId: 'pro',
        amountCents: 4999,
        returnUrl: 'https://test.com/success'
      });

      expect(result.url).toBe('https://commerce.coinbase.com/checkout/test123');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('handles API errors properly', async () => {
      process.env.COINBASE_COMMERCE_KEY = 'invalid_key';
      process.env.APP_BASE_URL = 'https://test.com';

      // Mock fetch to return error
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: false,
        status: 401
      } as Response);

      const provider = makeCoinbase();
      await expect(provider.createCheckout({
        userId: 'user456',
        planId: 'pro'
      })).rejects.toThrow('Failed to create Coinbase Commerce checkout session');

      // Restore original fetch
      global.fetch = originalFetch;
    });

    test('returns disabled provider when API key missing', () => {
      delete process.env.COINBASE_COMMERCE_KEY;

      const provider = makeCoinbase();
      expect(provider.enabled).toBe(false);
      expect(provider.name).toBe('coinbase');
    });

    test('throws error when disabled provider used', async () => {
      delete process.env.COINBASE_COMMERCE_KEY;

      const provider = makeCoinbase();
      await expect(provider.createCheckout({
        userId: 'user456',
        planId: 'pro'
      })).rejects.toThrow('Payment provider "coinbase" is disabled (missing secrets).');
    });

    test('formats amount correctly for API', async () => {
      process.env.COINBASE_COMMERCE_KEY = 'test_key';
      process.env.APP_BASE_URL = 'https://test.com';

      let capturedBody: unknown;
      const originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        capturedBody = JSON.parse(options?.body as string);
        return {
          ok: true,
          json: async () => ({
            data: { hosted_url: 'https://commerce.coinbase.com/checkout/test' }
          })
        } as Response;
      };

      const provider = makeCoinbase();
      await provider.createCheckout({
        userId: 'user456',
        planId: 'pro',
        amountCents: 2999
      });

      expect((capturedBody as { local_price: { amount: string } }).local_price.amount).toBe('29.99');
      expect((capturedBody as { local_price: { currency: string } }).local_price.currency).toBe('USD');
      expect((capturedBody as { metadata: { user_id: string } }).metadata.user_id).toBe('user456');
      expect((capturedBody as { metadata: { plan_id: string } }).metadata.plan_id).toBe('pro');

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  // New edge case tests for malformed data and network errors
  describe('Edge Cases and Error Handling', () => {
    describe('Malformed Data', () => {
      test('handles extremely large amounts gracefully', async () => {
        process.env.PAXUM_API_KEY = 'test_merchant';
        process.env.APP_BASE_URL = 'https://test.com';

        const provider = makePaxum();
        const result = await provider.createCheckout({
          userId: 'user123',
          planId: 'enterprise',
          amountCents: 99999999999 // $999,999,999.99
        });

        expect(result.url).toContain('amount=999999999.99');
      });

      test('handles negative amounts by converting to zero', async () => {
        process.env.PAXUM_API_KEY = 'test_merchant';
        process.env.APP_BASE_URL = 'https://test.com';

        const provider = makePaxum();
        const result = await provider.createCheckout({
          userId: 'user123',
          planId: 'invalid',
          amountCents: -1000 // Negative amount
        });

        expect(result.url).toContain('amount=0.00');
      });

      test('handles special characters in user ID and plan ID', async () => {
        process.env.PAXUM_API_KEY = 'test_merchant';
        process.env.APP_BASE_URL = 'https://test.com';

        const provider = makePaxum();
        const result = await provider.createCheckout({
          userId: 'user@123!#$%',
          planId: 'plan-with-special_chars.test'
        });

        expect(result.url).toContain('custom=user%40123%21%23%24%25');
        expect(result.url).toContain('button_id=plan-with-special_chars.test');
      });

      test('handles missing or invalid base URL', () => {
        process.env.PAXUM_API_KEY = 'test_merchant';
        delete process.env.APP_BASE_URL;

        try {
          makePaxum();
          expect(process.env.APP_BASE_URL).toBeDefined();
        } catch (e) {
          expect(e.message).toContain('APP_BASE_URL');
        }
      });
    });

    describe('Network Errors and API Failures', () => {
      test('handles network timeout for Coinbase', async () => {
        process.env.COINBASE_COMMERCE_KEY = 'test_key';
        process.env.APP_BASE_URL = 'https://test.com';

        // Mock fetch to simulate network timeout
        const originalFetch = global.fetch;
        global.fetch = async () => {
          await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
          throw new Error('Network timeout');
        };

        const provider = makeCoinbase();
        await expect(provider.createCheckout({
          userId: 'user456',
          planId: 'pro'
        })).rejects.toThrow('Network timeout');

        global.fetch = originalFetch;
      });

      test('handles malformed JSON response from Coinbase', async () => {
        process.env.COINBASE_COMMERCE_KEY = 'test_key';
        process.env.APP_BASE_URL = 'https://test.com';

        const originalFetch = global.fetch;
        global.fetch = async () => ({
          ok: true,
          json: async () => {
            throw new Error('Unexpected end of JSON input');
          }
        } as unknown as Response);

        const provider = makeCoinbase();
        await expect(provider.createCheckout({
          userId: 'user456',
          planId: 'pro'
        })).rejects.toThrow('Unexpected end of JSON input');

        global.fetch = originalFetch;
      });

      test('handles missing hosted_url in Coinbase response', async () => {
        process.env.COINBASE_COMMERCE_KEY = 'test_key';
        process.env.APP_BASE_URL = 'https://test.com';

        const originalFetch = global.fetch;
        global.fetch = async () => ({
          ok: true,
          json: async () => ({
            data: {
              // Missing hosted_url
              id: 'checkout_123',
              status: 'created'
            }
          })
        } as Response);

        const provider = makeCoinbase();
        await expect(provider.createCheckout({
          userId: 'user456',
          planId: 'pro'
        })).rejects.toThrow('Invalid response from Coinbase Commerce API');

        global.fetch = originalFetch;
      });

      test('handles rate limiting responses', async () => {
        process.env.COINBASE_COMMERCE_KEY = 'test_key';
        process.env.APP_BASE_URL = 'https://test.com';

        const originalFetch = global.fetch;
        global.fetch = async () => ({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        } as Response);

        const provider = makeCoinbase();
        await expect(provider.createCheckout({
          userId: 'user456',
          planId: 'pro'
        })).rejects.toThrow('Failed to create Coinbase Commerce checkout session');

        global.fetch = originalFetch;
      });
    });

    describe('Input Validation', () => {
      test('validates required fields for Paxum', () => {
        process.env.PAXUM_API_KEY = 'test_merchant';
        process.env.APP_BASE_URL = 'https://test.com';

        const provider = makePaxum();
        
        // Test with missing userId
        expect(provider.createCheckout({
          userId: '',
          planId: 'pro'
        } as { userId: string; planId: string })).rejects.toThrow();

        // Test with missing planId
        expect(provider.createCheckout({
          userId: 'user123',
          planId: ''
        } as { userId: string; planId: string })).rejects.toThrow();
      });

      test('validates amount ranges for Coinbase', async () => {
        process.env.COINBASE_COMMERCE_KEY = 'test_key';
        process.env.APP_BASE_URL = 'https://test.com';

        const originalFetch = global.fetch;
        global.fetch = async () => ({
          ok: true,
          json: async () => ({
            data: { hosted_url: 'https://commerce.coinbase.com/checkout/test' }
          })
        } as Response);

        const provider = makeCoinbase();
        
        // Test with very small amount (should work)
        await expect(provider.createCheckout({
          userId: 'user123',
          planId: 'micro',
          amountCents: 1 // $0.01
        })).resolves.toMatchObject({
          url: 'https://commerce.coinbase.com/checkout/test'
        });

        global.fetch = originalFetch;
      });
    });
  });

  describe('Provider Array Export', () => {
    test('filters out disabled providers', async () => {
      delete process.env.PAXUM_API_KEY;
      delete process.env.COINBASE_COMMERCE_KEY;
      delete process.env.STRIPE_SECRET_KEY;

      // Re-import to get fresh providers array
      vi.resetModules();
      const { providers } = await import('../../server/payments/payment-providers.js');
      
      expect(providers).toHaveLength(0);
      expect(providers.every((p: { enabled: boolean }) => p.enabled)).toBe(true);
    });

    test('includes enabled providers', async () => {
      process.env.PAXUM_API_KEY = 'test_paxum';
      process.env.COINBASE_COMMERCE_KEY = 'test_coinbase';

      // Re-import to get fresh providers array
      vi.resetModules();
      const { providers } = await import('../../server/payments/payment-providers.js');
      
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.every((p: { enabled: boolean }) => p.enabled)).toBe(true);
    });
  });

  describe('Stripe Provider', () => {
    test('creates checkout URL with valid secret key', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      process.env.APP_BASE_URL = 'https://test.com';

      const provider = makeStripe();
      expect(provider.enabled).toBe(true);
      expect(provider.name).toBe('stripe');

      const result = await provider.createCheckout({
        userId: 'user123',
        planId: 'pro',
        amountCents: 2999,
        returnUrl: 'https://test.com/success'
      });

      expect(result.url).toContain('https://test.com/api/billing/checkout');
      expect(result.url).toContain('userId=user123');
      expect(result.url).toContain('planId=pro');
      expect(result.url).toContain('amount=2999');
      expect(result.url).toContain('returnUrl=https%3A%2F%2Ftest.com%2Fsuccess');
    });

    test('uses default return URL when none provided', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_456';
      process.env.APP_BASE_URL = 'https://thottopilot.com';

      const provider = makeStripe();
      const result = await provider.createCheckout({
        userId: 'user123',
        planId: 'basic'
      });

      expect(result.url).toContain('returnUrl=https%3A%2F%2Fthottopilot.com%2Fbilling%2Fsuccess');
    });

    test('returns disabled provider when secret key missing', () => {
      delete process.env.STRIPE_SECRET_KEY;

      const provider = makeStripe();
      expect(provider.enabled).toBe(false);
      expect(provider.name).toBe('stripe');
    });

    test('throws error when disabled provider used', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const provider = makeStripe();
      await expect(provider.createCheckout({
        userId: 'user123',
        planId: 'pro'
      })).rejects.toThrow('Payment provider "stripe" is disabled (missing secrets).');
    });

    test('validates required parameters', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_789';
      process.env.APP_BASE_URL = 'https://test.com';

      const provider = makeStripe();
      
      await expect(provider.createCheckout({
        userId: '',
        planId: 'pro'
      })).rejects.toThrow('userId and planId are required');

      await expect(provider.createCheckout({
        userId: 'user123',
        planId: ''
      })).rejects.toThrow('userId and planId are required');
    });
  });
});