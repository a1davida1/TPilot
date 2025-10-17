/**
 * Integration tests for analytics-performance API endpoints
 * Tests authentication, validation, and full request/response cycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import analyticsPerformanceRouter from '../../server/routes/analytics-performance';

// Mock analytics service
vi.mock('../../server/lib/analytics-service', () => ({
  getPerformanceAnalytics: vi.fn().mockResolvedValue({
    user: {
      avgUpvotes: 247,
      avgComments: 18,
      successRate: 0.92,
      totalPosts: 45,
      trending: 'up',
      trendPercent: 15,
      bestHours: [20, 21, 22, 23],
      bestDay: 'Friday',
      vsGlobal: {
        percentile: 78,
        betterThan: '78% of users'
      }
    },
    global: {
      avgUpvotes: 318,
      avgComments: 25,
      successRate: 0.75,
      totalPosts: 12543
    },
    recommendations: [
      'Great job! Engagement up 15%',
      'Best times to post: 20:00, 21:00, 22:00, 23:00'
    ],
    last30Days: {
      posts: 45,
      totalUpvotes: 11115,
      totalComments: 810,
      growth: '+12%'
    }
  }),
  getUserSubredditMetrics: vi.fn().mockResolvedValue({
    avgUpvotes: 247,
    avgComments: 18,
    successRate: 0.92,
    totalPosts: 45
  }),
  getGlobalSubredditMetrics: vi.fn().mockResolvedValue({
    avgUpvotes: 318,
    avgComments: 25,
    successRate: 0.75,
    totalPosts: 12543
  }),
  detectPeakHours: vi.fn().mockResolvedValue({
    subreddit: 'gonewild',
    peakHours: [20, 21, 22, 23],
    hourlyScores: { 20: 450, 21: 420, 22: 400, 23: 380 },
    confidence: 'high',
    sampleSize: 127
  }),
  getBestDayOfWeek: vi.fn().mockResolvedValue('Friday')
}));

// Mock authentication middleware
vi.mock('../../server/middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 123, tier: 'pro' };
    next();
  }
}));

// Mock logger
vi.mock('../../server/bootstrap/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

describe('Analytics Performance API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsPerformanceRouter);
    vi.clearAllMocks();
  });

  describe('GET /api/analytics/performance', () => {
    it('should return performance analytics for authenticated user', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .query({ subreddit: 'gonewild', userId: 123 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('global');
      expect(response.body.data).toHaveProperty('recommendations');
      expect(response.body.data).toHaveProperty('last30Days');
    });

    it('should validate subreddit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .query({ userId: 123 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
    });

    it('should use authenticated user ID if not provided', async () => {
      const response = await request(app)
        .get('/api/analytics/performance')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should return 401 without user ID', async () => {
      // Override auth mock for this test
      const authlessApp = express();
      authlessApp.use(express.json());
      authlessApp.use((req, res, next) => {
        req.user = undefined;
        next();
      });
      authlessApp.use('/api/analytics', analyticsPerformanceRouter);

      const response = await request(authlessApp)
        .get('/api/analytics/performance')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('User ID required');
    });

    it('should handle service errors gracefully', async () => {
      const { getPerformanceAnalytics } = await import('../../server/lib/analytics-service');
      vi.mocked(getPerformanceAnalytics).mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/performance')
        .query({ subreddit: 'gonewild', userId: 123 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to fetch analytics');
    });
  });

  describe('GET /api/analytics/metrics', () => {
    it('should return user metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({ subreddit: 'gonewild', scope: 'user' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.scope).toBe('user');
      expect(response.body.data).toHaveProperty('avgUpvotes');
      expect(response.body.data).toHaveProperty('successRate');
    });

    it('should return global metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({ subreddit: 'gonewild', scope: 'global' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.scope).toBe('global');
      expect(response.body.data).toHaveProperty('avgUpvotes');
      expect(response.body.data).toHaveProperty('totalPosts');
    });

    it('should require subreddit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({ scope: 'user' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Subreddit parameter required');
    });

    it('should default to user scope', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(200);
      expect(response.body.scope).toBe('user');
    });
  });

  describe('GET /api/analytics/peak-hours', () => {
    it('should return peak hours for subreddit', async () => {
      const response = await request(app)
        .get('/api/analytics/peak-hours')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('peakHours');
      expect(response.body.data).toHaveProperty('hourlyScores');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('sampleSize');
      expect(Array.isArray(response.body.data.peakHours)).toBe(true);
    });

    it('should require subreddit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/peak-hours');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Subreddit parameter required');
    });

    it('should include userId if authenticated', async () => {
      const { detectPeakHours } = await import('../../server/lib/analytics-service');
      
      await request(app)
        .get('/api/analytics/peak-hours')
        .query({ subreddit: 'gonewild' });

      expect(detectPeakHours).toHaveBeenCalledWith('gonewild', 123);
    });
  });

  describe('GET /api/analytics/best-day', () => {
    it('should return best day of week', async () => {
      const response = await request(app)
        .get('/api/analytics/best-day')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('bestDay');
      expect(response.body.data).toHaveProperty('subreddit');
      expect(typeof response.body.data.bestDay).toBe('string');
    });

    it('should require subreddit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/best-day');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Subreddit parameter required');
    });

    it('should require authentication', async () => {
      const authlessApp = express();
      authlessApp.use(express.json());
      authlessApp.use((req, res, next) => {
        req.user = undefined;
        next();
      });
      authlessApp.use('/api/analytics', analyticsPerformanceRouter);

      const response = await request(authlessApp)
        .get('/api/analytics/best-day')
        .query({ subreddit: 'gonewild' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should return dashboard for multiple subreddits', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .query({ subreddits: 'gonewild,RealGirls' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('subredditsAnalyzed');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should default to common subreddits if none provided', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should handle comma-separated subreddit list', async () => {
      const response = await request(app)
        .get('/api/analytics/dashboard')
        .query({ subreddits: 'gonewild,RealGirls,PetiteGoneWild' });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter out failed subreddit requests', async () => {
      const { getPerformanceAnalytics } = await import('../../server/lib/analytics-service');
      
      // Make one fail
      vi.mocked(getPerformanceAnalytics)
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('Failed'));

      const response = await request(app)
        .get('/api/analytics/dashboard')
        .query({ subreddits: 'gonewild,RealGirls' });

      expect(response.status).toBe(200);
      // Should still return successful ones
      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      const authlessApp = express();
      authlessApp.use(express.json());
      authlessApp.use((req, res, next) => {
        req.user = undefined;
        next();
      });
      authlessApp.use('/api/analytics', analyticsPerformanceRouter);

      const response = await request(authlessApp)
        .get('/api/analytics/dashboard');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed subreddit names', async () => {
      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({ subreddit: '' });

      expect(response.status).toBe(400);
    });

    it('should log errors appropriately', async () => {
      const { logger } = await import('../../server/bootstrap/logger');
      const { getPerformanceAnalytics } = await import('../../server/lib/analytics-service');
      
      vi.mocked(getPerformanceAnalytics).mockRejectedValueOnce(new Error('Test error'));

      await request(app)
        .get('/api/analytics/performance')
        .query({ subreddit: 'test', userId: 123 });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should return user-friendly error messages', async () => {
      const { getPerformanceAnalytics } = await import('../../server/lib/analytics-service');
      vi.mocked(getPerformanceAnalytics).mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/analytics/performance')
        .query({ subreddit: 'test', userId: 123 });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Performance', () => {
    it('should respond quickly for cached data', async () => {
      const start = Date.now();
      
      await request(app)
        .get('/api/analytics/metrics')
        .query({ subreddit: 'gonewild' });

      const duration = Date.now() - start;
      
      // Should be fast with mocked data
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/analytics/metrics')
          .query({ subreddit: 'gonewild' })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
