import { testApiHandler } from 'next-test-api-route-handler';
import { sign } from 'jsonwebtoken';

jest.mock('@server/services/state-store', () => ({
  stateStore: {
    set: jest.fn(),
  },
}));

jest.mock('@server/lib/reddit', () => ({
  getRedditAuthUrl: jest.fn().mockReturnValue('https://reddit.test/oauth'),
}));

const stateStore = jest.requireMock('@server/services/state-store').stateStore as {
  set: jest.MockedFunction<(typeof import('@server/services/state-store'))['stateStore']['set']>;
};
const { getRedditAuthUrl } = jest.requireMock('@server/lib/reddit') as {
  getRedditAuthUrl: jest.MockedFunction<(typeof import('@server/lib/reddit'))['getRedditAuthUrl']>;
};

describe('GET /api/reddit/connect', () => {
  beforeEach(() => {
    process.env.REDDIT_CLIENT_ID = 'test-client';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeAuthHeader = (userId: number) => `Bearer ${sign({ userId }, process.env.JWT_SECRET || 'test-secret')}`;

  it('creates OAuth state and returns authorization URL', async () => {
    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.url = 'http://localhost/api/reddit/connect?intent=posting&queue=reddit-posting';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(90),
          'user-agent': 'jest',
        };
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/reddit/connect/route');
        const response = await GET(
          new Request(req.url || 'http://localhost/api/reddit/connect', {
            method: 'GET',
            headers: req.headers as Record<string, string>,
          })
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.intent).toBe('posting');
        expect(body.authUrl).toBe('https://reddit.test/oauth');
      },
    });

    expect(getRedditAuthUrl).toHaveBeenCalledTimes(1);
    expect(stateStore.set).toHaveBeenCalledTimes(1);
    const [stateKey, payload, ttl] = stateStore.set.mock.calls[0] || [];
    expect(stateKey).toMatch(/^reddit_state:posting:/);
    expect(payload).toMatchObject({
      userId: 90,
      intent: 'posting',
      queue: 'reddit-posting',
    });
    expect(ttl).toBe(600);
  });

  it('validates queue format', async () => {
    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.url = 'http://localhost/api/reddit/connect?intent=posting&queue=invalid!*';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(90),
        };
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/reddit/connect/route');
        const response = await GET(
          new Request(req.url || 'http://localhost/api/reddit/connect', {
            method: 'GET',
            headers: req.headers as Record<string, string>,
          })
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' });
        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe('Invalid request parameters');
      },
    });

    expect(stateStore.set).not.toHaveBeenCalled();
  });

  it('returns 503 when Reddit integration is disabled', async () => {
    process.env.REDDIT_CLIENT_ID = '';

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.url = 'http://localhost/api/reddit/connect?intent=posting';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(90),
        };
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/reddit/connect/route');
        const response = await GET(
          new Request(req.url || 'http://localhost/api/reddit/connect', {
            method: 'GET',
            headers: req.headers as Record<string, string>,
          })
        );
        res.status(response.status).json(await response.json());
      },
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' });
        expect(response.status).toBe(503);
      },
    });
  });

  it('requires authentication', async () => {
    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.url = 'http://localhost/api/reddit/connect?intent=posting';
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/reddit/connect/route');
        const response = await GET(
          new Request(req.url || 'http://localhost/api/reddit/connect', {
            method: 'GET',
            headers: req.headers as Record<string, string>,
          })
        );
        res.status(response.status).send(await response.text());
      },
      test: async ({ fetch }) => {
        const response = await fetch({ method: 'GET' });
        expect(response.status).toBe(401);
      },
    });
  });
});
