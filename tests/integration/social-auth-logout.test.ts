import express from 'express';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

import type { User } from '../../shared/schema.ts';

const storageMock = {
  getUserByProviderId: vi.fn(async () => null as unknown as User),
  updateUser: vi.fn(async () => null as unknown as User),
  getUserById: vi.fn(async () => null as unknown as User),
  getUserByEmail: vi.fn(async () => null as unknown as User),
  createUser: vi.fn(async () => ({}) as User),
};

vi.mock('../../server/storage.ts', () => ({
  storage: storageMock,
}));

vi.mock('../../server/middleware/auth.ts', () => ({
  createToken: vi.fn(() => 'token'),
}));

vi.mock('../../server/bootstrap/logger.ts', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../server/lib/tokenBlacklist.ts', () => ({
  blacklistToken: vi.fn(async () => undefined),
}));

let setupSocialAuth: typeof import('../../server/social-auth.ts')['setupSocialAuth'];
let createSessionMiddleware: typeof import('../../server/bootstrap/session.ts')['createSessionMiddleware'];

const originalEnv = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  SESSION_COOKIE_DOMAIN: process.env.SESSION_COOKIE_DOMAIN,
};

describe('social auth logout cookie handling', () => {
  beforeAll(async () => {
    vi.resetModules();
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.SESSION_COOKIE_NAME = 'custom.sid';
    process.env.SESSION_COOKIE_DOMAIN = 'example.com';

    ({ setupSocialAuth } = await import('../../server/social-auth.ts'));
    ({ createSessionMiddleware } = await import('../../server/bootstrap/session.ts'));
  });

  afterAll(() => {
    process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
    process.env.SESSION_COOKIE_NAME = originalEnv.SESSION_COOKIE_NAME;
    process.env.SESSION_COOKIE_DOMAIN = originalEnv.SESSION_COOKIE_DOMAIN;
  });

  it('expires the configured session cookie on logout', async () => {
    const app = express();
    app.use(express.json());
    app.use(createSessionMiddleware());

    app.post('/api/test/login', (req, res) => {
      (req.session as typeof req.session & { userId?: number }).userId = 123;
      res.json({ ok: true });
    });

    setupSocialAuth(app, '/api');

    const agent = request.agent(app);

    await agent.post('/api/test/login').expect(200);

    const response = await agent.post('/api/auth/logout').expect(200);

    const setCookies = response.get('Set-Cookie');
    expect(Array.isArray(setCookies)).toBe(true);

    const sessionCookie = (setCookies as string[] | undefined)?.find((cookie) => cookie.startsWith('custom.sid='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('Max-Age=0');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('Domain=example.com');
  });
});
