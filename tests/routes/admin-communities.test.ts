import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { adminCommunitiesRouter } from '../../server/routes/admin-communities.js';

// Mock dependencies with factory functions
vi.mock('../../server/reddit-communities.js', () => ({
  listCommunities: vi.fn(),
  createCommunity: vi.fn(),
  updateCommunity: vi.fn(),
  deleteCommunity: vi.fn(),
}));

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn()
}));

vi.mock('../../server/admin-routes.js', () => ({
  requireAdmin: vi.fn()
}));

vi.mock('@shared/schema', () => ({
  insertRedditCommunitySchema: {
    parse: vi.fn(),
    partial: vi.fn().mockReturnValue({
      parse: vi.fn()
    })
  }
}));

// Import mocked functions
import { listCommunities, createCommunity, updateCommunity, deleteCommunity } from '../../server/reddit-communities.js';
import { authenticateToken } from '../../server/middleware/auth.js';
import { requireAdmin } from '../../server/admin-routes.js';
import { insertRedditCommunitySchema } from '@shared/schema';

const mockListCommunities = vi.mocked(listCommunities);
const mockCreateCommunity = vi.mocked(createCommunity);
const mockUpdateCommunity = vi.mocked(updateCommunity);
const mockDeleteCommunity = vi.mocked(deleteCommunity);
const mockAuthenticateToken = vi.mocked(authenticateToken);
const mockRequireAdmin = vi.mocked(requireAdmin);
const mockSchema = vi.mocked(insertRedditCommunitySchema);

describe('Admin Communities Routes', () => {
  let app: express.Application;
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/communities', adminCommunitiesRouter);
    request = supertest(app);
    
    // Reset mocks and setup default successful auth
    vi.clearAllMocks();
    mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
      req.user = {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        isAdmin: true,
        role: 'admin',
        tier: 'pro'
      };
      next();
    });
    mockRequireAdmin.mockImplementation((req: any, res: any, next: any) => {
      next();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/communities', () => {
    it('should list all communities', async () => {
      const mockCommunities = [
        {
          id: 'test1',
          name: 'testcommunity',
          displayName: 'Test Community',
          description: 'A test community',
          category: 'photography',
          members: 1000,
          engagementRate: 50,
          verificationRequired: false,
          promotionAllowed: 'yes',
          rules: {
            sellingAllowed: 'allowed',
            minKarma: 100,
            minAccountAge: 30,
            verificationRequired: false,
            watermarksAllowed: true,
            maxPostsPerDay: 5,
            cooldownHours: 24,
            requiresApproval: false,
            titleRules: [],
            contentRules: [],
            linkRestrictions: []
          },
          postingLimits: null,
          successProbability: 85,
          competitionLevel: 'medium',
          growthTrend: 'up',
          modActivity: 'active',
          bestPostingTimes: ['9:00 AM', '6:00 PM'],
          averageUpvotes: 250,
          tags: ['photography', 'art']
        }
      ];

      mockListCommunities.mockResolvedValue(mockCommunities);

      const response = await request
        .get('/api/admin/communities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: 'test1',
        name: 'testcommunity',
        displayName: 'Test Community'
      });

      expect(mockListCommunities).toHaveBeenCalledOnce();
    });

    it('should handle list communities error', async () => {
      mockListCommunities.mockRejectedValue(new Error('Database error'));

      const response = await request
        .get('/api/admin/communities')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to load communities');
    });
  });

  describe('POST /api/admin/communities', () => {
    it('should create a new community', async () => {
      const newCommunityData = {
        id: 'newtest',
        name: 'newtestcommunity',
        displayName: 'New Test Community',
        description: 'A new test community',
        category: 'general',
        members: 0,
        engagementRate: 0,
        verificationRequired: false,
        promotionAllowed: 'no'
      };

      const createdCommunity = {
        ...newCommunityData,
        rules: {
          sellingAllowed: 'not_allowed',
          minKarma: null,
          minAccountAge: null,
          verificationRequired: false,
          watermarksAllowed: true,
          maxPostsPerDay: null,
          cooldownHours: null,
          requiresApproval: false,
          titleRules: [],
          contentRules: [],
          linkRestrictions: []
        },
        postingLimits: null,
        successProbability: null,
        competitionLevel: null,
        growthTrend: null,
        modActivity: null,
        bestPostingTimes: null,
        averageUpvotes: null,
        tags: null
      };

      mockCreateCommunity.mockResolvedValue(createdCommunity);

      const response = await request
        .post('/api/admin/communities')
        .send(newCommunityData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'newtest',
        name: 'newtestcommunity',
        displayName: 'New Test Community'
      });

      expect(mockCreateCommunity).toHaveBeenCalledWith(newCommunityData);
    });
  });

  describe('PUT /api/admin/communities/:id', () => {
    it('should update an existing community', async () => {
      const updateData = {
        displayName: 'Updated Test Community',
        description: 'An updated test community'
      };

      const updatedCommunity = {
        id: 'test1',
        name: 'testcommunity',
        displayName: 'Updated Test Community',
        description: 'An updated test community',
        category: 'photography',
        members: 1000,
        engagementRate: 50,
        verificationRequired: false,
        promotionAllowed: 'yes',
        rules: {
          sellingAllowed: 'allowed',
          minKarma: 100,
          minAccountAge: 30,
          verificationRequired: false,
          watermarksAllowed: true,
          maxPostsPerDay: 5,
          cooldownHours: 24,
          requiresApproval: false,
          titleRules: [],
          contentRules: [],
          linkRestrictions: []
        },
        postingLimits: null,
        successProbability: 85,
        competitionLevel: 'medium',
        growthTrend: 'up',
        modActivity: 'active',
        bestPostingTimes: ['9:00 AM', '6:00 PM'],
        averageUpvotes: 250,
        tags: ['photography', 'art']
      };

      mockUpdateCommunity.mockResolvedValue(updatedCommunity);

      const response = await request
        .put('/api/admin/communities/test1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.displayName).toBe('Updated Test Community');

      expect(mockUpdateCommunity).toHaveBeenCalledWith('test1', updateData);
    });

    it('should handle update community not found', async () => {
      mockUpdateCommunity.mockResolvedValue(undefined);

      const response = await request
        .put('/api/admin/communities/nonexistent')
        .send({ displayName: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Community not found');
    });
  });

  describe('DELETE /api/admin/communities/:id', () => {
    it('should delete a community', async () => {
      // Mock that community exists
      mockListCommunities.mockResolvedValue([
        { id: 'test1', name: 'testcommunity', displayName: 'Test Community' }
      ]);
      mockDeleteCommunity.mockResolvedValue(undefined);

      const response = await request
        .delete('/api/admin/communities/test1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Community deleted successfully');

      expect(mockDeleteCommunity).toHaveBeenCalledWith('test1');
    });

    it('should return 404 when deleting non-existent community', async () => {
      mockListCommunities.mockResolvedValue([]);

      const response = await request
        .delete('/api/admin/communities/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Community not found');
    });

    it('should handle delete community error', async () => {
      mockListCommunities.mockResolvedValue([
        { id: 'test1', name: 'testcommunity', displayName: 'Test Community' }
      ]);
      mockDeleteCommunity.mockRejectedValue(new Error('Database error'));

      const response = await request
        .delete('/api/admin/communities/test1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to delete community');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when no authentication token is provided', async () => {
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ message: 'Access token required' });
      });

      const response = await request
        .get('/api/admin/communities')
        .expect(401);

      expect(response.body.message).toBe('Access token required');
    });

    it('should return 403 when user is not admin', async () => {
      mockAuthenticateToken.mockImplementation((req: any, res: any, next: any) => {
        req.user = {
          id: 2,
          username: 'regular_user',
          email: 'user@test.com',
          isAdmin: false,
          role: 'user',
          tier: 'free'
        };
        next();
      });
      
      mockRequireAdmin.mockImplementation((req: any, res: any, next: any) => {
        res.status(403).json({ message: 'Admin access required' });
      });

      const response = await request
        .get('/api/admin/communities')
        .expect(403);

      expect(response.body.message).toBe('Admin access required');
    });

    it('should allow access for authenticated admin user', async () => {
      mockListCommunities.mockResolvedValue([]);

      const response = await request
        .get('/api/admin/communities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Input Validation and Error Handling', () => {
    it('should return 400 for invalid community data on creation', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        displayName: 'Test',
        // Missing required fields
      };

      mockCreateCommunity.mockRejectedValue(new Error('Validation failed: name is required'));

      const response = await request
        .post('/api/admin/communities')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should return 400 for invalid enum values', async () => {
      const invalidEnumData = {
        id: 'test',
        name: 'testcommunity',
        displayName: 'Test Community',
        category: 'general',
        members: 1000,
        engagementRate: 50,
        verificationRequired: false,
        promotionAllowed: 'invalid_promotion', // Invalid enum value
        growthTrend: 'invalid_trend' // Invalid enum value
      };

      mockCreateCommunity.mockRejectedValue(
        new Error('Invalid enum values: promotionAllowed must be one of [yes, no, limited, subtle, strict, unknown]')
      );

      const response = await request
        .post('/api/admin/communities')
        .send(invalidEnumData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid enum values');
    });
  });

  describe('Enum Variations and Response Shaping', () => {
    it('should handle all canonical selling policy enum variations', async () => {
      const communityWithSellingPolicies = [
        {
          id: 'allowed_selling',
          name: 'allowedcommunity',
          displayName: 'Allowed Community',
          category: 'selling',
          members: 1000,
          engagementRate: 50,
          verificationRequired: false,
          promotionAllowed: 'yes',
          rules: {
            sellingAllowed: 'allowed',
            minKarma: 100,
            minAccountAge: 30,
            verificationRequired: false,
            watermarksAllowed: true,
            titleRules: [],
            contentRules: [],
            linkRestrictions: []
          },
          growthTrend: 'up',
          modActivity: 'high',
          competitionLevel: 'low'
        },
        {
          id: 'limited_selling',
          name: 'limitedcommunity',
          displayName: 'Limited Community',
          category: 'general',
          members: 2000,
          engagementRate: 40,
          verificationRequired: true,
          promotionAllowed: 'limited',
          rules: {
            sellingAllowed: 'limited',
            minKarma: 500,
            minAccountAge: 90,
            verificationRequired: true,
            watermarksAllowed: false,
            titleRules: ['No spammy titles'],
            contentRules: ['Quality content only'],
            linkRestrictions: ['No direct links']
          },
          growthTrend: 'stable',
          modActivity: 'medium',
          competitionLevel: 'medium'
        },
        {
          id: 'not_allowed_selling',
          name: 'strictcommunity',
          displayName: 'Strict Community',
          category: 'discussion',
          members: 5000,
          engagementRate: 30,
          verificationRequired: true,
          promotionAllowed: 'no',
          rules: {
            sellingAllowed: 'not_allowed',
            minKarma: 1000,
            minAccountAge: 180,
            verificationRequired: true,
            watermarksAllowed: false,
            titleRules: ['Descriptive titles only'],
            contentRules: ['No promotional content'],
            linkRestrictions: ['No external links']
          },
          growthTrend: 'down',
          modActivity: 'low',
          competitionLevel: 'high'
        },
        {
          id: 'unknown_selling',
          name: 'unknowncommunity',
          displayName: 'Unknown Community',
          category: 'other',
          members: 500,
          engagementRate: 20,
          verificationRequired: false,
          promotionAllowed: 'unknown',
          rules: {
            sellingAllowed: 'unknown',
            minKarma: null,
            minAccountAge: null,
            verificationRequired: false,
            watermarksAllowed: true,
            titleRules: [],
            contentRules: [],
            linkRestrictions: []
          },
          growthTrend: 'stable',
          modActivity: 'unknown',
          competitionLevel: 'unknown'
        }
      ];

      mockListCommunities.mockResolvedValue(communityWithSellingPolicies);

      const response = await request
        .get('/api/admin/communities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(4);
      
      // Verify response shaping matches AdminCommunity interface
      const responseData = response.body.data;
      
      // Test 'allowed' policy community
      expect(responseData[0].rules.sellingAllowed).toBe('allowed');
      expect(responseData[0].growthTrend).toBe('up');
      expect(responseData[0].competitionLevel).toBe('low');
      
      // Test 'limited' policy community
      expect(responseData[1].rules.sellingAllowed).toBe('limited');
      expect(responseData[1].growthTrend).toBe('stable');
      expect(responseData[1].competitionLevel).toBe('medium');
      
      // Test 'not_allowed' policy community
      expect(responseData[2].rules.sellingAllowed).toBe('not_allowed');
      expect(responseData[2].growthTrend).toBe('down');
      expect(responseData[2].competitionLevel).toBe('high');
      
      // Test 'unknown' policy community
      expect(responseData[3].rules.sellingAllowed).toBe('unknown');
      expect(responseData[3].growthTrend).toBe('stable');
      expect(responseData[3].competitionLevel).toBe('unknown');
    });

    it('should properly shape response to match AdminCommunity interface', async () => {
      const communityFromDB = {
        id: 'test-shaping',
        name: 'testshaping',
        displayName: 'Test Shaping Community',
        description: 'Test description',
        category: 'photography',
        members: 1500,
        engagementRate: 65,
        verificationRequired: true,
        promotionAllowed: 'limited',
        rules: {
          sellingAllowed: 'limited',
          minKarma: 200,
          minAccountAge: 60,
          verificationRequired: true,
          watermarksAllowed: false,
          maxPostsPerDay: 3,
          cooldownHours: 12,
          requiresApproval: true,
          titleRules: ['Clear titles only'],
          contentRules: ['High quality content'],
          linkRestrictions: ['Approved links only']
        },
        postingLimits: {
          perDay: 3,
          perWeek: 15,
          cooldownHours: 12
        },
        averageUpvotes: 180,
        successProbability: 72,
        growthTrend: 'up',
        modActivity: 'high',
        competitionLevel: 'medium',
        bestPostingTimes: ['10:00 AM', '7:00 PM'],
        tags: ['photography', 'creative', 'art']
      };

      mockListCommunities.mockResolvedValue([communityFromDB]);

      const response = await request
        .get('/api/admin/communities')
        .expect(200);

      const shapedCommunity = response.body.data[0];
      
      // Verify all AdminCommunity interface fields are present and correctly shaped
      expect(shapedCommunity).toHaveProperty('id', 'test-shaping');
      expect(shapedCommunity).toHaveProperty('name', 'testshaping');
      expect(shapedCommunity).toHaveProperty('displayName', 'Test Shaping Community');
      expect(shapedCommunity).toHaveProperty('description', 'Test description');
      expect(shapedCommunity).toHaveProperty('category', 'photography');
      expect(shapedCommunity).toHaveProperty('members', 1500);
      expect(shapedCommunity).toHaveProperty('engagementRate', 65);
      expect(shapedCommunity).toHaveProperty('verificationRequired', true);
      expect(shapedCommunity).toHaveProperty('promotionAllowed', 'limited');
      expect(shapedCommunity).toHaveProperty('rules');
      expect(shapedCommunity).toHaveProperty('postingLimits');
      expect(shapedCommunity).toHaveProperty('averageUpvotes', 180);
      expect(shapedCommunity).toHaveProperty('successProbability', 72);
      expect(shapedCommunity).toHaveProperty('growthTrend', 'up');
      expect(shapedCommunity).toHaveProperty('modActivity', 'high');
      expect(shapedCommunity).toHaveProperty('competitionLevel', 'medium');
      expect(shapedCommunity).toHaveProperty('bestPostingTimes');
      expect(shapedCommunity).toHaveProperty('tags');
      
      // Verify nested objects are properly shaped
      expect(shapedCommunity.rules).toMatchObject({
        sellingAllowed: 'limited',
        minKarma: 200,
        minAccountAge: 60,
        verificationRequired: true,
        watermarksAllowed: false
      });
      
      expect(shapedCommunity.postingLimits).toMatchObject({
        perDay: 3,
        perWeek: 15,
        cooldownHours: 12
      });
      
      expect(shapedCommunity.tags).toEqual(['photography', 'creative', 'art']);
      expect(shapedCommunity.bestPostingTimes).toEqual(['10:00 AM', '7:00 PM']);
    });
  });
});