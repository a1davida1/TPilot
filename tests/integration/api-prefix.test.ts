import type { Express } from 'express';
import type { Server } from 'http';
import type Stripe from 'stripe';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { stripe } from '../../server/lib/billing/stripe.ts';

vi.mock('../../server/storage.ts', () => ({
  storage: {
    getUser: vi.fn(async () => undefined),
    getUserById: vi.fn(async () => undefined),
    getAllUsers: vi.fn(async () => []),
    getUserByEmail: vi.fn(async () => undefined),
    getUserByUsername: vi.fn(async () => undefined),
    createUser: vi.fn(async (user: unknown) => ({ id: 1, ...(user as object) })),
    updateUser: vi.fn(async (_id: number, updates: unknown) => ({ id: _id, ...(updates as object) })),
    updateUserTier: vi.fn(async () => undefined),
    updateUserEmailVerified: vi.fn(async () => undefined),
    createVerificationToken: vi.fn(async () => ({ id: 1, userId: 1, token: 'token', expiresAt: new Date() })),
    getVerificationToken: vi.fn(async () => undefined),
    deleteVerificationToken: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
  },
}));

let createApp: typeof import('../../server/index.ts')['createApp'];

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server || !('close' in server)) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('API prefix alignment', () => {
  let app: Express;
  let server: Server | undefined;

  beforeAll(async () => {
    ({ createApp } = await import('../../server/index.ts'));
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });
    app = result.app;
    server = result.server;
  });

  afterAll(async () => {
    await closeServer(server);
  });

  it('enforces login rate limiting on the prefixed auth route', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'limit@test.com', password: 'WrongPassword123' });

      expect([401, 403]).toContain(response.status);
    }

    const limitedResponse = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({ email: 'limit@test.com', password: 'WrongPassword123' });

    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.headers['retry-after']).toBeDefined();
    expect(limitedResponse.body).toMatchObject({
      error: 'TOO_MANY_REQUESTS',
    });
  });

  it('delivers Stripe webhooks using the shared API prefix', async () => {
    const constructSpy = vi
      .spyOn(stripe.webhooks, 'constructEvent')
      .mockImplementation(() => ({
        id: 'evt_test',
        type: 'test.event',
        api_version: process.env.STRIPE_API_VERSION,
        created: Date.now() / 1000,
        data: { object: {} },
        livemode: false,
        object: 'event',
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
      }) as unknown as Stripe.Event);

    const payload = JSON.stringify({ id: 'evt_test', object: 'event' });

    const response = await request(app)
      .post('/api/webhooks/stripe')
      .set('Stripe-Signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(constructSpy).toHaveBeenCalledWith(expect.any(Buffer), 'test-signature', process.env.STRIPE_WEBHOOK_SECRET);

    constructSpy.mockRestore();
  });
});