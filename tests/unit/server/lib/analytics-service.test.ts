/**
 * Unit tests for analytics-service.ts
 * Tests real database queries, caching, and metric calculations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getUserSubredditMetrics,
  getGlobalSubredditMetrics,
  detectPeakHours,
  getPerformanceAnalytics,
  getBestDayOfWeek
} from '../../../../server/lib/analytics-service';

// Mock dependencies
vi.mock('../../../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
}));

vi.mock('../../../../server/lib/cache', () => ({
  cacheGetOrSet: vi.fn((key, generator, ttl) => generator()),
  CACHE_KEYS: {
    USER_SUBREDDIT_METRICS: (userId: number, subreddit: string) => 
      `analytics:user:${userId}:sub:${subreddit}:metrics`,
    GLOBAL_SUBREDDIT_METRICS: (subreddit: string) => 
      `analytics:global:sub:${subreddit}:metrics`,
    SUBREDDIT_PEAK_HOURS: (subreddit: string) => 
      `analytics:sub:${subreddit}:peak-hours`,
  },
  CACHE_TTL: {
    ONE_HOUR: 3600,
    SIX_HOURS: 21600,
  }
}));

describe('analytics-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserSubredditMetrics', () => {
    it('should return metrics for user with post history', async () => {
      const { db } = await import('../../../../server/db');
      
      // Mock postMetrics query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 247,
          avgComments: 18,
          totalPosts: 45,
          maxScore: 500,
          minScore: 50
        }])
      } as any);

      // Mock reddit_post_outcomes query
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          totalAttempts: 45,
          successfulPosts: 42
        }])
      } as any);

      // Mock recent metrics for trending
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 280
        }])
      } as any);

      // Mock older metrics for trending
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 240
        }])
      } as any);

      const result = await getUserSubredditMetrics(123, 'gonewild');

      expect(result.avgUpvotes).toBe(247);
      expect(result.avgComments).toBe(18);
      expect(result.totalPosts).toBe(45);
      expect(result.successRate).toBeCloseTo(0.93, 2);
      expect(result.trending).toBe('up');
      expect(result.trendPercent).toBeGreaterThan(10);
    });

    it('should handle user with no posts', async () => {
      const { db } = await import('../../../../server/db');
      
      // Mock empty results
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          avgScore: 0,
          avgComments: 0,
          totalPosts: 0,
          maxScore: 0,
          minScore: 0
        }])
      } as any);

      const result = await getUserSubredditMetrics(456, 'test');

      expect(result.avgUpvotes).toBe(0);
      expect(result.avgComments).toBe(0);
      expect(result.totalPosts).toBe(0);
      expect(result.successRate).toBe(0);
    });

    it('should calculate trending as stable when change is small', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 100,
          avgComments: 10,
          totalPosts: 20,
          maxScore: 150,
          minScore: 50
        }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          totalAttempts: 20,
          successfulPosts: 18
        }])
      } as any);

      // Recent = 105, Older = 100 (5% change = stable)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ avgScore: 105 }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ avgScore: 100 }])
      } as any);

      const result = await getUserSubredditMetrics(123, 'test');

      expect(result.trending).toBe('stable');
      expect(result.trendPercent).toBeLessThanOrEqual(10);
    });

    it('should calculate trending as down when declining', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 100,
          avgComments: 10,
          totalPosts: 20,
          maxScore: 150,
          minScore: 50
        }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          totalAttempts: 20,
          successfulPosts: 18
        }])
      } as any);

      // Recent = 70, Older = 100 (-30% = down)
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ avgScore: 70 }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ avgScore: 100 }])
      } as any);

      const result = await getUserSubredditMetrics(123, 'test');

      expect(result.trending).toBe('down');
      expect(result.trendPercent).toBeLessThan(-10);
    });
  });

  describe('getGlobalSubredditMetrics', () => {
    it('should return platform-wide metrics', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 318,
          avgComments: 25,
          totalPosts: 12543,
          p50Score: 200,
          p75Score: 350,
          p90Score: 500
        }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          totalAttempts: 15000,
          successfulPosts: 11250
        }])
      } as any);

      const result = await getGlobalSubredditMetrics('gonewild');

      expect(result.avgUpvotes).toBe(318);
      expect(result.avgComments).toBe(25);
      expect(result.totalPosts).toBe(12543);
      expect(result.successRate).toBeCloseTo(0.75, 2);
    });

    it('should handle subreddits with no data', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          avgScore: 0,
          avgComments: 0,
          totalPosts: 0,
          p50Score: 0,
          p75Score: 0,
          p90Score: 0
        }])
      } as any);

      const result = await getGlobalSubredditMetrics('newsubreddit');

      expect(result.avgUpvotes).toBe(0);
      expect(result.totalPosts).toBe(0);
    });
  });

  describe('detectPeakHours', () => {
    it('should identify peak hours from data', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValueOnce([
          { hour: 20, avgScore: 450, postCount: 30 },
          { hour: 21, avgScore: 420, postCount: 35 },
          { hour: 22, avgScore: 400, postCount: 32 },
          { hour: 23, avgScore: 380, postCount: 28 },
          { hour: 19, avgScore: 350, postCount: 25 },
          { hour: 18, avgScore: 320, postCount: 20 },
          { hour: 0, avgScore: 300, postCount: 18 }
        ])
      } as any);

      const result = await detectPeakHours('gonewild', 123);

      expect(result.peakHours).toContain(20);
      expect(result.peakHours).toContain(21);
      expect(result.peakHours).toContain(22);
      expect(result.peakHours.length).toBeLessThanOrEqual(6);
      expect(result.confidence).toBe('high');
      expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('should assign high confidence with 50+ posts', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValueOnce([
          { hour: 20, avgScore: 450, postCount: 60 }
        ])
      } as any);

      const result = await detectPeakHours('test', 123);

      expect(result.confidence).toBe('high');
      expect(result.sampleSize).toBe(60);
    });

    it('should assign medium confidence with 20-49 posts', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValueOnce([
          { hour: 20, avgScore: 450, postCount: 30 }
        ])
      } as any);

      const result = await detectPeakHours('test', 123);

      expect(result.confidence).toBe('medium');
    });

    it('should assign low confidence with <20 posts', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValueOnce([
          { hour: 20, avgScore: 450, postCount: 10 }
        ])
      } as any);

      const result = await detectPeakHours('test', 123);

      expect(result.confidence).toBe('low');
    });

    it('should default to evening hours with no data', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValueOnce([])
      } as any);

      const result = await detectPeakHours('newsubreddit');

      expect(result.peakHours).toEqual([19, 20, 21, 22]);
      expect(result.confidence).toBe('low');
      expect(result.sampleSize).toBe(0);
    });
  });

  describe('getPerformanceAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      const { db } = await import('../../../../server/db');
      
      // Mock all necessary queries
      const mockUserMetrics = {
        avgUpvotes: 247,
        avgComments: 18,
        successRate: 0.92,
        totalPosts: 45,
        trending: 'up' as const,
        trendPercent: 15
      };

      const mockGlobalMetrics = {
        avgUpvotes: 318,
        avgComments: 25,
        successRate: 0.75,
        totalPosts: 12543
      };

      const mockPeakHours = {
        subreddit: 'gonewild',
        peakHours: [20, 21, 22, 23],
        hourlyScores: { 20: 450, 21: 420, 22: 400, 23: 380 },
        confidence: 'high' as const,
        sampleSize: 127
      };

      // Mock getUserSubredditMetrics
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 247,
          avgComments: 18,
          totalPosts: 45,
          maxScore: 500,
          minScore: 50
        }])
      } as any);

      const result = await getPerformanceAnalytics(123, 'gonewild');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('global');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('last30Days');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should generate recommendations based on metrics', async () => {
      const { db } = await import('../../../../server/db');
      
      // Mock low success rate scenario
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          avgScore: 50,
          avgComments: 5,
          totalPosts: 10,
          maxScore: 100,
          minScore: 10,
          totalAttempts: 15,
          successfulPosts: 8,
          avgScore: 50
        }])
      } as any);

      const result = await getPerformanceAnalytics(123, 'test');

      // Should recommend reviewing rules due to low success rate
      const hasRuleRecommendation = result.recommendations.some(r => 
        r.toLowerCase().includes('success rate') || r.toLowerCase().includes('rules')
      );
      expect(hasRuleRecommendation).toBe(true);
    });
  });

  describe('getBestDayOfWeek', () => {
    it('should return day with highest average score', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([
          { dayOfWeek: 5, avgScore: 450 } // Friday
        ])
      } as any);

      const result = await getBestDayOfWeek(123, 'gonewild');

      expect(result).toBe('Friday');
    });

    it('should default to Friday with no data', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([])
      } as any);

      const result = await getBestDayOfWeek(456, 'test');

      expect(result).toBe('Friday');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null/undefined values in queries', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{
          avgScore: null,
          avgComments: null,
          totalPosts: null
        }])
      } as any);

      const result = await getUserSubredditMetrics(123, 'test');

      expect(result.avgUpvotes).toBe(0);
      expect(result.avgComments).toBe(0);
      expect(result.totalPosts).toBe(0);
    });

    it('should handle division by zero in success rate', async () => {
      const { db } = await import('../../../../server/db');
      
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          avgScore: 100,
          avgComments: 10,
          totalPosts: 10
        }])
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{
          totalAttempts: 0,
          successfulPosts: 0
        }])
      } as any);

      const result = await getUserSubredditMetrics(123, 'test');

      expect(result.successRate).toBe(0);
      expect(isNaN(result.successRate)).toBe(false);
    });
  });
});
