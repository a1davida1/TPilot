import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { storage } from '../../server/storage.ts';
import type { User } from '../../shared/schema.ts';

type AuthRequest = import('../../server/middleware/auth.ts').AuthRequest;

interface Perk {
  id: string;
  name: string;
  category: string;
  tier: string;
  description: string;
  signupProcess: string;
  estimatedEarnings: string;
  status: string;
  features: string[];
  commissionRate?: string;
  requirements?: string[];
  officialLink?: string;
}

// Mock auth module to simulate different authentication states
interface MockUser {
  id: number;
  subscriptionTier?: string;
  username: string;
  tier?: string;
}

const mockUsers = new Map<number, MockUser>();
let currentMockUser: MockUser | null = null;
let useRealAuthMiddleware = false;

const dbWhereMock = vi.hoisted(() => vi.fn().mockResolvedValue([] as Array<AuthRequest['user']>));
const dbMock = vi.hoisted(() => {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: dbWhereMock
  };

  return chain;
});

vi.mock('../../server/db.ts', () => ({
  db: dbMock
}));

const { getActualAuthModule } = vi.hoisted(() => {
  let cachedModule: typeof import('../../server/middleware/auth.ts') | null = null;

  return {
    getActualAuthModule: async () => {
      if (!cachedModule) {
        cachedModule = await vi.importActual<typeof import('../../server/middleware/auth.ts')>(
          '../../server/middleware/auth.ts'
        );
      }

      return cachedModule;
    }
  };
});

// Mock the auth middleware to simulate real behavior
const mockAuthMiddleware = vi.fn(async (req: Request, res: Response, next: NextFunction) => {
  if (currentMockUser) {
    (req as AuthRequest).user = currentMockUser as AuthRequest['user'];
    return next();
  }

  if (!useRealAuthMiddleware) {
    return next();
  }

  const actual = await getActualAuthModule();
  return actual.authenticateToken(req as AuthRequest, res, next);
});

// Mock the pro-perks module
vi.mock('../../server/pro-perks.ts', () => ({
  getAvailablePerks: vi.fn(() => [
    {
      id: 'onlyfans-referral',
      name: 'OnlyFans Creator Referral',
      category: 'affiliate',
      tier: 'pro',
      description: 'Earn 5% lifetime commission by referring new creators',
      commissionRate: '5% lifetime',
      signupProcess: 'Auto-approval with tracking link',
      estimatedEarnings: '$100-500/month potential',
      status: 'available',
      officialLink: 'https://onlyfans.com/refer',
      features: ['Lifetime 5% commission', 'Real-time tracking', 'Monthly payments']
    }
  ]),
  generateReferralCode: vi.fn((userId: number, perkId: string) => `TP${userId}${perkId.slice(-4).toUpperCase()}`),
  getSignupInstructions: vi.fn((perkId: string) => ({
    steps: ['Sign up with provided link', 'Complete profile verification', 'Start earning commissions'],
    requirements: ['Active ThottoPilot Pro subscription', 'Verified identity'],
    timeline: 'Instant approval for most creators',
    support: 'Contact support@thottopilot.com for assistance'
  }))
}));

// Mock the authenticateToken middleware
vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: mockAuthMiddleware
}));

// Mock storage for testing fallback behavior
type MockedStorage = {
  getUserById: ReturnType<typeof vi.fn>;
};

vi.mock('../../server/storage.ts', () => ({
  storage: {
    getUserById: vi.fn()
  } as MockedStorage
}));

describe('Pro Resources Integration', () => {
  let app: Express;
  type StoredUser = NonNullable<Awaited<ReturnType<typeof storage.getUserById>>>;

  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalGeminiKey = process.env.GOOGLE_GENAI_API_KEY;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'test-openai-key';
    }
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      process.env.GOOGLE_GENAI_API_KEY = 'test-gemini-key';
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      process.env.SESSION_SECRET = 'test-session-secret-key-1234567890abcd';
    }
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      process.env.JWT_SECRET = 'test-jwt-secret-key-1234567890abcd';
    }
    const defaultDatabaseUrl = 'postgres://user:pass@localhost:5432/testdb';
    if (!process.env.DATABASE_URL || !URL.canParse(process.env.DATABASE_URL)) {
      process.env.DATABASE_URL = defaultDatabaseUrl;
    }
  });

  afterAll(() => {
    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
    if (originalGeminiKey === undefined) {
      delete process.env.GOOGLE_GENAI_API_KEY;
    } else {
      process.env.GOOGLE_GENAI_API_KEY = originalGeminiKey;
    }
    if (originalSessionSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalSessionSecret;
    }
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  const createStoredUser = (tierValue: 'free' | 'starter' | 'pro' | 'premium', overrides?: Partial<StoredUser>): StoredUser => {
    const now = new Date();
    return {
      id: overrides?.id ?? 42,
      username: overrides?.username ?? 'testuser',
      password: overrides?.password ?? 'hashedpassword',
      email: overrides?.email ?? 'test@example.com',
      role: overrides?.role ?? 'user',
      isAdmin: overrides?.isAdmin ?? false,
      emailVerified: overrides?.emailVerified ?? true,
      firstName: overrides?.firstName ?? 'Test',
      lastName: overrides?.lastName ?? 'User',
      tier: tierValue,
      mustChangePassword: overrides?.mustChangePassword ?? false,
      subscriptionStatus: overrides?.subscriptionStatus ?? 'active',
      trialEndsAt: overrides?.trialEndsAt ?? null,
      provider: overrides?.provider ?? null,
      providerId: overrides?.providerId ?? null,
      avatar: overrides?.avatar ?? null,
      bio: overrides?.bio ?? null,
      referralCodeId: overrides?.referralCodeId ?? null,
      referredBy: overrides?.referredBy ?? null,
      redditUsername: overrides?.redditUsername ?? null,
      redditAccessToken: overrides?.redditAccessToken ?? null,
      redditRefreshToken: overrides?.redditRefreshToken ?? null,
      redditId: overrides?.redditId ?? null,
      stripeCustomerId: overrides?.stripeCustomerId ?? null,
      stripeSubscriptionId: overrides?.stripeSubscriptionId ?? null,
      bannedAt: overrides?.bannedAt ?? null,
      suspendedUntil: overrides?.suspendedUntil ?? null,
      banReason: overrides?.banReason ?? null,
      suspensionReason: overrides?.suspensionReason ?? null,
      createdAt: overrides?.createdAt ?? now,
      updatedAt: overrides?.updatedAt ?? now,
      lastLogin: overrides?.lastLogin ?? null,
      passwordResetAt: overrides?.passwordResetAt ?? null,
      deletedAt: overrides?.deletedAt ?? null,
      isDeleted: overrides?.isDeleted ?? false,
      ...overrides
    };
  };

  beforeEach(async () => {
    // Clear mocks and reset state
    vi.clearAllMocks();
    mockUsers.clear();
    currentMockUser = null;
    useRealAuthMiddleware = false;
    dbWhereMock.mockResolvedValue([]);

    // Create Express app with real pro-resources routes
    app = express();
    app.use(express.json());
    
    // Import the real routes function
    const { registerRoutes } = await import('../../server/routes.ts');
    
    // Call registerRoutes to mount all routes including pro-resources
    await registerRoutes(app);
  });

  afterEach(() => {
    vi.clearAllMocks();
    currentMockUser = null;
    useRealAuthMiddleware = false;
  });

  describe('GET /api/pro-resources', () => {
    it('should return 403 for unauthenticated requests', async () => {
      // No user set, should fail authentication
      currentMockUser = null;
      
      const response = await request(app)
        .get('/api/pro-resources')
        .expect(403);

      expect(response.body).toMatchObject({
        perks: [],
        accessGranted: false,
        message: expect.stringContaining('Authentication required')
      });
    });

    it('should return 403 for free tier users', async () => {
      // Set up a free tier user
      currentMockUser = {
        id: 1,
        subscriptionTier: 'free',
        username: 'testuser'
      };

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Authorization', 'Bearer mock-free-token')
        .expect(403);

      expect(response.body).toMatchObject({
        perks: [],
        accessGranted: false,
        message: expect.stringContaining('Pro subscription required')
      });
    });

    it('should return 401 and log a warning for malformed bearer tokens', async () => {
      useRealAuthMiddleware = true;
      const { logger } = await import('../../server/middleware/security.ts');
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => logger);

      try {
        const response = await request(app)
          .get('/api/pro-resources')
          .set('Authorization', 'Bearer mock-free-token')
          .expect(401);

        expect(response.body).toMatchObject({ error: 'Invalid token' });
        expect(errorSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        useRealAuthMiddleware = false;
      }
    });

    it('should return pro resources for authenticated pro users', async () => {
      // Set up a pro tier user
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      expect(response.body).toMatchObject({
        perks: expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(/^[a-z0-9-]+$/),
            name: expect.stringMatching(/.+/),
            category: expect.stringMatching(/^(affiliate|integration|tools|community|pro)$/),
            description: expect.stringMatching(/.+/),
            status: expect.stringMatching(/^(available|application-required|coming-soon)$/),
            features: expect.arrayContaining([])
          })
        ]),
        accessGranted: true
      });

      // Verify that at least one affiliate perk is returned
      const affiliatePerks = response.body.perks.filter((perk: Perk) => perk.category === 'affiliate');
      expect(affiliatePerks.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/pro-resources/:id/signup-instructions', () => {
    it('should return 401 for unauthenticated requests', async () => {
      currentMockUser = null;
      
      await request(app)
        .get('/api/pro-resources/test-perk-id/signup-instructions')
        .expect(401);
    });

    it('should return 403 for free tier users', async () => {
      currentMockUser = {
        id: 1,
        subscriptionTier: 'free',
        username: 'testuser'
      };

      await request(app)
        .get('/api/pro-resources/test-perk-id/signup-instructions')
        .set('Authorization', 'Bearer mock-free-token')
        .expect(403);
    });

    it('should return 404 for non-existent perk', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      await request(app)
        .get('/api/pro-resources/non-existent-perk/signup-instructions')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(404);
    });

    it('should return signup instructions for valid perk and pro user', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      const response = await request(app)
        .get('/api/pro-resources/onlyfans-referral/signup-instructions')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      expect(response.body).toMatchObject({
        instructions: {
          steps: expect.arrayContaining([]),
          requirements: expect.arrayContaining([]),
          timeline: expect.stringMatching(/.+/),
          support: expect.stringMatching(/.+/)
        }
      });

      expect(response.body.instructions.steps.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/pro-resources/:id/referral-code', () => {
    it('should return 401 for unauthenticated requests', async () => {
      currentMockUser = null;
      
      await request(app)
        .post('/api/pro-resources/test-perk-id/referral-code')
        .set('Content-Type', 'application/json')
        .expect(401);
    });

    it('should return 403 for free tier users', async () => {
      currentMockUser = {
        id: 1,
        subscriptionTier: 'free',
        username: 'testuser'
      };

      await request(app)
        .post('/api/pro-resources/test-perk-id/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-free-token')
        .expect(403);
    });

    it('should return 404 for non-existent perk', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      await request(app)
        .post('/api/pro-resources/non-existent-perk/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(404);
    });

    it('should generate referral code for valid perk and pro user', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      const response = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      expect(response.body).toMatchObject({
        referralCode: expect.stringMatching(/^TP\d+/)
      });

      // Verify referral code format matches our mock implementation
      expect(response.body.referralCode).toMatch(/^TP2/);
    });

    it('should generate unique referral codes for different users', async () => {
      // First user
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser1'
      };

      const response1 = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-pro-token1')
        .expect(200);

      // Second user
      currentMockUser = {
        id: 3,
        subscriptionTier: 'pro',
        username: 'prouser2'
      };

      const response2 = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-pro-token2')
        .expect(200);

      // Referral codes should be different for different users
      expect(response1.body.referralCode).not.toBe(response2.body.referralCode);
    });

    it('should fall back to stored tier when session is missing subscription tier', async () => {
      const persistedUserId = 45;
      currentMockUser = {
        id: persistedUserId,
        username: 'fallback-pro'
        // Note: no subscriptionTier field, should trigger fallback
      };

      const { storage } = await import('../../server/storage.ts');
      const storedUser: Partial<User> & { subscriptionTier?: string | null } = {
        id: persistedUserId,
        tier: 'pro'
      };

      const getUserByIdSpy = vi
        .spyOn(storage, 'getUserById')
        .mockResolvedValue(storedUser as User);

      const response = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-storage-tier')
        .expect(200);

      expect(getUserByIdSpy).toHaveBeenCalledWith(persistedUserId);
      expect(response.body).toMatchObject({
        referralCode: expect.stringMatching(/^TP45/)
      });

      getUserByIdSpy.mockRestore();
    });

    it('should return 500 when referral code generation fails', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      // Mock generateReferralCode to throw an error
      const { generateReferralCode } = await import('../../server/pro-perks.ts');
      const generateSpy = vi.mocked(generateReferralCode).mockRejectedValueOnce(new Error('ReferralManager unavailable'));

      const response = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(500);

      expect(response.body).toMatchObject({
        message: 'Failed to generate referral code'
      });

      expect(generateSpy).toHaveBeenCalledWith(2, 'onlyfans-referral');
    });

    it('should allow premium tier users to access pro-tier perks', async () => {
      currentMockUser = {
        id: 100,
        subscriptionTier: 'premium',
        username: 'premiumuser'
      };

      const response = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-premium-token')
        .expect(200);

      expect(response.body).toMatchObject({
        referralCode: expect.stringMatching(/^TP100/)
      });
    });
  });

  describe('Data Validation', () => {
    it('should return perks with correct structure and required fields', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      // Verify each perk has all required fields
      response.body.perks.forEach((perk: Perk) => {
        expect(perk).toMatchObject({
          id: expect.stringMatching(/^[a-z0-9-]+$/),
          name: expect.stringMatching(/.+/),
          category: expect.stringMatching(/^(affiliate|integration|tools|community|pro)$/),
          tier: expect.stringMatching(/^(starter|pro)$/),
          description: expect.stringMatching(/.+/),
          signupProcess: expect.stringMatching(/.+/),
          estimatedEarnings: expect.stringMatching(/.+/),
          status: expect.stringMatching(/^(available|application-required|coming-soon)$/),
          features: expect.arrayContaining([])
        });

        // Optional fields should be proper types when present
        if (perk.commissionRate) {
          expect(typeof perk.commissionRate).toBe('string');
        }
        if (perk.requirements) {
          expect(Array.isArray(perk.requirements)).toBe(true);
        }
        if (perk.officialLink) {
          expect(typeof perk.officialLink).toBe('string');
        }

        // Features array should not be empty
        expect(perk.features.length).toBeGreaterThan(0);
      });
    });

    it('should include at least one affiliate program to prevent regressions', async () => {
      currentMockUser = {
        id: 2,
        subscriptionTier: 'pro',
        username: 'prouser'
      };

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      const affiliatePerks = response.body.perks.filter((perk: Perk) => perk.category === 'affiliate');
      
      // This is the main regression test - ensure at least one affiliate perk exists
      expect(affiliatePerks.length).toBeGreaterThan(0);
      
      // Verify affiliate perks have commission rates
      affiliatePerks.forEach((perk: Perk) => {
        expect(perk.commissionRate || perk.estimatedEarnings).toBeTruthy();
      });
    });
  });

  describe('Storage Fallback Behavior', () => {
    it('should fallback to storage when session lacks subscriptionTier', async () => {
      // User session without subscriptionTier
      currentMockUser = {
        id: 123,
        username: 'fallbackuser',
        tier: 'free' // Only has basic tier, no subscriptionTier
      };

      // Mock storage to return pro user
      const storedUser = createStoredUser('pro', { id: 123 });
      const mockGetUserById = storage.getUserById as ReturnType<typeof vi.fn>;
      mockGetUserById.mockResolvedValue(storedUser);

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toMatchObject({
        perks: expect.arrayContaining([
          expect.objectContaining({
            id: 'onlyfans-referral'
          })
        ]),
        accessGranted: true
      });

      expect(storage.getUserById).toHaveBeenCalledWith(123);
    });

    it('should handle storage errors gracefully', async () => {
      currentMockUser = {
        id: 456,
        username: 'erroruser'
        // No tier information at all
      };

      // Mock storage to throw error
      const mockGetUserById = storage.getUserById as ReturnType<typeof vi.fn>;
      mockGetUserById.mockRejectedValue(new Error('Storage unavailable'));

      const response = await request(app)
        .get('/api/pro-resources')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-token')
        .expect(403);

      expect(response.body).toMatchObject({
        perks: [],
        accessGranted: false,
        message: expect.stringContaining('Pro subscription required')
      });

      expect(storage.getUserById).toHaveBeenCalledWith(456);
    });

    it('should use subscriptionTier from storage when session tier is outdated', async () => {
      currentMockUser = {
        id: 789,
        username: 'outdateduser',
        tier: 'free', // Session shows old tier
        subscriptionTier: undefined // Not yet synced
      };

      // Storage shows updated tier
      const storedUser = createStoredUser('pro', { 
        id: 789,
        tier: 'pro'
      });
      const extendedStoredUser = { ...storedUser, subscriptionTier: 'pro' } as StoredUser & { subscriptionTier: string };
      const mockGetUserById = storage.getUserById as ReturnType<typeof vi.fn>;
      mockGetUserById.mockResolvedValue(extendedStoredUser);

      const response = await request(app)
        .post('/api/pro-resources/onlyfans-referral/referral-code')
        .set('Content-Type', 'application/json')
        .set('Authorization', 'Bearer mock-token')
        .expect(200);

      expect(response.body).toMatchObject({
        referralCode: expect.stringContaining('TP789')
      });

      expect(storage.getUserById).toHaveBeenCalledWith(789);
    });
  });
});