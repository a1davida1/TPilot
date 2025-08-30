import request from 'supertest';
import express from 'express';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory stores for mocking  
const users: any[] = [];
const tokens: any[] = [];

vi.mock('../../server/storage', () => ({
  storage: {
    getUserByUsername: vi.fn().mockImplementation(async (username: string) => users.find(u => u.username === username)),
    getUserByEmail: vi.fn().mockImplementation(async (email: string) => users.find(u => u.email === email)),
    createUser: vi.fn().mockImplementation(async (data: any) => {
      const user = { id: users.length + 1, emailVerified: false, ...data };
      users.push(user);
      return user;
    }),
    updateUserEmailVerified: vi.fn().mockImplementation(async (userId: number, verified: boolean) => {
      const user = users.find(u => u.id === userId);
      if (user) user.emailVerified = verified;
    }),
    createVerificationToken: vi.fn().mockImplementation(async (data: any) => {
      const token = { id: tokens.length + 1, ...data };
      tokens.push(token);
      return token;
    }),
    getVerificationToken: vi.fn().mockImplementation(async (token: string) => tokens.find(t => t.token === token)),
    deleteVerificationToken: vi.fn().mockImplementation(async (token: string) => {
      const idx = tokens.findIndex(t => t.token === token);
      if (idx !== -1) tokens.splice(idx, 1);
    })
  }
}));

vi.mock('../../server/services/email-service', () => ({
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
      .send({ username: 'alice', password: 'password123', email: 'alice@example.com' });

    expect(signupRes.status).toBe(200);
    expect(signupRes.body.message).toMatch(/verification email sent/i);
    
    const { emailService } = await import('../../server/services/email-service');
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();

    const token = tokens[0].token;

    const loginBefore = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(loginBefore.status).toBe(403);

    const verifyRes = await request(app).get(`/api/auth/verify-email?token=${token}`);
    expect(verifyRes.status).toBe(200);

    const loginAfter = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'password123' });
    expect(loginAfter.status).toBe(200);
    expect(loginAfter.body.token).toBeDefined();
  });
});