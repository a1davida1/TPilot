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

  beforeAll(async () => {
    const hashed = await bcrypt.hash('TestPassword123', 10);
    const [user] = await db.insert(users).values({
      username: 'testuser',
      email: 'test@example.com',
      password: hashed,
      tier: 'free'
    }).returning();
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
          email: 'test@example.com',
          password: 'TestPassword123'
        });

      // Should set HttpOnly cookie on successful login
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      const authCookie = cookies.find((cookie: string) => cookie.startsWith('authToken='));
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');
      expect(authCookie).toContain('SameSite=Strict');
    });

    it('should accept username login and set auth cookie', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'TestPassword123'
        });

      // Should set HttpOnly cookie on successful login
      expect(response.headers['set-cookie']).toBeDefined();
      const cookies = response.headers['set-cookie'];
      const authCookie = cookies.find((cookie: string) => cookie.startsWith('authToken='));
      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');
    });
  });

  describe('Authentication via Cookies', () => {
    it('should authenticate user via cookie instead of Bearer token', async () => {
      // First login to get cookie
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com', 
          password: 'TestPassword123'
        });

      const cookies = loginResponse.headers['set-cookie'];
      const authCookie = cookies.find((cookie: string) => cookie.startsWith('authToken='));
      
      if (authCookie) {
        // Use cookie for authenticated request
        const userResponse = await request(app)
          .get('/api/auth/user')
          .set('Cookie', authCookie);

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