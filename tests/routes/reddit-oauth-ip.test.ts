import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../server/db.ts', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis()
    })),
    update: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis()
    })),
    select: vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    }))
  }
}));

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: ((
    reqOrRequired: boolean | express.Request,
    res?: express.Response,
    next?: express.NextFunction
  ) => {
    if (typeof reqOrRequired === 'boolean') {
      // Factory pattern: return middleware
      return (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        const requestWithUser = req as express.Request & { user?: { id: number } };
        requestWithUser.user = { id: 42 };
        next();
      };
    }
    
    // Direct middleware pattern
    const requestWithUser = reqOrRequired as express.Request & { user?: { id: number } };
    requestWithUser.user = { id: 42 };
    if (next) next();
  })
}));

vi.mock('../../server/lib/safety-systems.ts', () => ({
  SafetyManager: {
    performSafetyCheck: vi.fn(),
    checkRateLimit: vi.fn(),
    checkDuplicate: vi.fn()
  }
}));

vi.mock('../../server/lib/reddit.ts', () => {
  const mockExchangeRedditCode = vi.fn().mockImplementation(async () => {
    throw new Error('token exchange disabled in tests');
  });

  class MockRedditManager {
    constructor(_accessToken: string, _refreshToken: string, _userId: number) {}

    async getProfile() {
      return { username: 'mock-user' };
    }

    async testConnection() {
      return true;
    }

    static async forUser() {
      return null;
    }
  }

  return {
    RedditManager: MockRedditManager,
    getRedditAuthUrl: (state: string) => `https://example.com/oauth?state=${state}`,
    exchangeRedditCode: mockExchangeRedditCode,
    getUserRedditCommunityEligibility: vi.fn(async () => ({ eligible: true }))
  };
});

import { registerRedditRoutes } from '../../server/reddit-routes.ts';
import { stateStore } from '../../server/services/state-store.ts';
import { logger } from '../../server/bootstrap/logger.ts';
import { exchangeRedditCode } from '../../server/lib/reddit.ts';

const exchangeRedditCodeMock = vi.mocked(exchangeRedditCode);
const FORWARDED_IP = '203.0.113.10';

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true);
  app.use((req, _res, next) => {
    const forwardedFor = req.get('x-forwarded-for');
    if (forwardedFor) {
      req.userIP = forwardedFor.split(',')[0]?.trim();
    }
    next();
  });
  registerRedditRoutes(app);
  return app;
}

describe('Reddit OAuth IP normalization', () => {
  let previousEnv: string | undefined;
  let lastStoredStateKey: string | undefined;

  beforeEach(() => {
    previousEnv = process.env.REDDIT_CLIENT_ID;
    process.env.REDDIT_CLIENT_ID = 'test-client-id';
    vi.clearAllMocks();
    lastStoredStateKey = undefined;
  });

  afterEach(async () => {
    if (lastStoredStateKey) {
      await stateStore.delete(lastStoredStateKey);
    }
    if (previousEnv === undefined) {
      delete process.env.REDDIT_CLIENT_ID;
    } else {
      process.env.REDDIT_CLIENT_ID = previousEnv;
    }
    vi.restoreAllMocks();
  });

  it('stores and logs the forwarded IP during connect', async () => {
    const app = createTestApp();
    const setSpy = vi.spyOn(stateStore, 'set');
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => logger);

    const response = await request(app)
      .get('/api/reddit/connect')
      .query({ intent: 'account-link' })
      .set('x-forwarded-for', FORWARDED_IP);

    expect(response.status).toBe(200);
    expect(typeof response.body.authUrl).toBe('string');

    expect(setSpy).toHaveBeenCalledTimes(1);
    const [stateKey, stateValue] = setSpy.mock.calls[0] ?? [];
    lastStoredStateKey = stateKey as string | undefined;
    const storedPayload = stateValue as { ip?: string; intent?: string } | undefined;
    expect(storedPayload?.ip).toBe(FORWARDED_IP);
    expect(storedPayload?.intent).toBe('account-link');

    const loggedCall = infoSpy.mock.calls.find((call: any[]) => call[0] === 'Reddit OAuth initiated') as any[];
    expect(loggedCall?.[1]).toMatchObject({ requestIP: FORWARDED_IP, intent: 'account-link' });
  });

  it('does not log an IP mismatch when callback forwarded IP matches stored state', async () => {
    const app = createTestApp();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    vi.spyOn(logger, 'info').mockImplementation(() => logger);
    vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const connectResponse = await request(app)
      .get('/api/reddit/connect')
      .query({ intent: 'account-link' })
      .set('x-forwarded-for', FORWARDED_IP);

    expect(connectResponse.status).toBe(200);
    const authUrl = connectResponse.body.authUrl as string;
    const state = new URL(authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    if (state) {
      lastStoredStateKey = `reddit_state:${state}`;
    }

    const callbackResponse = await request(app)
      .get('/api/reddit/callback')
      .set('x-forwarded-for', FORWARDED_IP)
      .query({ state, code: 'dummy-code' });

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers['location']).toContain('reddit_token_exchange_failed');

    const mismatchLog = warnSpy.mock.calls.find((call: any[]) => call[0] === 'IP mismatch in OAuth callback');
    expect(mismatchLog).toBeUndefined();
  });

  it('rejects Reddit connect requests without an intent', async () => {
    const app = createTestApp();

    const response = await request(app)
      .get('/api/reddit/connect');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: 'Missing Reddit OAuth intent' });
  });

  it('routes posting intents to the posting workflow after successful callback', async () => {
    const app = createTestApp();
    const connectResponse = await request(app)
      .get('/api/reddit/connect')
      .query({ intent: 'posting', queue: 'reddit-posting' });

    expect(connectResponse.status).toBe(200);
    const authUrl = connectResponse.body.authUrl as string;
    const state = new URL(authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    if (state) {
      lastStoredStateKey = `reddit_state:${state}`;
    }

    exchangeRedditCodeMock.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    const callbackResponse = await request(app)
      .get('/api/reddit/callback')
      .query({ state, code: 'oauth-code' });

    expect(callbackResponse.status).toBe(302);
    const redirectLocation = callbackResponse.headers['location'];
    expect(redirectLocation?.startsWith('/reddit?')).toBe(true);
    expect(redirectLocation).toContain('intent=posting');
    expect(redirectLocation).toContain('queue=reddit-posting');
  });

  it('routes intelligence intents to the intelligence workflow after successful callback', async () => {
    const app = createTestApp();
    const connectResponse = await request(app)
      .get('/api/reddit/connect')
      .query({ intent: 'intelligence', queue: 'intelligence-dashboard' });

    expect(connectResponse.status).toBe(200);
    const authUrl = connectResponse.body.authUrl as string;
    const state = new URL(authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    if (state) {
      lastStoredStateKey = `reddit_state:${state}`;
    }

    exchangeRedditCodeMock.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    const callbackResponse = await request(app)
      .get('/api/reddit/callback')
      .query({ state, code: 'oauth-code' });

    expect(callbackResponse.status).toBe(302);
    const redirectLocation = callbackResponse.headers['location'];
    expect(redirectLocation?.startsWith('/phase4?')).toBe(true);
    expect(redirectLocation).toContain('intent=intelligence');
    expect(redirectLocation).toContain('tab=intelligence');
    expect(redirectLocation).toContain('queue=intelligence-dashboard');
  });

  it('routes account-link intents back to the dashboard when callback succeeds', async () => {
    const app = createTestApp();
    const connectResponse = await request(app)
      .get('/api/reddit/connect')
      .query({ intent: 'account-link' });

    expect(connectResponse.status).toBe(200);
    const authUrl = connectResponse.body.authUrl as string;
    const state = new URL(authUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    if (state) {
      lastStoredStateKey = `reddit_state:${state}`;
    }

    exchangeRedditCodeMock.mockResolvedValueOnce({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    const callbackResponse = await request(app)
      .get('/api/reddit/callback')
      .query({ state, code: 'oauth-code' });

    expect(callbackResponse.status).toBe(302);
    const redirectLocation = callbackResponse.headers['location'];
    expect(redirectLocation).toContain('/dashboard?');
    expect(redirectLocation).toContain('intent=account-link');
  });
});