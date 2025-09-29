import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCancelSubscriptionHandler } from '../../server/routes/subscription-management.js';

type RequestWithUser = express.Request & { user?: { id: number } };

describe('cancel subscription route', () => {
  const logger = {
    error: vi.fn(),
    warn: vi.fn(),
  };

  const makeApp = (
    deps: Parameters<typeof createCancelSubscriptionHandler>[0],
    userId: number
  ) => {
    const app = express();
    app.use(express.json());
    app.post(
      '/api/cancel-subscription',
      (req, _res, next) => {
        (req as RequestWithUser).user = { id: userId };
        next();
      },
      createCancelSubscriptionHandler(deps)
    );
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels the subscription when ownership is verified', async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: 'sub_123',
      metadata: { userId: '42' },
      customer: 'cus_123',
      cancel_at: null,
    });
    const update = vi.fn().mockResolvedValue({
      id: 'sub_123',
      cancel_at: 1700000000,
    });
    const storage = {
      getUser: vi.fn().mockResolvedValue({ id: 42, stripeCustomerId: 'cus_123' }),
    };
    const stripe = { subscriptions: { retrieve, update } };

    const app = makeApp({ stripe, storage, logger, sentry: null }, 42);

    const response = await request(app)
      .post('/api/cancel-subscription')
      .send({ subscriptionId: 'sub_123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: 'Subscription will be cancelled at the end of the billing period',
      cancelAt: 1700000000,
    });
    expect(storage.getUser).toHaveBeenCalledWith(42);
    expect(retrieve).toHaveBeenCalledWith('sub_123');
    expect(update).toHaveBeenCalledWith('sub_123', { cancel_at_period_end: true });
  });

  it('rejects cancellation when the subscription belongs to another user', async () => {
    const retrieve = vi.fn().mockResolvedValue({
      id: 'sub_999',
      metadata: { userId: '99' },
      customer: 'cus_other',
      cancel_at: null,
    });
    const update = vi.fn();
    const storage = {
      getUser: vi.fn().mockResolvedValue({ id: 42, stripeCustomerId: 'cus_123' }),
    };
    const stripe = { subscriptions: { retrieve, update } };

    const app = makeApp({ stripe, storage, logger, sentry: null }, 42);

    const response = await request(app)
      .post('/api/cancel-subscription')
      .send({ subscriptionId: 'sub_999' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Subscription does not belong to this account' });
    expect(storage.getUser).toHaveBeenCalledWith(42);
    expect(retrieve).toHaveBeenCalledWith('sub_999');
    expect(update).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});