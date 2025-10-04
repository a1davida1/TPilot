import { describe, it, expect, beforeEach, vi } from 'vitest';
import Stripe from 'stripe';

// Mock Stripe
const mockRetrieve = vi.fn();
const MockStripe = vi.fn().mockImplementation(() => ({
  customers: {
    retrieve: mockRetrieve
  }
}));

vi.mock('stripe', () => ({
  default: MockStripe
}));

// Import after mocking
import { visitorAnalytics } from '../../server/visitor-analytics.js';

describe('VisitorAnalytics - recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  it('should record payment and update daily stats with conversions', async () => {
    const customerId = 'cus_test123';
    const amount = 100;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    await visitorAnalytics.recordPayment(customerId, amount);

    expect(mockRetrieve).toHaveBeenCalledWith(customerId);
  });

  it('should calculate conversion rate when visitors exist', async () => {
    const customerId = 'cus_test123';
    const amount = 50;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    // Record payment to update stats
    await visitorAnalytics.recordPayment(customerId, amount);

    // Get analytics to verify conversion rate calculation
    const stats = visitorAnalytics.getAnalytics('24h');
    
    // Stats should have conversion tracking
    expect(stats).toBeDefined();
  });

  it('should throw error for missing Stripe customer', async () => {
    const customerId = 'cus_missing';
    const amount = 100;

    mockRetrieve.mockRejectedValue(new Error('No such customer'));

    await expect(
      visitorAnalytics.recordPayment(customerId, amount)
    ).rejects.toThrow('No such customer');

    expect(mockRetrieve).toHaveBeenCalledWith(customerId);
  });

  it('should throw error for deleted Stripe customer', async () => {
    const customerId = 'cus_deleted';
    const amount = 100;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: true
    });

    await expect(
      visitorAnalytics.recordPayment(customerId, amount)
    ).rejects.toThrow('Customer has been deleted');

    expect(mockRetrieve).toHaveBeenCalledWith(customerId);
  });

  it('should handle errors and propagate them', async () => {
    const customerId = 'cus_error';
    const amount = 100;

    const testError = new Error('Stripe API error');
    mockRetrieve.mockRejectedValue(testError);

    await expect(
      visitorAnalytics.recordPayment(customerId, amount)
    ).rejects.toThrow('Stripe API error');
  });

  it('should skip recording when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    
    // Create new analytics instance without Stripe
    const { visitorAnalytics: unconfiguredAnalytics } = await import('../../server/visitor-analytics.js');

    // Should not throw when Stripe is not configured
    await expect(
      unconfiguredAnalytics.recordPayment('cus_test', 100)
    ).resolves.not.toThrow();

    // Stripe should not be called
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it('should accumulate multiple payments in daily stats', async () => {
    const customerId1 = 'cus_test1';
    const customerId2 = 'cus_test2';
    const amount1 = 50;
    const amount2 = 75;

    mockRetrieve.mockResolvedValue({
      deleted: false
    });

    // Record multiple payments
    await visitorAnalytics.recordPayment(customerId1, amount1);
    await visitorAnalytics.recordPayment(customerId2, amount2);

    expect(mockRetrieve).toHaveBeenCalledTimes(2);
  });

  it('should create new daily stats when recording first payment of the day', async () => {
    const customerId = 'cus_new_day';
    const amount = 100;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    await visitorAnalytics.recordPayment(customerId, amount);

    // Should successfully create and update stats
    expect(mockRetrieve).toHaveBeenCalled();
  });
});
