import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import type { Express } from 'express';

// Mock auth module to simulate different authentication states
const mockUsers = new Map<number, any>();
let currentMockUser: any = null;

// Mock the auth middleware to simulate real behavior
const mockAuthMiddleware = vi.fn((req: any, res: any, next: any) => {
  if (currentMockUser) {
    req.user = currentMockUser;
  }
  next();
});

// Mock the pro-perks module
vi.mock('../../server/pro-perks.js', () => ({
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
vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: mockAuthMiddleware
}));

describe('Pro Resources Integration', () => {
  let app: Express;

  beforeEach(async () => {
    // Clear mocks and reset state
    vi.clearAllMocks();
    mockUsers.clear();
    currentMockUser = null;
    
    // Create Express app with real pro-resources routes
    app = express();
    app.use(express.json());
    
    // Import the real routes function
    const { registerRoutes } = await import('../../server/routes.js');
    
    // Call registerRoutes to mount all routes including pro-resources
    await registerRoutes(app, '/api');
  });

  afterEach(() => {
    vi.clearAllMocks();
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
            id: expect.any(String),
            name: expect.any(String),
            category: expect.stringMatching(/^(affiliate|integration|tools|community|pro)$/),
            description: expect.any(String),
            status: expect.stringMatching(/^(available|application-required|coming-soon)$/),
            features: expect.any(Array)
          })
        ]),
        accessGranted: true
      });

      // Verify that at least one affiliate perk is returned
      const affiliatePerks = response.body.perks.filter((perk: any) => perk.category === 'affiliate');
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
          steps: expect.any(Array),
          requirements: expect.any(Array),
          timeline: expect.any(String),
          support: expect.any(String)
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
        .set('Authorization', 'Bearer mock-pro-token')
        .expect(200);

      expect(response.body).toMatchObject({
        referralCode: expect.any(String)
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
        .set('Authorization', 'Bearer mock-pro-token2')
        .expect(200);

      // Referral codes should be different for different users
      expect(response1.body.referralCode).not.toBe(response2.body.referralCode);
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
      response.body.perks.forEach((perk: any) => {
        expect(perk).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          category: expect.stringMatching(/^(affiliate|integration|tools|community|pro)$/),
          tier: expect.stringMatching(/^(starter|pro)$/),
          description: expect.any(String),
          signupProcess: expect.any(String),
          estimatedEarnings: expect.any(String),
          status: expect.stringMatching(/^(available|application-required|coming-soon)$/),
          features: expect.any(Array)
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

      const affiliatePerks = response.body.perks.filter((perk: any) => perk.category === 'affiliate');
      
      // This is the main regression test - ensure at least one affiliate perk exists
      expect(affiliatePerks.length).toBeGreaterThan(0);
      
      // Verify affiliate perks have commission rates
      affiliatePerks.forEach((perk: any) => {
        expect(perk.commissionRate || perk.estimatedEarnings).toBeTruthy();
      });
    });
  });
});