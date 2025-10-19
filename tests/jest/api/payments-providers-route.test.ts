import { testApiHandler } from 'next-test-api-route-handler';
import { sign } from 'jsonwebtoken';

type ProvidersModule = typeof import('@server/payments/payment-providers');

jest.mock('@server/payments/payment-providers', () => {
  const actual = jest.requireActual<ProvidersModule>('@server/payments/payment-providers');
  return {
    ...actual,
    makePaxum: jest.fn(),
    makeCoinbase: jest.fn(),
    makeStripe: jest.fn(),
  };
});

const providers = jest.requireMock('@server/payments/payment-providers') as {
  makePaxum: jest.MockedFunction<ProvidersModule['makePaxum']>;
  makeCoinbase: jest.MockedFunction<ProvidersModule['makeCoinbase']>;
  makeStripe: jest.MockedFunction<ProvidersModule['makeStripe']>;
};

describe('GET /api/payments/providers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeAuthHeader = (userId: number) => `Bearer ${sign({ userId }, process.env.JWT_SECRET || 'test-secret')}`;

  it('returns provider availability summary', async () => {
    providers.makePaxum.mockReturnValue({ name: 'paxum', enabled: true, createCheckout: jest.fn() });
    providers.makeCoinbase.mockReturnValue({ name: 'coinbase', enabled: false, createCheckout: jest.fn() });
    providers.makeStripe.mockReturnValue({ name: 'stripe', enabled: true, createCheckout: jest.fn() });

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(77),
        };
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/payments/providers/route');
        const response = await GET(
          new Request('http://localhost/api/payments/providers', {
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
        expect(body.data).toEqual([
          { name: 'paxum', enabled: true, status: 'active' },
          { name: 'coinbase', enabled: false, status: 'disabled' },
          { name: 'stripe', enabled: true, status: 'active' },
        ]);
      },
    });
  });

  it('marks misconfigured providers safely', async () => {
    providers.makePaxum.mockImplementation(() => {
      throw new Error('missing key');
    });
    providers.makeCoinbase.mockReturnValue({ name: 'coinbase', enabled: true, createCheckout: jest.fn() });
    providers.makeStripe.mockImplementation(() => {
      throw new Error('no secret');
    });

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
        req.headers = {
          ...(req.headers || {}),
          authorization: makeAuthHeader(77),
        };
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/payments/providers/route');
        const response = await GET(
          new Request('http://localhost/api/payments/providers', {
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
        expect(body.data).toEqual([
          { name: 'paxum', enabled: false, status: 'misconfigured' },
          { name: 'coinbase', enabled: true, status: 'active' },
          { name: 'stripe', enabled: false, status: 'misconfigured' },
        ]);
      },
    });
  });

  it('requires authentication', async () => {
    providers.makePaxum.mockReturnValue({ name: 'paxum', enabled: true, createCheckout: jest.fn() });
    providers.makeCoinbase.mockReturnValue({ name: 'coinbase', enabled: true, createCheckout: jest.fn() });
    providers.makeStripe.mockReturnValue({ name: 'stripe', enabled: true, createCheckout: jest.fn() });

    await testApiHandler({
      requestPatcher: (req) => {
        req.method = 'GET';
      },
      handler: async (req, res) => {
        const { GET } = await import('../../../app/api/payments/providers/route');
        const response = await GET(
          new Request('http://localhost/api/payments/providers', {
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
