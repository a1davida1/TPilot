import express from 'express';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import request from 'supertest';
import session from 'express-session';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupSocialAuth } from '../../../server/social-auth.ts';
import { getSessionCookieConfig } from '../../../server/bootstrap/session.ts';

vi.mock('../../../server/lib/tokenBlacklist.ts', () => ({
  blacklistToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/storage.ts', () => ({
  storage: new Proxy(
    {},
    {
      get: () => vi.fn().mockResolvedValue(null),
    },
  ),
}));

describe('POST /api/auth/logout', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  beforeEach(() => {
    process.env.SESSION_SECRET = 'integration-session-secret-value-0123456789abcdef';
    process.env.SESSION_COOKIE_NAME = 'logout-test.sid';
    delete process.env.SESSION_COOKIE_DOMAIN;
    delete process.env.SESSION_COOKIE_PATH;
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
    process.env.NODE_ENV = 'test';
  });

  it('expires the configured session cookie on logout', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    
    const { name: sessionCookieName } = getSessionCookieConfig();
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'test-secret',
        name: sessionCookieName,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 86400000,
        },
      })
    );
    
    app.use(passport.initialize());
    app.use(passport.session());

    setupSocialAuth(app, '/api');

    app.post('/api/auth/login', (req, res) => {
      if (req.session) {
        (req.session as typeof req.session & { userId?: number }).userId = 123;
      }
      res.cookie('authToken', 'test-token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });
      res.json({ message: 'Logged in' });
    });

    const agent = request.agent(app);

    await agent.post('/api/auth/login').expect(200);

    const logoutResponse = await agent.post('/api/auth/logout').expect(200);

    const setCookieHeader = logoutResponse.get('Set-Cookie');
    expect(Array.isArray(setCookieHeader)).toBe(true);

    const clearedSessionCookie = setCookieHeader?.find((cookie) => cookie.startsWith(`${sessionCookieName}=`));
    expect(clearedSessionCookie).toBeDefined();
    expect(clearedSessionCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(clearedSessionCookie).toMatch(/Path=\//);
    expect(clearedSessionCookie).toMatch(/SameSite=Lax/);

    const clearedAuthCookie = setCookieHeader?.find((cookie) => cookie.startsWith('authToken='));
    expect(clearedAuthCookie).toBeDefined();
    expect(clearedAuthCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(clearedAuthCookie).toMatch(/Path=\//);
  });
});
