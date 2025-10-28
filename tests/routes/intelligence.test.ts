/**
 * Intelligence API Routes Tests
 * Tests for Level 1 Reddit Intelligence features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { intelligenceRouter } from '../../server/routes/intelligence.js';
import { authenticateToken } from '../../server/middleware/auth.js';
import { db } from '../../server/db.js';
import { redditPostOutcomes, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { subDays } from 'date-fns';

// Mock authentication middleware
vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: () => (req: any, res: any, next: any) => {
    req.user = {
      id: 1,
      tier: 'pro',
      email: 'test@example.com'
    };
    next();
  },
  AuthRequest: {}
}));

// Mock database
vi.mock('../../server/db.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock logger
vi.mock('../../server/bootstrap/logger.js', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Intelligence API Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/intelligence', intelligenceRouter);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/intelligence/title-analysis/:subreddit', () => {
    it('should return title analysis for successful posts', async () => {
      // Mock successful posts data
      const mockPosts = [
        { title: 'First time posting here! 😊', upvotes: 150, views: 500, occurredAt: new Date() },
        { title: 'What do you think? 💕', upvotes: 200, views: 600, occurredAt: new Date() },
        { title: 'Feeling cute today', upvotes: 100, views: 300, occurredAt: new Date() },
        { title: 'Should I post more?', upvotes: 180, views: 550, occurredAt: new Date() },
        { title: 'New here ✨', upvotes: 120, views: 400, occurredAt: new Date() }
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockPosts)
            })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/title-analysis/gonewild')
        .expect(200);

      expect(response.body).toHaveProperty('sampleSize', 5);
      expect(response.body).toHaveProperty('overview');
      expect(response.body.overview).toHaveProperty('avgTitleLength');
      expect(response.body.overview).toHaveProperty('questionRatio');
      expect(response.body.overview).toHaveProperty('emojiUsageRate');
      expect(response.body).toHaveProperty('questionAnalysis');
      expect(response.body).toHaveProperty('emojiAnalysis');
      expect(response.body).toHaveProperty('lengthAnalysis');
      expect(response.body).toHaveProperty('topKeywords');
      expect(response.body).toHaveProperty('recommendations');
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });

    it('should require Pro tier or higher', async () => {
      // Override auth mock for this test
      vi.mocked(authenticateToken).mockImplementation(() => (req: any, res: any, next: any) => {
        req.user = { id: 1, tier: 'free' };
        next();
      });

      const response = await request(app)
        .get('/api/intelligence/title-analysis/gonewild')
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Pro tier');
    });

    it('should return helpful message when no data', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/title-analysis/gonewild')
        .expect(200);

      expect(response.body.sampleSize).toBe(0);
      expect(response.body.message).toBeDefined();
      expect(response.body.recommendations).toBeDefined();
    });
  });

  describe('GET /api/intelligence/posting-cadence/:subreddit', () => {
    it('should analyze posting cadence and detect patterns', async () => {
      // Mock posts with varying gaps
      const now = new Date();
      const mockPosts = [
        { occurredAt: subDays(now, 7), success: true, upvotes: 100, views: 300 },
        { occurredAt: subDays(now, 5), success: true, upvotes: 150, views: 400 },
        { occurredAt: subDays(now, 4), success: false, upvotes: 50, views: 100 },
        { occurredAt: subDays(now, 3), success: true, upvotes: 200, views: 500 },
        { occurredAt: subDays(now, 2), success: true, upvotes: 180, views: 450 },
        { occurredAt: subDays(now, 1), success: true, upvotes: 160, views: 420 }
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPosts)
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/posting-cadence/gonewild')
        .expect(200);

      expect(response.body).toHaveProperty('sampleSize');
      expect(response.body).toHaveProperty('currentCadence');
      expect(response.body.currentCadence).toHaveProperty('avgGapHours');
      expect(response.body.currentCadence).toHaveProperty('postsPerWeek');
      expect(response.body).toHaveProperty('optimalCadence');
      expect(response.body).toHaveProperty('gapAnalysis');
      expect(response.body).toHaveProperty('status');
      expect(['over-posting', 'optimal', 'under-posting', 'inconsistent']).toContain(response.body.status);
      expect(response.body).toHaveProperty('engagementTrend');
      expect(response.body).toHaveProperty('warnings');
      expect(response.body.warnings).toHaveProperty('diminishingReturns');
      expect(response.body.warnings).toHaveProperty('burnoutDetected');
      expect(response.body).toHaveProperty('recommendation');
      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
    });

    it('should detect over-posting and diminishing returns', async () => {
      // Mock frequent posts with declining engagement
      const now = new Date();
      const mockPosts = [
        { occurredAt: subDays(now, 10), success: true, upvotes: 200, views: 600 },
        { occurredAt: subDays(now, 9.5), success: true, upvotes: 100, views: 300 }, // 12h gap, lower engagement
        { occurredAt: subDays(now, 9), success: true, upvotes: 80, views: 250 }, // 12h gap, even lower
        { occurredAt: subDays(now, 7), success: true, upvotes: 180, views: 550 }, // 48h gap, better engagement
        { occurredAt: subDays(now, 5), success: true, upvotes: 190, views: 580 }, // 48h gap, good engagement
        { occurredAt: subDays(now, 3), success: true, upvotes: 200, views: 600 }  // 48h gap, great engagement
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPosts)
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/posting-cadence/gonewild')
        .expect(200);

      expect(response.body.warnings.diminishingReturns).toBe(true);
      expect(response.body.status).toBe('over-posting');
    });

    it('should require minimum 5 posts for analysis', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              { occurredAt: new Date(), success: true, upvotes: 100, views: 300 },
              { occurredAt: subDays(new Date(), 1), success: true, upvotes: 120, views: 350 }
            ])
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/posting-cadence/gonewild')
        .expect(200);

      expect(response.body.sampleSize).toBeLessThan(5);
      expect(response.body.message).toContain('Not enough posts');
      expect(response.body.currentStatus).toBe('insufficient-data');
    });
  });

  describe('GET /api/intelligence/subreddit-recommendations', () => {
    it('should return similar subreddit recommendations', async () => {
      // Mock user's successful subreddits
      const mockUserSubreddits = [
        { subreddit: 'gonewild', posts: 20, successRate: 85, avgEngagement: 500 },
        { subreddit: 'gonewild30plus', posts: 15, successRate: 80, avgEngagement: 450 }
      ];

      // Mock similar communities
      const mockCommunities = [
        { id: 'adorableporn', name: 'adorableporn', displayName: 'r/adorableporn', description: 'Cute NSFW content', members: 250000, over18: true, verificationRequired: false, promotionAllowed: 'yes', rules: {} },
        { id: 'realgirls', name: 'realgirls', displayName: 'r/RealGirls', description: 'Real girls', members: 300000, over18: true, verificationRequired: false, promotionAllowed: 'limited', rules: { eligibility: { minKarma: 500 } } }
      ];

      // Mock the database queries
      vi.mocked(db.select).mockImplementation(() => {
        const query: any = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          having: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue(mockUserSubreddits)
        };
        return query;
      });

      // Second call for similar communities
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                having: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockUserSubreddits)
                })
              })
            })
          })
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCommunities)
          })
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCommunities)
          })
        } as any);

      const response = await request(app)
        .get('/api/intelligence/subreddit-recommendations')
        .expect(200);

      expect(response.body).toHaveProperty('sampleSize');
      expect(response.body).toHaveProperty('basedOn');
      expect(Array.isArray(response.body.basedOn)).toBe(true);
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('totalRecommendations');
      expect(response.body.summary).toHaveProperty('lowRisk');
      expect(response.body.summary).toHaveProperty('mediumRisk');
      expect(response.body.summary).toHaveProperty('highRisk');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body.recommendations).toHaveProperty('lowRisk');
      expect(response.body.recommendations).toHaveProperty('mediumRisk');
      expect(response.body.recommendations).toHaveProperty('highRisk');
      expect(response.body).toHaveProperty('insights');
      expect(Array.isArray(response.body.insights)).toBe(true);
    });

    it('should properly score and categorize communities by risk', async () => {
      const mockUserSubreddits = [
        { subreddit: 'gonewild', posts: 20, successRate: 85, avgEngagement: 500 }
      ];

      const mockCommunities = [
        {
          id: 'lowrisk',
          name: 'lowrisk',
          displayName: 'r/lowrisk',
          description: 'Low risk community',
          members: 200000,
          over18: true,
          verificationRequired: false,
          promotionAllowed: 'yes',
          rules: { eligibility: { minKarma: 0, minAccountAgeDays: 0 } }
        },
        {
          id: 'highrisk',
          name: 'highrisk',
          displayName: 'r/highrisk',
          description: 'High risk community',
          members: 500000,
          over18: true,
          verificationRequired: true,
          promotionAllowed: 'no',
          rules: { eligibility: { minKarma: 2000, minAccountAgeDays: 180 } }
        }
      ];

      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                having: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(mockUserSubreddits)
                })
              })
            })
          })
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCommunities)
          })
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockCommunities)
          })
        } as any);

      const response = await request(app)
        .get('/api/intelligence/subreddit-recommendations')
        .expect(200);

      expect(response.body.recommendations.lowRisk.length).toBeGreaterThan(0);
      expect(response.body.recommendations.highRisk.length).toBeGreaterThan(0);

      // Check that high risk community has appropriate warnings
      const highRiskCommunity = response.body.recommendations.highRisk.find((r: any) => r.subreddit === 'highrisk');
      if (highRiskCommunity) {
        expect(highRiskCommunity.risks.length).toBeGreaterThan(2);
        expect(highRiskCommunity.risks).toContain('Verification required');
      }
    });

    it('should return empty recommendations when no posting history', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              having: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([])
              })
            })
          })
        })
      } as any);

      const response = await request(app)
        .get('/api/intelligence/subreddit-recommendations')
        .expect(200);

      expect(response.body.sampleSize).toBe(0);
      expect(response.body.message).toBeDefined();
      expect(response.body.recommendations).toEqual([]);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      // Override auth mock to reject
      vi.mocked(authenticateToken).mockImplementation(() => (req: any, res: any) => {
        res.status(401).json({ error: 'Authentication required' });
      });

      await request(app)
        .get('/api/intelligence/title-analysis/gonewild')
        .expect(401);
    });

    it('should enforce tier requirements on title analysis', async () => {
      vi.mocked(authenticateToken).mockImplementation(() => (req: any, res: any, next: any) => {
        req.user = { id: 1, tier: 'starter' };
        next();
      });

      const response = await request(app)
        .get('/api/intelligence/title-analysis/gonewild')
        .expect(403);

      expect(response.body.requiredTier).toBe('pro');
    });

    it('should enforce tier requirements on posting cadence', async () => {
      vi.mocked(authenticateToken).mockImplementation(() => (req: any, res: any, next: any) => {
        req.user = { id: 1, tier: 'free' };
        next();
      });

      const response = await request(app)
        .get('/api/intelligence/posting-cadence/gonewild')
        .expect(403);

      expect(response.body.requiredTier).toBe('pro');
    });

    it('should enforce tier requirements on subreddit recommendations', async () => {
      vi.mocked(authenticateToken).mockImplementation(() => (req: any, res: any, next: any) => {
        req.user = { id: 1, tier: 'starter' };
        next();
      });

      const response = await request(app)
        .get('/api/intelligence/subreddit-recommendations')
        .expect(403);

      expect(response.body.requiredTier).toBe('pro');
    });
  });
});
