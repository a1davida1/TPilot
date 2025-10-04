import type Express from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.ts';
import { ReferralManager } from '../../server/lib/referral-system.ts';

type MockAuthRequest = {
  headers: {
    authorization?: string | string[];
  };
  user?: Record<string, unknown>;
};

type MockResponse = {
  status: (code: number) => { json: (data: unknown) => unknown };
};

const validUserId = 1;

// Mock the ReferralManager to avoid database dependencies
vi.mock('../../server/lib/referral-system.ts', () => ({
  ReferralManager: {
    getUserReferralCode: vi.fn(),
    getReferralInfo: vi.fn(),
    applyReferralCode: vi.fn()
  }
}));

// Mock logger to avoid console noise
vi.mock('../../server/bootstrap/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock authentication middleware to provide optional authentication handling
vi.mock('../../server/middleware/auth.ts', () => {
  const mockUser = {
    id: validUserId,
    username: 'testuser',
    email: 'test@example.com',
    tier: 'pro',
    emailVerified: true,
  };

  const extractAuthHeader = (req: MockAuthRequest): string | undefined => {
    const value = req.headers['authorization'];
    return Array.isArray(value) ? value[0] : value;
  };

  const requiredAuthMiddleware = vi.fn((req: MockAuthRequest, res: MockResponse, next: () => unknown) => {
    const header = extractAuthHeader(req);
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      req.user = { ...mockUser };
      return next();
    }
    return res.status(401).json({ error: 'Authentication required' });
  });

  const optionalAuthMiddleware = vi.fn((req: MockAuthRequest, _res: MockResponse, next: () => unknown) => {
    const header = extractAuthHeader(req);
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      req.user = { ...mockUser };
    }
    return next();
  });

  const authenticateToken = vi.fn((arg: unknown, res?: MockResponse, next?: () => unknown) => {
    if (typeof arg === 'boolean') {
      return arg ? requiredAuthMiddleware : optionalAuthMiddleware;
    }

    if (!res || !next) {
      throw new Error('authenticateToken mock requires response and next when called directly');
    }

    return requiredAuthMiddleware(arg as MockAuthRequest, res, next);
  });

  return {
    authenticateToken,
  };
});

let selectResult: unknown[] = [];
const setSelectResult = (rows: unknown[]): void => {
  selectResult = rows;
};

vi.mock('../../server/db.ts', () => {
  const buildSelectChain = () => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => selectResult),
      })),
    })),
  });

  return {
    db: {
      select: vi.fn(() => buildSelectChain()),
      update: vi.fn(),
      insert: vi.fn(),
    },
    __setMockSelectResult: setSelectResult,
  };
});

describe('Referral Routes Integration Tests', () => {
  let app: Express.Application;
  let mockReferralManager: typeof ReferralManager;
  let setMockDbSelectResult: (rows: unknown[]) => void;
  const validJwtSecret = 'test-jwt-secret-key-for-testing-that-is-long-enough-for-validation-requirements';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock required environment variables
    process.env.JWT_SECRET = validJwtSecret;
    process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough-for-validation-requirements-32-chars-minimum';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test_db';
    process.env.NODE_ENV = 'test';
    process.env.PORT = '5000';

    const dbModule = await import('../../server/db.ts');
    setMockDbSelectResult = (dbModule as unknown as { __setMockSelectResult: (rows: unknown[]) => void }).__setMockSelectResult;
    setMockDbSelectResult([]);

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
    it('should apply referral code successfully for anonymous user with temporary ID', async () => {
      const referralCode = 'THOTTO789012';
      const mockResult = {
        success: true,
        referrerId: 42,
        pending: false
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'new-user@example.com', temporaryUserId: 'tmp-42' } })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        status: 'linked',
        referrerId: 42
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenCalledWith({
        email: 'new-user@example.com',
        temporaryUserId: 'tmp-42'
      }, 'THOTTO789012');
    });

    it('should return 400 for missing referral code', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ applicant: { email: 'missing-code@example.com', temporaryUserId: 'tmp-1' } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Referral code is required'
      });
    });

    it('should return 400 for invalid referral code type', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 123, applicant: { email: 'bad-type@example.com', temporaryUserId: 'tmp-2' } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Referral code must be a string'
      });
    });

    it('should return 400 when applicant information is missing', async () => {
      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO123456' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Applicant information is required'
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
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'case-test@example.com', temporaryUserId: 'tmp-3' } })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        status: 'recorded',
        referrerId: 52
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenCalledWith({
        email: 'case-test@example.com',
        temporaryUserId: 'tmp-3'
      }, 'THOTTO654321');
    });

    it('should handle failed referral application', async () => {
      const referralCode = 'INVALID123';
      const mockResult = {
        success: false,
        error: 'Invalid referral code'
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode, applicant: { email: 'new-user@example.com', temporaryUserId: 'tmp-4' } })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid referral code'
      });
    });

    it('should handle ReferralManager errors gracefully', async () => {
      mockReferralManager.applyReferralCode = vi.fn().mockRejectedValue(new Error('Database error'));
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO123456', applicant: { email: 'new-user@example.com', temporaryUserId: 'tmp-5' } })
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error while applying referral code'
      });
    });

    it('should accept temporary user identifiers when provided', async () => {
      const referralCode = 'thotto000111';
      const mockResult = {
        success: true,
        referrerId: 101,
        pending: true
      };

      mockReferralManager.applyReferralCode = vi.fn().mockResolvedValue(mockResult);
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({
          referralCode,
          applicant: { email: 'temp-user@example.com', temporaryUserId: ' temp-123 ' }
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        status: 'recorded',
        referrerId: 101
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenCalledWith({
        email: 'temp-user@example.com',
        temporaryUserId: 'temp-123'
      }, 'THOTTO000111');
    });

    it('should reject anonymous referral applications without a temporary identifier', async () => {
      mockReferralManager.applyReferralCode = vi.fn();
      setMockDbSelectResult([]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO123999', applicant: { email: 'no-temp@example.com' } })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Temporary user identifier required for anonymous referral code applications.'
      });
      expect(mockReferralManager.applyReferralCode).not.toHaveBeenCalled();
    });

    it('should reject anonymous referrals when email belongs to an existing user', async () => {
      mockReferralManager.applyReferralCode = vi.fn();
      setMockDbSelectResult([{ id: 99 }]);

      const response = await request(app)
        .post('/api/referral/apply')
        .send({ referralCode: 'THOTTO321654', applicant: { email: 'existing@example.com', temporaryUserId: 'tmp-6' } })
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: 'Please log in to apply a referral code for this account.'
      });
      expect(mockReferralManager.applyReferralCode).not.toHaveBeenCalled();
    });

    it('should allow authenticated users to apply a referral once and reject duplicates', async () => {
      setMockDbSelectResult([]);
      mockReferralManager.applyReferralCode = vi.fn()
        .mockResolvedValueOnce({ success: true, referrerId: 77, pending: false })
        .mockResolvedValueOnce({ success: false, error: 'Referral code already applied' });

      const token = createAuthToken();

      const firstResponse = await request(app)
        .post('/api/referral/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({ referralCode: 'applyonce', applicant: { email: 'authenticated@example.com' } })
        .expect(200);

      expect(firstResponse.body).toEqual({
        success: true,
        status: 'linked',
        referrerId: 77
      });

      const secondResponse = await request(app)
        .post('/api/referral/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({ referralCode: 'applyonce', applicant: { email: 'authenticated@example.com' } })
        .expect(400);

      expect(secondResponse.body).toEqual({
        success: false,
        error: 'Referral code already applied'
      });

      expect(mockReferralManager.applyReferralCode).toHaveBeenNthCalledWith(1, { userId: validUserId }, 'APPLYONCE');
      expect(mockReferralManager.applyReferralCode).toHaveBeenNthCalledWith(2, { userId: validUserId }, 'APPLYONCE');
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
