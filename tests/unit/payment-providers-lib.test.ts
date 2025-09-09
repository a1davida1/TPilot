import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaxumProvider, CoinbaseProvider } from '../../server/lib/payment-providers';
import crypto from 'crypto';

describe('lib payment providers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('PaxumProvider generates link via API', async () => {
    const provider = new PaxumProvider();
    vi.spyOn(provider, 'isConfigured', 'get').mockReturnValue(true);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ url: 'https://pay', transactionId: '1' }) });
    const res = await provider.generatePaymentLink({ amount: 10, currency: 'USD', description: 'desc', userId: 1 });
    expect(res.success).toBe(true);
    expect(fetch).toHaveBeenCalled();
  });

  it('CoinbaseProvider verifies webhook signature', async () => {
    const provider = new CoinbaseProvider();
    const payload = { a: 1 };
    const sig = crypto.createHmac('sha256', '').update(JSON.stringify(payload)).digest('hex');
    expect(await provider.verifyWebhook(sig, payload)).toBe(true);
  });
});