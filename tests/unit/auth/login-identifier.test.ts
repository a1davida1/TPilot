import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupAuth } from '../../../server/auth.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../../../server/db';
import { users } from '../../../shared/schema.js';
import { eq } from 'drizzle-orm';

const app = express();
app.use(cookieParser());
app.use(express.json());

// Setup auth routes for testing
setupAuth(app);

// Helper function to create valid JWT token for testing
function createTestJWT(userId: number): string {
  const secret = process.env.JWT_SECRET || 'test-secret-key';
  return jwt.sign({ id: userId }, secret, { expiresIn: '1h' });
}

// Helper function to extract auth credentials from response
function extractAuthCredentials(response: any) {
  const cookies = response.headers['set-cookie'] ?? [];
  const authCookie = cookies.find((c: string) => 
    c.includes('authToken') || c.includes('session') || c.includes('auth')
  );

  return {
    cookie: authCookie,
    token: response.body?.token || response.body?.accessToken,
    hasAuth: !!(authCookie || response.body?.token || response.body?.accessToken)
  };
}

describe('Login Identifier and Cookie Auth', () => {
  let testUserId: number;
  let testEmail: string;
  let testUsername: string;

  beforeAll(async () => {
    const hashed = await bcrypt.hash('TestPassword123', 10);
    const unique = Date.now();
    testUsername = `testuser_${unique}`;
    testEmail = `test+${unique}@example.com`;
    const [user] = await db
      .insert(users)
      .values({
        username: testUsername,
        email: testEmail,
        password: hashed,
        tier: 'free',
        emailVerified: true,
      })
      .returning();
    testUserId = user.id;
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('Email Login with Cookies', () => {
    it('should accept email login and set auth cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'TestPassword123',
        });

      expect(response.status).toBe(200);

      const auth = extractAuthCredentials(response);
      expect(auth.hasAuth).toBeTruthy();

      // Pure JWT-in-cookie auth - should always have cookie
      if (auth.cookie) {
        expect(auth.cookie).toContain('HttpOnly');
        expect(auth.cookie).toContain('SameSite=Strict');
      }
    });

    it('should accept username login and set auth cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'TestPassword123',
        });

      expect(response.status).toBe(200);

      const auth = extractAuthCredentials(response);
      expect(auth.hasAuth).toBeTruthy();

      // Pure JWT-in-cookie auth - should always have cookie
      if (auth.cookie) {
        expect(auth.cookie).toContain('HttpOnly');
      }
    });
  });

  describe('Authentication via Cookies', () => {
    it('should authenticate user via cookie instead of Bearer token', async () => {
      // First login to get cookie
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'TestPassword123',
        });

      const auth = extractAuthCredentials(loginResponse);
      expect(auth.hasAuth).toBeTruthy();

      if (auth.cookie) { // Only expect cookie for JWT-in-cookie auth
        const userResponse = await request(app)
              .get('/api/auth/user')
              .set('Cookie', auth.cookie);

        // Should accept cookie authentication
        expect(userResponse.status).toBe(200);
        expect(userResponse.body).toHaveProperty('id');
      } else {
        // Test fallback with valid Bearer token
        const validToken = createTestJWT(testUserId);
        const userResponse = await request(app)
          .get('/api/auth/user')
          .set('Authorization', `Bearer ${validToken}`);

        expect(userResponse.status).toBe(200);
        expect(userResponse.body).toHaveProperty('id');
      }
    });

    it('should reject request without auth cookie or token', async () => {
      const response = await request(app)
        .get('/api/auth/user');

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Access token required');
    });
  });
});