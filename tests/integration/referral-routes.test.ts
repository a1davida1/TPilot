import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.js';
import { ReferralManager } from '../../server/lib/referral-system.js';

// Mock the ReferralManager to avoid database dependencies
vi.mock('../../server/lib/referral-system.js', () => ({
  ReferralManager: {
    getUserReferralCode: vi.fn(),
    getReferralInfo: vi.fn(),
    applyReferralCode: vi.fn()
  }
}));

// Mock logger to avoid console noise
vi.mock('../../server/bootstrap/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock authentication middleware to bypass JWT issues in tests
vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn((req: { headers: { authorization?: string }; user?: unknown }, res: { status: (code: number) => { json: (data: unknown) => unknown } }, next: () => unknown) => {
    // Mock user for authenticated requests
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      req.user = { 
        id: 1, 
        username: 'testuser', 
        email: 'test@example.com',
        tier: 'pro',
        emailVerified: true
      };
      return next();
    }
    // No auth header - return 401
    return res.status(401).json({ error: 'Authentication required' });
  })
}));

// Mock database to avoid real DB calls
vi.mock('../../server/db.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([
            { id: 1, username: 'testuser', tier: 'pro', emailVerified: true }
          ]))
        }))
      }))
    }))
  }
}));

describe('Referral Routes Integration Tests', () => {
  let app: Express.Application;
  let mockReferralManager: typeof ReferralManager;
  const validJwtSecret = 'test-jwt-secret-key-for-testing-that-is-long-enough-for-validation-requirements';
  const validUserId = 1;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Mock required environment variables
    process.env.JWT_SECRET = validJwtSecret;
    process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-for-validation-requirements-32-chars-minimum';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '5000';
    
    // Create app instance
    const { app: testApp } = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false
    });
    app = testApp;
    
    mockReferralManager = ReferralManager as typeof ReferralManager;
  });

  const createAuthToken = (userId: number = validUserId): string => {
    return jwt.sign(
      { 
        id: userId, 
        username: 'testuser',
        email: 'test@example.com' 
      },
      validJwtSecret,
      { expiresIn: '1h' }
    );
  };

  describe('GET /api/referral/code', () => {
    it('should return referral code and URL for authenticated user', async () => {
      const mockReferralCode = 'THOTTO123456';
      mockReferralManager.getUserReferralCode = vi.fn().mockResolvedValue(mockReferralCode);
      
      const token = createAuthToken();
      
      const response = await request(app)
        .get('/api/referral/code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({
        referralCode: mockReferralCode,
        referralUrl: expect.stringContaining(`/signup?ref=${mockReferralCode}`)
      });
      
      expect(mockReferralManager.getUserReferralCode).toHaveBeenCalledWith(validUserId);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/referral/code')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should handle ReferralManager errors gracefully', async () => {
      mockReferralManager.getUserReferralCode = vi.fn().mockRejectedValue(new Error('Database error'));
      
      const token = createAuthToken();
      
      const response = await request(app)
        .get('/api/referral/code')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to retrieve referral code'
      });
    });

    it('should return same referral code on multiple calls', async () => {
      const mockReferralCode = 'THOTTO789012';
      mockReferralManager.getUserReferralCode = vi.fn().mockResolvedValue(mockReferralCode);
      
      const token = createAuthToken();
      
      // First call
      const response1 = await request(app)
        .get('/api/referral/code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Second call
      const response2 = await request(app)
        .get('/api/referral/code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response1.body.referralCode).toBe(mockReferralCode);
      expect(response2.body.referralCode).toBe(mockReferralCode);
      expect(mockReferralManager.getUserReferralCode).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/referral/summary', () => {
    it('should return referral summary for authenticated user', async () => {
      const mockReferralInfo = {
        referralCode: 'THOTTO123456',
        totalReferrals: 5,
        activeReferrals: 3,
        totalCommission: 150.00,
        conversionRate: 0.6
      };
      
      mockReferralManager.getReferralInfo = vi.fn().mockResolvedValue(mockReferralInfo);
      
      const token = createAuthToken();
      
      const response = await request(app)
        .get('/api/referral/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual(mockReferralInfo);
      expect(mockReferralManager.getReferralInfo).toHaveBeenCalledWith(validUserId);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/referral/summary')
        .expect(401);

      expect(response.body).toEqual({
        error: 'Authentication required'
      });
    });

    it('should handle ReferralManager errors gracefully', async () => {
      mockReferralManager.getReferralInfo = vi.fn().mockRejectedValue(new Error('Database error'));
      
      const token = createAuthToken();
      
      const response = await request(app)
        .get('/api/referral/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to retrieve referral summary'
      });
    });
  });

  describe('POST /api/referral/apply', () => {
    it('should apply referral code successfully', async () => {
      const referralCode = 'THOTTO789012';
      const mockResult = {
        success: true,
        referrerId: 42,
        pending: false
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'new-user@example.com' } })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Referral code applied successfully',
        referrerId: 42,
        status: 'linked'
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenCalledWith({ email: 'new-user@example.com' }, referralCode);
    });

    it('should return 400 for missing referral code', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ applicant: { email: 'missing-code@example.com' } })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Referral code is required'
      });
    });

    it('should return 400 for invalid referral code type', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 123, applicant: { email: 'bad-type@example.com' } })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Referral code is required'
      });
    });

    it('should return 400 when applicant information is missing', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO123456' })
        .expect(400);

      expect(response.body).toEqual({
        error: 'Applicant identifier is required'
      });
    });

    it('should normalize referral code casing before forwarding to the manager', async () => {
      const referralCode = 'thotto654321';
      const mockResult = {
        success: true,
        referrerId: 52,
        pending: true
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'case-test@example.com' } })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Referral recorded for pending signup',
        referrerId: 52,
        status: 'recorded'
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenCalledWith({ email: 'case-test@example.com' }, 'THOTTO654321');
    });

    it('should handle failed referral application', async () => {
      const referralCode = 'INVALID123';
      const mockResult = {
        success: false,
        error: 'Invalid referral code'
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'new-user@example.com' } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid referral code'
      });
    });

    it('should handle ReferralManager errors gracefully', async () => {
      mockReferralManager.applyReferralCode = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO123456', applicant: { email: 'new-user@example.com' } })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error while applying referral code'
      });
    });
  });

  describe('Endpoint data consistency', () => {
    it('should return consistent referral code across different endpoints', async () => {
      const mockReferralCode = 'THOTTO555777';
      const mockReferralInfo = {
        referralCode: mockReferralCode,
        totalReferrals: 2,
        activeReferrals: 1,
        totalCommission: 50.00,
        conversionRate: 0.5
      };
      
      mockReferralManager.getUserReferralCode = vi.fn().mockResolvedValue(mockReferralCode);
      mockReferralManager.getReferralInfo = vi.fn().mockResolvedValue(mockReferralInfo);
      
      const token = createAuthToken();
      
      // Get referral code
      const codeResponse = await request(app)
        .get('/api/referral/code')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Get referral summary
      const summaryResponse = await request(app)
        .get('/api/referral/summary')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify codes match
      expect(codeResponse.body.referralCode).toBe(mockReferralCode);
      expect(summaryResponse.body.referralCode).toBe(mockReferralCode);
    });
  });
});