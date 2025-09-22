import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dashboardService } from '../../../server/services/dashboard-service.js';

// Mock the database
vi.mock('../../../server/database.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  }
}));

// Mock the schema imports
vi.mock('../../../shared/schema.js', () => ({
  contentGenerations: { 
    id: 'id',
    userId: 'userId', 
    createdAt: 'createdAt',
    platform: 'platform'
  },
  socialMetrics: { 
    contentId: 'contentId',
    likes: 'likes', 
    comments: 'comments',
    shares: 'shares',
    views: 'views'
  },
  contentFlags: { 
    reportedById: 'reportedById'
  },
  expenses: { 
    userId: 'userId',
    amount: 'amount',
    deductionPercentage: 'deductionPercentage'
  },
  mediaAssets: { 
    id: 'id',
    userId: 'userId',
    filename: 'filename',
    key: 'key',
    createdAt: 'createdAt'
  }
}));

// Mock drizzle-orm functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ column, value, op: 'eq' })),
  desc: vi.fn((column) => ({ column, order: 'desc' })),
  gte: vi.fn((column, value) => ({ column, value, op: 'gte' })),
  sql: vi.fn((template, ...values) => ({ template, values, type: 'sql' }))
}));

describe('DashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard stats for a user', async () => {
      // Mock database responses
      const mockDb = require('../../../server/database.js').db;
      
      // Mock posts count query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ count: 5 }])
        })
      });
      
      // Mock social metrics query (for engagement rate)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          leftJoin: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValueOnce([{ totalEngagement: 100, totalViews: 1000 }])
          })
        })
      });
      
      // Mock content flags query (takedowns)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ count: 2 }])
        })
      });
      
      // Mock expenses query (tax savings)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockResolvedValueOnce([{ totalSavings: 1500 }])
        })
      });

      const userId = 1;
      const result = await dashboardService.getDashboardStats(userId);
      
      expect(result).toHaveProperty('postsToday');
      expect(result).toHaveProperty('engagementRate');
      expect(result).toHaveProperty('takedownsFound');
      expect(result).toHaveProperty('estimatedTaxSavings');
      
      expect(typeof result.postsToday).toBe('number');
      expect(typeof result.engagementRate).toBe('number');
      expect(typeof result.takedownsFound).toBe('number');
      expect(typeof result.estimatedTaxSavings).toBe('number');
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = require('../../../server/database.js').db;
      
      // Mock database error
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockRejectedValueOnce(new Error('Database connection error'))
        })
      });

      const userId = 1;
      const result = await dashboardService.getDashboardStats(userId);
      
      // Should return default values on error
      expect(result).toEqual({
        postsToday: 0,
        engagementRate: 0,
        takedownsFound: 0,
        estimatedTaxSavings: 0
      });
    });
  });

  describe('getDashboardActivity', () => {
    it('should return dashboard activity for a user', async () => {
      const mockDb = require('../../../server/database.js').db;
      
      // Mock media assets query
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockResolvedValueOnce([
                {
                  id: 1,
                  filename: 'test.jpg',
                  key: 'test-key',
                  createdAt: new Date('2025-09-22')
                }
              ])
            })
          })
        })
      });

      const userId = 1;
      const result = await dashboardService.getDashboardActivity(userId);
      
      expect(result).toHaveProperty('recentMedia');
      expect(Array.isArray(result.recentMedia)).toBe(true);
      
      if (result.recentMedia.length > 0) {
        const mediaItem = result.recentMedia[0];
        expect(mediaItem).toHaveProperty('id');
        expect(mediaItem).toHaveProperty('url');
        expect(mediaItem).toHaveProperty('alt');
        expect(mediaItem).toHaveProperty('createdAt');
        
        expect(mediaItem.url).toMatch(/^\/api\/media\/\d+$/);
      }
    });

    it('should handle database errors gracefully', async () => {
      const mockDb = require('../../../server/database.js').db;
      
      // Mock database error
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            orderBy: vi.fn().mockReturnValueOnce({
              limit: vi.fn().mockRejectedValueOnce(new Error('Database connection error'))
            })
          })
        })
      });

      const userId = 1;
      const result = await dashboardService.getDashboardActivity(userId);
      
      // Should return empty array on error
      expect(result).toEqual({ recentMedia: [] });
    });
  });

  describe('getAdminDashboardStats', () => {
    it('should return admin dashboard stats', async () => {
      const mockDb = require('../../../server/database.js').db;
      
      // Mock various queries for admin stats
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 10 }])
        })
      });

      const result = await dashboardService.getAdminDashboardStats();
      
      expect(result).toHaveProperty('postsToday');
      expect(result).toHaveProperty('engagementRate');
      expect(result).toHaveProperty('takedownsFound');
      expect(result).toHaveProperty('estimatedTaxSavings');
      
      expect(typeof result.postsToday).toBe('number');
      expect(typeof result.engagementRate).toBe('number');
      expect(typeof result.takedownsFound).toBe('number');
      expect(typeof result.estimatedTaxSavings).toBe('number');
    });
  });

  describe('getAdminDashboardActivity', () => {
    it('should return admin dashboard activity', async () => {
      const mockDb = require('../../../server/database.js').db;
      
      // Mock media assets query for admin
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([
              {
                id: 1,
                filename: 'admin-test.jpg',
                key: 'admin-test-key',
                createdAt: new Date('2025-09-22')
              },
              {
                id: 2,
                filename: 'admin-test2.jpg',
                key: 'admin-test-key2',
                createdAt: new Date('2025-09-21')
              }
            ])
          })
        })
      });

      const result = await dashboardService.getAdminDashboardActivity();
      
      expect(result).toHaveProperty('recentMedia');
      expect(Array.isArray(result.recentMedia)).toBe(true);
      
      // Admin should potentially see more items
      expect(result.recentMedia.length).toBeLessThanOrEqual(8);
    });
  });
});