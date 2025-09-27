import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const exchangeRedditCodeMock = vi.fn(async () => {
  throw new Error('token exchange disabled in tests');
});

vi.mock('../../server/db.js', () => ({
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

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const requestWithUser = req as express.Request & { user?: { id: number } };
    requestWithUser.user = { id: 42 };
    next();
  }
}));

vi.mock('../../server/lib/safety-systems.js', () => ({
  SafetyManager: {
    performSafetyCheck: vi.fn(),
    checkRateLimit: vi.fn(),
    checkDuplicate: vi.fn()
  }
}));

vi.mock('../../server/lib/reddit.js', () => {
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
    exchangeRedditCode: exchangeRedditCodeMock,
    getUserRedditCommunityEligibility: vi.fn(async () => ({ eligible: true }))
  };
});

import { registerRedditRoutes } from '../../server/reddit-routes.js';
import { stateStore } from '../../server/services/state-store.js';
import { logger } from '../../server/bootstrap/logger.js';

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
      .set('x-forwarded-for', FORWARDED_IP);

    expect(response.status).toBe(200);
    expect(typeof response.body.authUrl).toBe('string');

    expect(setSpy).toHaveBeenCalledTimes(1);
    const [stateKey, stateValue] = setSpy.mock.calls[0] ?? [];
    lastStoredStateKey = stateKey as string | undefined;
    const storedPayload = stateValue as { ip?: string } | undefined;
    expect(storedPayload?.ip).toBe(FORWARDED_IP);

    const loggedCall = infoSpy.mock.calls.find(call => call[0] === 'Reddit OAuth initiated');
    expect(loggedCall?.[1]).toMatchObject({ requestIP: FORWARDED_IP });
  });

  it('does not log an IP mismatch when callback forwarded IP matches stored state', async () => {
    const app = createTestApp();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
    vi.spyOn(logger, 'info').mockImplementation(() => logger);
    vi.spyOn(logger, 'error').mockImplementation(() => logger);

    const connectResponse = await request(app)
      .get('/api/reddit/connect')
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

    const mismatchLog = warnSpy.mock.calls.find(call => call[0] === 'IP mismatch in OAuth callback');
    expect(mismatchLog).toBeUndefined();
  });
});