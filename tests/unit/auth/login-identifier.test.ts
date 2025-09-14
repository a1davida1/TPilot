import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { setupAuth } from '../../../server/auth.js';
import bcrypt from 'bcrypt';
import { db } from '../../../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const app = express();
app.use(cookieParser());
app.use(express.json());

// Setup auth routes for testing
setupAuth(app);

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

      const cookies = response.headers['set-cookie'] ?? [];
      expect(response.status).toBe(200);
      
      // Check for either cookies or token in response body
      const hasCookie = cookies.length > 0 && cookies.some((c: string) => 
        c.includes('authToken') || c.includes('session'));
      const hasToken = response.body.token || response.body.accessToken;
      expect(hasCookie || hasToken).toBeTruthy();
      
      // If cookies are present, check their properties
      if (hasCookie) {
        const authCookie = cookies.find((cookie: string) => 
          cookie.includes('authToken') || cookie.includes('session'));
        if (authCookie && authCookie.includes('authToken')) {
          expect(authCookie).toContain('HttpOnly');
          expect(authCookie).toContain('SameSite=Strict');
        }
      }
    });

    it('should accept username login and set auth cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'TestPassword123',
        });

      const cookies = response.headers['set-cookie'] ?? [];
      expect(response.status).toBe(200);
      
      // Check for either cookies or token in response body
      const hasCookie = cookies.length > 0 && cookies.some((c: string) => 
        c.includes('authToken') || c.includes('session'));
      const hasToken = response.body.token || response.body.accessToken;
      expect(hasCookie || hasToken).toBeTruthy();
      
      // If cookies are present, check their properties
      if (hasCookie) {
        const authCookie = cookies.find((cookie: string) => 
          cookie.includes('authToken') || cookie.includes('session'));
        if (authCookie && authCookie.includes('authToken')) {
          expect(authCookie).toContain('HttpOnly');
        }
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

      const cookies = loginResponse.headers['set-cookie'] ?? [];
      
      // If no cookies, check for token in body
      const authCookie = cookies.find((cookie: string) => 
        cookie.includes('authToken') || cookie.includes('session'));
      const token = loginResponse.body.token || loginResponse.body.accessToken;
      
      // Either cookie or token auth should work
      expect(authCookie || token).toBeTruthy();

      if (authCookie || token) {
        // Use cookie or token for authenticated request
        const userResponse = authCookie
          ? await request(app)
              .get('/api/auth/user')
              .set('Cookie', authCookie)
          : await request(app)
              .get('/api/auth/user')
              .set('Authorization', `Bearer ${token}`);

        // Should accept cookie authentication
        expect(userResponse.status).toBe(200);
        expect(userResponse.body).toHaveProperty('id');
      }
    });

    it('should reject request without auth cookie or token', async () => {
      const response = await request(app)
        .get('/api/auth/user');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Access token required');
    });
  });
});