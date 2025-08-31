import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { makePaxum, makeCoinbase } from '../../server/payments/payment-providers';

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
      expect(result.url).toContain('cancel_url=https://thottopilot.com/billing/cancelled');
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
        planId: 'premium',
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
        planId: 'premium'
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
        planId: 'premium'
      })).rejects.toThrow('Payment provider "coinbase" is disabled (missing secrets).');
    });

    test('formats amount correctly for API', async () => {
      process.env.COINBASE_COMMERCE_KEY = 'test_key';
      process.env.APP_BASE_URL = 'https://test.com';

      let capturedBody: any;
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

      expect(capturedBody.local_price.amount).toBe('29.99');
      expect(capturedBody.local_price.currency).toBe('USD');
      expect(capturedBody.metadata.user_id).toBe('user456');
      expect(capturedBody.metadata.plan_id).toBe('pro');

      // Restore original fetch
      global.fetch = originalFetch;
    });
  });

  describe('Provider Array Export', () => {
    test('filters out disabled providers', () => {
      delete process.env.PAXUM_API_KEY;
      delete process.env.COINBASE_COMMERCE_KEY;

      // Re-import to get fresh providers array
      const { providers } = require('../../server/payments/payment-providers');
      
      expect(providers).toHaveLength(0);
      expect(providers.every((p: any) => p.enabled)).toBe(true);
    });

    test('includes enabled providers', () => {
      process.env.PAXUM_API_KEY = 'test_paxum';
      process.env.COINBASE_COMMERCE_KEY = 'test_coinbase';

      // Re-import to get fresh providers array
      const { providers } = require('../../server/payments/payment-providers');
      
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.every((p: any) => p.enabled)).toBe(true);
    });
  });
});