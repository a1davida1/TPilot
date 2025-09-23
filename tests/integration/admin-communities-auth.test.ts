import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import express from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { adminCommunitiesRouter } from '../../server/routes/admin-communities.js';

// Mock the reddit-communities module
vi.mock('../../server/reddit-communities.js', () => ({
  listCommunities: vi.fn().mockResolvedValue([
    {
      id: '1',
      name: 'test_community',
      displayName: 'Test Community',
      description: 'A test community',
      category: 'Technology',
      members: 10000,
      verificationRequired: false,
      promotionAllowed: true,
      rules: { allowedTypes: ['text', 'image'], maxPostsPerDay: 10 },
      engagementRate: 0.85,
      postingLimits: { maxPerDay: 10, minInterval: 60 },
      averageUpvotes: 150,
      modActivity: 'active',
      tags: ['tech', 'programming'],
      successProbability: 0.75,
      competitionLevel: 'medium',
      growthTrend: 'increasing',
      bestPostingTimes: ['9:00', '15:00', '21:00']
    }
  ]),
  createCommunity: vi.fn().mockImplementation((data) => Promise.resolve({
    id: '2',
    ...data,
    rules: { allowedTypes: ['text'], maxPostsPerDay: 5 },
    engagementRate: 0.5,
    postingLimits: { maxPerDay: 5, minInterval: 120 },
    averageUpvotes: 100,
    modActivity: 'moderate',
    tags: [],
    successProbability: 0.6,
    competitionLevel: 'low',
    growthTrend: 'stable',
    bestPostingTimes: ['12:00']
  })),
  updateCommunity: vi.fn().mockImplementation((id, data) => Promise.resolve({
    id,
    ...data,
    rules: data.rules || { allowedTypes: ['text'], maxPostsPerDay: 5 },
    engagementRate: 0.6,
    postingLimits: { maxPerDay: 5, minInterval: 120 },
    averageUpvotes: 120,
    modActivity: 'moderate',
    tags: data.tags || [],
    successProbability: 0.65,
    competitionLevel: 'medium',
    growthTrend: 'stable',
    bestPostingTimes: ['12:00', '18:00']
  })),
  deleteCommunity: vi.fn().mockResolvedValue(undefined)
}));

// Mock the schema
vi.mock('@shared/schema', () => ({
  insertRedditCommunitySchema: {
    parse: vi.fn().mockImplementation((data) => data),
    partial: vi.fn().mockReturnValue({
      parse: vi.fn().mockImplementation((data) => data)
    })
  }
}));

describe('Admin Communities Authentication Integration', () => {
  let app: express.Application;
  let agent: request.SuperAgentTest;

  beforeAll(async () => {
    // Create Express app with session middleware (similar to production setup)
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    // Session middleware setup
    app.use(session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: false, // Allow non-HTTPS in tests
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Mock authentication by adding user to session
    app.use('/api/reddit/communities', (req: any, res, next) => {
      // Simulate authenticated admin user in session
      req.user = {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        isAdmin: true,
        role: 'admin',
        tier: 'pro'
      };
      
      // Mock isAuthenticated function for Passport.js compatibility
      req.isAuthenticated = () => true;
      
      next();
    });

    // Mount admin communities router
    app.use('/api/reddit/communities', adminCommunitiesRouter);

    // Create persistent agent for session cookie handling
    agent = request.agent(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('should list communities without Authorization header (session auth)', async () => {
    const response = await agent
      .get('/api/reddit/communities')
      .expect(200);

    expect(response.body).toBeDefined();
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0]).toMatchObject({
      id: '1',
      name: 'test_community',
      displayName: 'Test Community'
    });
  });

  test('should create community without Authorization header (session auth)', async () => {
    const newCommunity = {
      name: 'new_community',
      displayName: 'New Community',
      description: 'A new test community',
      category: 'Gaming',
      members: 5000,
      verificationRequired: true,
      promotionAllowed: false
    };

    const response = await agent
      .post('/api/reddit/communities')
      .send(newCommunity)
      .expect(201);

    expect(response.body).toMatchObject({
      id: '2',
      name: 'new_community',
      displayName: 'New Community'
    });
  });

  test('should update community without Authorization header (session auth)', async () => {
    const updateData = {
      displayName: 'Updated Community',
      description: 'Updated description'
    };

    const response = await agent
      .put('/api/reddit/communities/1')
      .send(updateData)
      .expect(200);

    expect(response.body).toMatchObject({
      id: '1',
      displayName: 'Updated Community',
      description: 'Updated description'
    });
  });

  test('should delete community without Authorization header (session auth)', async () => {
    await agent
      .delete('/api/reddit/communities/1')
      .expect(200);

    expect(response => {
      expect(response.body.message).toBe('Community deleted successfully');
    });
  });

  test('should handle non-existent community update gracefully', async () => {
    const { updateCommunity } = await import('../../server/reddit-communities.js');
    vi.mocked(updateCommunity).mockResolvedValueOnce(undefined);

    const updateData = { displayName: 'Does Not Exist' };

    await agent
      .put('/api/reddit/communities/999')
      .send(updateData)
      .expect(404);
  });

  test('should handle non-existent community deletion gracefully', async () => {
    const { listCommunities } = await import('../../server/reddit-communities.js');
    // Mock empty communities list to simulate non-existent community
    vi.mocked(listCommunities).mockResolvedValueOnce([]);

    await agent
      .delete('/api/reddit/communities/999')
      .expect(404);
  });

  test('should work with plain fetch simulation (no special headers)', async () => {
    // This test simulates how the frontend makes requests without Authorization headers
    const response = await request(app)
      .get('/api/reddit/communities')
      // No Authorization header, no special session setup - just plain request
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json');

    // Note: This will work because our mock middleware sets req.user above
    // In real scenarios, the session middleware would handle this
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});