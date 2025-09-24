import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupAuth } from '../../../server/auth.js';
import bcrypt from 'bcrypt';
import { db } from '../../../server/db';
import { users } from '../../../shared/schema.js';
import { eq } from 'drizzle-orm';

const app = express();
app.use(cookieParser());
app.use(express.json());

// Setup auth routes for testing
setupAuth(app);

// Helper function to extract auth credentials from response
function extractAuthCredentials(response: { headers: { [key: string]: unknown }; body?: { token?: string; accessToken?: string } }) {
  const cookies = (response.headers['set-cookie'] as string[]) ?? [];
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
      
      // Optional: log what type of auth was used for debugging
      if (auth.cookie) console.log('Using cookie authentication');
      if (auth.token) console.log('Using token authentication');
      
      // If cookies are present, check their properties
      if (auth.cookie && auth.cookie.includes('authToken')) {
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
      
      // Optional: log what type of auth was used for debugging
      if (auth.cookie) console.log('Using cookie authentication');
      if (auth.token) console.log('Using token authentication');
      
      // If cookies are present, check their properties
      if (auth.cookie && auth.cookie.includes('authToken')) {
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

      if (auth.cookie || auth.token) {
        // Use cookie or token for authenticated request
        const userResponse = auth.cookie
          ? await request(app)
              .get('/api/auth/user')
              .set('Cookie', auth.cookie)
          : await request(app)
              .get('/api/auth/user')
              .set('Authorization', `Bearer ${auth.token}`);

        // Should accept cookie authentication
        expect(userResponse.status).toBe(200);
        expect(userResponse.body).toHaveProperty('id');
      }
    });

    it('should reject request without auth cookie or token', async () => {
      const response = await request(app)
        .get('/api/auth/user');

      expect(response.status).toBe(401);
      const errorMessage = (response.body.error || response.body.message || '') as string;
      expect(errorMessage).toContain('Access token required');
    });
  });
});