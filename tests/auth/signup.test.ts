/* eslint-env node, jest */
import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory stores for mocking  
const users: Array<Record<string, unknown>> = [];
const tokens: Array<Record<string, unknown>> = [];

vi.mock('../../server/storage.js', () => ({
  storage: {
    getUser: vi.fn().mockImplementation(async (id: number) => users.find(u => u.id === id)),
    getUserByUsername: vi.fn().mockImplementation(async (username: string) => users.find(u => u.username === username)),
    getUserByEmail: vi.fn().mockImplementation(async (email: string) => users.find(u => u.email === email)),
    updateUser: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const user = { id: users.length + 1, emailVerified: false, ...data };
      users.push(user);
      return user;
    }),
    updateUserEmailVerified: vi.fn().mockImplementation(async (userId: number, verified: boolean) => {
      const user = users.find(u => u.id === userId);
      if (user) user.emailVerified = verified;
    }),
    createVerificationToken: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
      const token = { id: tokens.length + 1, ...data };
      tokens.push(token);
      return token;
    }),
    getVerificationToken: vi.fn().mockImplementation(async (token: string) => tokens.find(t => t.token === token)),
    consumeVerificationToken: vi.fn().mockImplementation(async (token: string) => {
      const found = tokens.find(t => t.token === token);
      if (!found) return null;
      const idx = tokens.findIndex(t => t.token === token);
      if (idx !== -1) tokens.splice(idx, 1);
      return found;
    }),
    deleteVerificationToken: vi.fn().mockImplementation(async (token: string) => {
      const idx = tokens.findIndex(t => t.token === token);
      if (idx !== -1) tokens.splice(idx, 1);
    })
  }
}));

vi.mock('../../server/services/email-service.js', () => ({
  emailService: { 
    sendPasswordResetEmail: vi.fn(), 
    sendWelcomeEmail: vi.fn(),
    sendVerificationEmail: vi.fn().mockResolvedValue(true)
  }
}));

import { setupAuth } from '../../server/auth';

describe('Signup and email verification', () => {
  beforeEach(() => {
    users.length = 0;
    tokens.length = 0;
    vi.clearAllMocks();
  });

  it('verifies email before allowing login', async () => {
    const app = express();
    app.use(express.json());
    setupAuth(app);

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'alice', password: 'Password123!', email: 'alice@example.com' });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.message).toMatch(/verification email sent/i);
    
    const { emailService } = await import('../../server/services/email-service');
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();

    const token = tokens[0].token;

    const loginBefore = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Password123!' });
    expect(loginBefore.status).toBe(403);

    const verifyRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect([200, 302]).toContain(verifyRes.status);

    const loginAfter = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'Password123!' });
    expect(loginAfter.status).toBe(200);
    expect(loginAfter.body.token).toBeDefined();
  });

  it('sets a secure auth cookie on production signup', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const app = express();
      app.use(express.json());
      setupAuth(app);

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({ username: 'bob', password: 'Password123!', email: 'bob@example.com' });

      expect(signupRes.status).toBe(201);
      const cookies = signupRes.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const authCookie = cookies?.find(cookie => cookie.startsWith('authToken='));
      expect(authCookie).toBeDefined();
      expect(authCookie).toMatch(/HttpOnly/i);
      expect(authCookie).toMatch(/Secure/i);
      expect(authCookie).toMatch(/SameSite=Strict/i);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});