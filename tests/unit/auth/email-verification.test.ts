/* eslint-env node, jest */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock implementations for storage and email service
type MockTokenRecord = {
  token: string;
  userId: number;
  expiresAt: Date;
};

type MockUserRecord = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
};

const mockTokens = new Map<string, MockTokenRecord>();
const mockUsers = new Map<number, MockUserRecord>();

const mockStorage = vi.hoisted(() => {
  const state = { consumeDelayMs: 0 };
  return {
    getUserByEmail: vi.fn(),
    updateUser: vi.fn(),
    createUser: vi.fn(),
    getVerificationToken: vi.fn(async (token: string) => mockTokens.get(token)),
    deleteVerificationToken: vi.fn(async (token: string) => mockTokens.delete(token)),
    consumeVerificationToken: vi.fn(async (token: string) => {
      const tokenRecord = mockTokens.get(token);
      if (!tokenRecord) {
        return undefined;
      }
      if (tokenRecord.expiresAt < new Date()) {
        return undefined;
      }
      mockTokens.delete(token);
      if (state.consumeDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.consumeDelayMs));
      }
      return tokenRecord;
    }),
    updateUserEmailVerified: vi.fn(async (userId: number, verified: boolean) => {
      const user = mockUsers.get(userId);
      if (user) {
        user.emailVerified = verified;
      }
    }),
    createVerificationToken: vi.fn(async (data: MockTokenRecord) => {
      mockTokens.set(data.token, data);
      return data;
    }),
    getUser: vi.fn(async (id: number) => mockUsers.get(id)),
    __setConsumeDelay: (ms: number) => {
      state.consumeDelayMs = ms;
    }
  };
});

const mockEmailService = vi.hoisted(() => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendWelcomeEmail: vi.fn().mockResolvedValue(true)
}));

vi.mock('../../../server/storage.ts', () => ({ storage: mockStorage }));
vi.mock('../../../server/services/email-service.ts', () => ({ emailService: mockEmailService }));

// Import auth setup after mocking
import { setupAuth } from '../../../server/auth';

describe('Email Verification Unit Tests', () => {
  let app: express.Express;

  beforeEach(() => {
    // Clear all mocks and data
    vi.clearAllMocks();
    mockTokens.clear();
    mockUsers.clear();
    mockStorage.__setConsumeDelay(0);

    mockEmailService.sendVerificationEmail.mockResolvedValue(true);
    mockEmailService.sendWelcomeEmail.mockResolvedValue(true);

    // Setup express app
    app = express();
    app.use(express.json());
    setupAuth(app);
  });

  describe('Token Validation', () => {
    it('should reject missing token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email')
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Token is required');
    });

    it('should reject empty token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email?token=')
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Token is required');
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/verify-email?token=invalid-token-12345')
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledWith('invalid-token-12345');
    });

    it('should reject expired token', async () => {
      const expiredToken = 'expired-token-67890';
      const yesterdayDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      mockTokens.set(expiredToken, {
        token: expiredToken,
        userId: 1,
        expiresAt: yesterdayDate
      });

      const response = await request(app)
        .get('/api/auth/verify-email?token=' + expiredToken)
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
    });

    it('should accept valid unexpired token', async () => {
      const validToken = 'valid-token-abcdef';
      const futureDate = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours from now
      const userId = 123;
      
      // Setup valid token
      mockTokens.set(validToken, {
        token: validToken,
        userId: userId,
        expiresAt: futureDate
      });

      // Setup user
      mockUsers.set(userId, {
        id: userId,
        username: 'testuser',
        email: 'test@example.com',
        emailVerified: false
      });

      const response = await request(app)
        .get('/api/auth/verify-email?token=' + validToken)
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email verified successfully');
      expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(userId, true);
      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledWith(validToken);
      expect(mockTokens.has(validToken)).toBe(false);
    });
  });

  describe('User State Updates', () => {
    it('should mark user as verified after successful token validation', async () => {
      const token = 'verification-token-123';
      const userId = 456;
      const futureDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now
      
      mockTokens.set(token, {
        token: token,
        userId: userId,
        expiresAt: futureDate
      });

      mockUsers.set(userId, {
        id: userId,
        username: 'newuser',
        email: 'new@example.com',
        emailVerified: false
      });

      await request(app)
        .get('/api/auth/verify-email?token=' + token);

      // Verify the user was marked as verified
      expect(mockStorage.updateUserEmailVerified).toHaveBeenCalledWith(userId, true);

      // Verify the token was cleaned up
      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledWith(token);
      expect(mockTokens.has(token)).toBe(false);
    });

    it('should cleanup verification token after successful verification', async () => {
      const token = 'cleanup-test-token';
      const userId = 789;
      const futureDate = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now
      
      mockTokens.set(token, {
        token: token,
        userId: userId,
        expiresAt: futureDate
      });

      mockUsers.set(userId, {
        id: userId,
        username: 'cleanupuser',
        email: 'cleanup@example.com',
        emailVerified: false
      });

      await request(app)
        .get('/api/auth/verify-email?token=' + token);

      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledWith(token);
      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledTimes(1);
      expect(mockTokens.has(token)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed tokens gracefully', async () => {
      const malformedTokens = [
        'token with spaces',
        'token\nwith\nnewlines',
        'token\twith\ttabs',
        'token<script>alert("xss")</script>',
        '../../etc/passwd',
        'null',
        'undefined',
        '0',
        'false'
      ];

      for (const malformedToken of malformedTokens) {
        const response = await request(app)
          .get('/api/auth/verify-email?token=' + encodeURIComponent(malformedToken))
          .set('Accept', 'application/json'); // Force JSON response for testing
        
        expect(response.status).toBe(400);
        expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
      }
    });

    it('should handle extremely long tokens', async () => {
      const longToken = 'a'.repeat(10000); // 10KB token
      
      const response = await request(app)
        .get('/api/auth/verify-email?token=' + longToken)
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
    });

    it('should handle SQL injection attempts in token', async () => {
      const sqlInjectionTokens = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "1' UNION SELECT * FROM users --"
      ];

      for (const injectionToken of sqlInjectionTokens) {
        const response = await request(app)
          .get('/api/auth/verify-email?token=' + encodeURIComponent(injectionToken))
          .set('Accept', 'application/json'); // Force JSON response for testing
        
        expect(response.status).toBe(400);
        expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
      }
    });
  });

  describe('Rate Limiting Boundary Tests', () => {
    it('should handle multiple concurrent verification requests', async () => {
      const token = 'concurrent-test-token';
      const userId = 999;
      const futureDate = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour from now

      mockTokens.set(token, {
        token: token,
        userId: userId,
        expiresAt: futureDate
      });

      mockUsers.set(userId, {
        id: userId,
        username: 'concurrentuser',
        email: 'concurrent@example.com',
        emailVerified: false
      });

      mockStorage.__setConsumeDelay(25);

      // Send requests with JSON Accept header for consistent testing
      const jsonPromises = Array.from({ length: 5 }, () =>
        request(app)
          .get('/api/auth/verify-email?token=' + token)
          .set('Accept', 'application/json')
      );

      const jsonResponses = await Promise.all(jsonPromises);

      const successResponses = jsonResponses.filter(response => response.status === 200);
      expect(successResponses).toHaveLength(1);

      jsonResponses
        .filter(response => response.status !== 200)
        .forEach(response => {
          expect(response.status).toBe(400);
        });

      expect(mockStorage.consumeVerificationToken).toHaveBeenCalledTimes(5);
      expect(mockTokens.has(token)).toBe(false);
    });
  });

  describe('Token Expiration Edge Cases', () => {
    it('should reject token that expires exactly now', async () => {
      const token = 'edge-expiry-token';
      const exactlyNow = new Date();
      
      mockTokens.set(token, {
        token: token,
        userId: 111,
        expiresAt: exactlyNow
      });

      // Small delay to ensure the token is "expired" when checked
      await new Promise(resolve => setTimeout(resolve, 1));

      const response = await request(app)
        .get('/api/auth/verify-email?token=' + token)
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(400);
      expect(response.body.message ?? response.body.error).toBe('Invalid or expired token');
    });

    it('should accept token that expires in 1 minute', async () => {
      const token = 'soon-expiry-token';
      const oneMinuteFromNow = new Date(Date.now() + 60 * 1000); // 1 minute from now
      const userId = 222;
      
      mockTokens.set(token, {
        token: token,
        userId: userId,
        expiresAt: oneMinuteFromNow
      });

      mockUsers.set(userId, {
        id: userId,
        username: 'soonexpiry',
        email: 'soon@example.com',
        emailVerified: false
      });

      const response = await request(app)
        .get('/api/auth/verify-email?token=' + token)
        .set('Accept', 'application/json'); // Force JSON response for testing
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Email verified successfully');
    });
  });
});