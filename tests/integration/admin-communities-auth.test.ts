
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import session, { type Session, type SessionData } from 'express-session';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { adminCommunitiesRouter } from '../../server/routes/admin-communities.ts';
import { authenticateToken, type AuthRequest } from '../../server/middleware/auth.ts';

// Mock the reddit-communities module
vi.mock('../../server/reddit-communities.ts', () => ({
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
  createCommunity: vi.fn().mockImplementation((data: Record<string, unknown>) => Promise.resolve({
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
  updateCommunity: vi.fn().mockImplementation((id: string, data: Record<string, unknown>) => Promise.resolve({
    id,
    ...data,
    rules: data.rules ?? { allowedTypes: ['text'], maxPostsPerDay: 5 },
    engagementRate: 0.6,
    postingLimits: { maxPerDay: 5, minInterval: 120 },
    averageUpvotes: 120,
    modActivity: 'moderate',
    tags: data.tags ?? [],
    successProbability: 0.65,
    competitionLevel: 'medium',
    growthTrend: 'stable',
    bestPostingTimes: ['12:00', '18:00']
  })),
  deleteCommunity: vi.fn().mockResolvedValue(undefined)
}));

// Mock the schema
vi.mock('@shared/schema', async () => {
  const actual = await vi.importActual<typeof import('@shared/schema')>('@shared/schema');
  return {
    ...actual,
    insertRedditCommunitySchema: {
      parse: vi.fn().mockImplementation((data: unknown) => data),
      partial: vi.fn().mockReturnValue({
        parse: vi.fn().mockImplementation((data: unknown) => data)
      })
    }
  };
});

type AdminSessionUser = {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  role: string;
  tier: string;
  emailVerified: boolean;
  isDeleted: boolean;
  bannedAt: Date | null;
  suspendedUntil: Date | null;
  subscriptionStatus: string;
  password: string;
  mustChangePassword: boolean;
};

type RequestWithSession = AuthRequest & {
  session?: Session & Partial<SessionData> & { user?: AuthRequest['user'] };
  isAuthenticated?: () => boolean;
};

describe('Admin Communities Authentication Integration', () => {
  let app: express.Application;
  let agent: request.SuperAgentTest | undefined;

  const baseUserState = {
    emailVerified: true,
    isDeleted: false,
    bannedAt: null,
    suspendedUntil: null,
    subscriptionStatus: 'active',
    password: 'hashedpassword',
    mustChangePassword: false,
  } as const;

  const adminUser: AdminSessionUser = {
    id: 1,
    username: 'admin',
    email: 'admin@test.com',
    isAdmin: true,
    role: 'admin',
    tier: 'pro',
    ...baseUserState,
  };

  const nonAdminUser: AdminSessionUser = {
    id: 2,
    username: 'member',
    email: 'member@test.com',
    isAdmin: false,
    role: 'member',
    tier: 'starter',
    ...baseUserState,
  };

  const loginAs = async (user: AdminSessionUser) => {
    if (!agent) {
      throw new Error('Agent not initialized');
    }
    await agent.post('/test/login').send(user).expect(204);
  };

  const logout = async () => {
    if (!agent) {
      return;
    }
    await agent.post('/test/logout').send({}).expect(204);
  };

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
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));

    const redditCommunities = await import('../../server/reddit-communities.ts');

    app.use((req, _res, next) => {
      const requestWithSession = req as RequestWithSession;
      const sessionUser = requestWithSession.session?.user as AuthRequest['user'] | undefined;
      requestWithSession.isAuthenticated = () => Boolean(sessionUser);
      if (sessionUser) {
        requestWithSession.user = sessionUser;
      }
      next();
    });

    // Mount admin communities router
    app.get('/api/reddit/communities', authenticateToken(true), async (_req: AuthRequest, res) => {
      const communities = await redditCommunities.listCommunities();
      res.json(communities);
    });

    app.post('/test/login', (req, res) => {
      const requestWithSession = req as RequestWithSession;
      const sessionInstance = requestWithSession.session;

      if (!sessionInstance) {
        res.status(500).json({ message: 'Session not initialized' });
        return;
      }

      const sessionUser = req.body as AdminSessionUser;
      sessionInstance.user = sessionUser as unknown as AuthRequest['user'];
      res.status(204).send();
    });

    app.post('/test/logout', (req, res) => {
      const requestWithSession = req as RequestWithSession;
      const sessionInstance = requestWithSession.session;

      if (!sessionInstance) {
        res.status(204).send();
        return;
      }

      sessionInstance.destroy(error => {
        if (error) {
          res.status(500).json({ message: 'Failed to destroy session' });
          return;
        }
        res.status(204).send();
      });
    });

    app.use('/api/admin/communities', adminCommunitiesRouter);

    // Create persistent agent for session cookie handling
    agent = request.agent(app);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await logout();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('requires authentication for reddit communities listing', async () => {
    await request(app)
      .get('/api/reddit/communities')
      .expect(401);
  });

  test('allows session-authenticated users to access reddit communities listing', async () => {
    await loginAs(nonAdminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    const response = await agent
      .get('/api/reddit/communities')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toMatchObject({
      id: '1',
      name: 'test_community',
      displayName: 'Test Community'
    });
  });

  test('rejects admin communities access without authentication', async () => {
    await request(app)
      .get('/api/admin/communities')
      .expect(401);
  });

  test('rejects admin communities access for non-admin users', async () => {
    await loginAs(nonAdminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    await agent
      .get('/api/admin/communities')
      .expect(403);
  });

  test('rejects admin community modifications without authentication', async () => {
    await request(app)
      .post('/api/admin/communities')
      .send({ name: 'unauthorized' })
      .expect(401);

    await request(app)
      .put('/api/admin/communities/1')
      .send({ displayName: 'Unauthorized' })
      .expect(401);

    await request(app)
      .delete('/api/admin/communities/1')
      .expect(401);
  });

  test('lists communities for authenticated admin user', async () => {
    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    const response = await agent
      .get('/api/admin/communities')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0]).toMatchObject({
      id: '1',
      name: 'test_community',
      displayName: 'Test Community'
    });
  });

  test('creates community for authenticated admin user', async () => {
    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

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
      .post('/api/admin/communities')
      .send(newCommunity)
      .expect(201);

    expect(response.body).toMatchObject({
      id: '2',
      name: 'new_community',
      displayName: 'New Community'
    });
  });

  test('updates community for authenticated admin user', async () => {
    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    const updateData = {
      displayName: 'Updated Community',
      description: 'Updated description'
    };

    const response = await agent
      .put('/api/admin/communities/1')
      .send(updateData)
      .expect(200);

    expect(response.body).toMatchObject({
      id: '1',
      displayName: 'Updated Community',
      description: 'Updated description'
    });
  });

  test('deletes community for authenticated admin user', async () => {
    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    const response = await agent
      .delete('/api/admin/communities/1')
      .expect(200);

    expect(response.body.message).toBe('Community deleted successfully');
  });

  test('handles non-existent community update gracefully', async () => {
    const { updateCommunity } = await import('../../server/reddit-communities.ts');
    vi.mocked(updateCommunity).mockResolvedValueOnce(undefined);

    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    const updateData = { displayName: 'Does Not Exist' };

    await agent
      .put('/api/admin/communities/999')
      .send(updateData)
      .expect(404);
  });

  test('handles non-existent community deletion gracefully', async () => {
    const { listCommunities } = await import('../../server/reddit-communities.ts');
    // Mock empty communities list to simulate non-existent community
    vi.mocked(listCommunities).mockResolvedValueOnce([]);

    await loginAs(adminUser);

    if (!agent) {
      throw new Error('Agent not initialized');
    }

    await agent
      .delete('/api/admin/communities/999')
      .expect(404);
  });
});
