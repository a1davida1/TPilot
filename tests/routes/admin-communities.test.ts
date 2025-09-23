import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import { adminCommunitiesRouter } from '../../server/routes/admin-communities.js';

// Mock dependencies
const mockListCommunities = vi.fn();
const mockCreateCommunity = vi.fn();
const mockUpdateCommunity = vi.fn();
const mockDeleteCommunity = vi.fn();

vi.mock('../../server/reddit-communities.js', () => ({
  listCommunities: mockListCommunities,
  createCommunity: mockCreateCommunity,
  updateCommunity: mockUpdateCommunity,
  deleteCommunity: mockDeleteCommunity,
}));

// Mock auth middleware to always return admin user
vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req: any, res: any, next: any) => {
    req.user = {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      isAdmin: true,
      tier: 'pro'
    };
    next();
  })
}));

describe('Admin Communities Routes', () => {
  let app: express.Application;
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin/communities', adminCommunitiesRouter);
    request = supertest(app);
    
    // Reset mocks
    vi.clearAllMocks();
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
      mockDeleteCommunity.mockResolvedValue(undefined);

      const response = await request
        .delete('/api/admin/communities/test1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Community deleted successfully');

      expect(mockDeleteCommunity).toHaveBeenCalledWith('test1');
    });
  });
});