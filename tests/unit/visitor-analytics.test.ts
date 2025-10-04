import { describe, it, expect, beforeEach, vi } from 'vitest';
import Stripe from 'stripe';

// Mock Stripe with vi.hoisted to avoid TDZ issues
const { mockRetrieve, MockStripe } = vi.hoisted(() => {
  const mockRetrieve = vi.fn();
  const MockStripe = vi.fn().mockImplementation(() => ({
    customers: {
      retrieve: mockRetrieve
    }
  }));
  return { mockRetrieve, MockStripe };
});

vi.mock('stripe', () => ({
  default: MockStripe
}));

// Import after mocking
import { visitorAnalytics } from '../../server/visitor-analytics.js';

describe('VisitorAnalytics - recordPayment', () => {
  const today = new Date().toISOString().split('T')[0];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    
    // Clear daily stats before each test
    const dailyStatsMap = (visitorAnalytics as { dailyStats: Map<string, unknown> }).dailyStats;
    if (dailyStatsMap) {
      dailyStatsMap.clear();
    }
  });

  it('should record payment and increment conversions in daily stats', async () => {
    const customerId = 'cus_test123';
    const amount = 100;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    await visitorAnalytics.recordPayment(customerId, amount);

    expect(mockRetrieve).toHaveBeenCalledWith(customerId);
    
    // Verify daily stats were updated with conversion data
    const stats = visitorAnalytics.getDailyStats(today);
    expect(stats).toBeDefined();
    expect(stats?.conversions).toBe(1);
    expect(stats?.totalRevenue).toBe(amount);
  });

  it('should accumulate multiple payments correctly', async () => {
    const customerId1 = 'cus_test1';
    const customerId2 = 'cus_test2';
    const amount1 = 50;
    const amount2 = 75;

    mockRetrieve.mockResolvedValue({
      deleted: false
    });

    // Record first payment
    await visitorAnalytics.recordPayment(customerId1, amount1);
    
    const stats1 = visitorAnalytics.getDailyStats(today);
    expect(stats1?.conversions).toBe(1);
    expect(stats1?.totalRevenue).toBe(amount1);

    // Record second payment
    await visitorAnalytics.recordPayment(customerId2, amount2);
    
    const stats2 = visitorAnalytics.getDailyStats(today);
    expect(stats2?.conversions).toBe(2);
    expect(stats2?.totalRevenue).toBe(amount1 + amount2);
  });

  it('should calculate conversion rate when unique visitors exist', async () => {
    const customerId = 'cus_test123';
    const amount = 50;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    // Simulate some unique visitors
    const stats = visitorAnalytics.getDailyStats(today) || {
      totalVisitors: 0,
      uniqueVisitors: 100,
      pageViews: 0,
      averageSessionDuration: 0,
      bounceRate: 0,
      topPages: [],
      trafficSources: [],
      hourlyTraffic: [],
      conversionRate: 0
    };
    
    // Set stats with unique visitors
    const dailyStatsMap = (visitorAnalytics as { dailyStats: Map<string, unknown> }).dailyStats;
    dailyStatsMap.set(today, stats);

    // Record payment
    await visitorAnalytics.recordPayment(customerId, amount);

    const updatedStats = visitorAnalytics.getDailyStats(today);
    expect(updatedStats?.conversions).toBe(1);
    expect(updatedStats?.totalRevenue).toBe(amount);
    expect(updatedStats?.conversionRate).toBe(1); // 1/100 * 100 = 1%
  });

  it('should throw error for missing Stripe customer', async () => {
    const customerId = 'cus_missing';
    const amount = 100;

    mockRetrieve.mockRejectedValue(new Error('No such customer'));

    await expect(
      visitorAnalytics.recordPayment(customerId, amount)
    ).rejects.toThrow('No such customer');

    expect(mockRetrieve).toHaveBeenCalledWith(customerId);
    
    // Verify no conversion was recorded
    const stats = visitorAnalytics.getDailyStats(today);
    expect(stats?.conversions).toBeUndefined();
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
    
    // Verify no conversion was recorded
    const stats = visitorAnalytics.getDailyStats(today);
    expect(stats?.conversions).toBeUndefined();
  });

  it('should handle errors and propagate them without recording conversion', async () => {
    const customerId = 'cus_error';
    const amount = 100;

    const testError = new Error('Stripe API error');
    mockRetrieve.mockRejectedValue(testError);

    await expect(
      visitorAnalytics.recordPayment(customerId, amount)
    ).rejects.toThrow('Stripe API error');
    
    // Verify no conversion was recorded
    const stats = visitorAnalytics.getDailyStats(today);
    expect(stats?.conversions).toBeUndefined();
    expect(stats?.totalRevenue).toBeUndefined();
  });

  it('should skip recording when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    
    // Force reimport to get unconfigured instance
    vi.resetModules();
    const { visitorAnalytics: unconfiguredAnalytics } = await import('../../server/visitor-analytics.js');

    // Should not throw when Stripe is not configured
    await expect(
      unconfiguredAnalytics.recordPayment('cus_test', 100)
    ).resolves.not.toThrow();

    // Stripe should not be called
    expect(mockRetrieve).not.toHaveBeenCalled();
    
    // No conversion should be recorded
    const stats = unconfiguredAnalytics.getDailyStats(today);
    expect(stats?.conversions).toBeUndefined();
  });

  it('should create new daily stats when recording first payment of the day', async () => {
    const customerId = 'cus_new_day';
    const amount = 100;

    mockRetrieve.mockResolvedValue({
      id: customerId,
      deleted: false
    });

    // Ensure no stats exist initially
    expect(visitorAnalytics.getDailyStats(today)).toBeUndefined();

    await visitorAnalytics.recordPayment(customerId, amount);

    // Verify stats were created
    const stats = visitorAnalytics.getDailyStats(today);
    expect(stats).toBeDefined();
    expect(stats?.conversions).toBe(1);
    expect(stats?.totalRevenue).toBe(amount);
    expect(stats?.uniqueVisitors).toBe(0);
    expect(stats?.conversionRate).toBe(0);
  });
});
