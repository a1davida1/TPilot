import request from 'supertest';
import type { Express } from 'express';
import type { Server } from 'http';
import { createServer } from 'http';
import { describe, it, beforeAll, beforeEach, afterEach, expect, vi } from 'vitest';
import { subscriptions, invoices, users } from '../../shared/schema.js';
import type { db as DbType } from '../../server/db.js';

interface InsertCall {
  table: unknown;
  values: unknown;
}

interface ConflictUpdateConfig {
  target: unknown;
  set: unknown;
}

interface ConflictUpdateCall {
  table: unknown;
  config: ConflictUpdateConfig;
}

interface UpdateSetCall {
  table: unknown;
  set: unknown;
}

interface UpdateWhereCall {
  table: unknown;
  condition: unknown;
}

type InsertOperation = Promise<void> & {
  onConflictDoUpdate: (config: ConflictUpdateConfig) => Promise<void>;
};

const insertCalls: InsertCall[] = [];
const conflictCalls: ConflictUpdateCall[] = [];
const updateSetCalls: UpdateSetCall[] = [];
const updateWhereCalls: UpdateWhereCall[] = [];

vi.mock('../../server/routes.js', () => ({
  registerRoutes: vi.fn(async (app: Express) => createServer(app))
}));

vi.mock('../../server/auth.js', () => ({
  setupAuth: vi.fn()
}));

vi.mock('../../server/social-auth.js', () => ({
  setupSocialAuth: vi.fn()
}));

vi.mock('../../server/routes/billing.js', () => ({
  mountBillingRoutes: vi.fn()
}));

vi.mock('../../server/bootstrap/queue.js', () => ({
  startQueue: vi.fn(async () => undefined)
}));

vi.mock('../../server/db.js', () => {
  const dbMock = {
    insert: (table: unknown) => ({
      values: (valuesArg: unknown) => {
        insertCalls.push({ table, values: valuesArg });
        const operation = Object.assign(Promise.resolve(), {
          onConflictDoUpdate: async (config: ConflictUpdateConfig) => {
            conflictCalls.push({ table, config });
          }
        }) as InsertOperation;
        return operation;
      }
    }),
    update: (table: unknown) => ({
      set: (setArg: unknown) => {
        updateSetCalls.push({ table, set: setArg });
        return {
          where: async (condition: unknown) => {
            updateWhereCalls.push({ table, condition });
          }
        };
      }
    })
  };

  return {
    db: dbMock as unknown as typeof DbType,
    pool: {} as any,
    closeDatabaseConnections: async () => undefined
  };
});

let createApp: typeof import('../../server/app.js')['createApp'];
let apiPrefix: typeof import('../../server/app.js')['API_PREFIX'];
let stripeInstance: typeof import('../../server/lib/billing/stripe.js')['stripe'];

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server || !server.listening) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'webhook-test-jwt';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'webhook-test-session';

  ({ createApp, API_PREFIX: apiPrefix } = await import('../../server/app.js'));
  ({ stripe: stripeInstance } = await import('../../server/lib/billing/stripe.js'));
});

beforeEach(() => {
  insertCalls.length = 0;
  conflictCalls.length = 0;
  updateSetCalls.length = 0;
  updateWhereCalls.length = 0;
});

afterEach(async () => {
  vi.clearAllMocks();
});

describe('Stripe webhook integration', () => {
  it('processes subscription and invoice webhooks through the prefixed endpoint', async () => {
    const { app, server } = await createApp({
      configureStaticAssets: false,
      startQueue: false,
      enableVite: false
    });

    const webhookPath = `${apiPrefix}/webhooks/stripe`;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret must be configured for tests');
    }

    const subscriptionEvent = {
      id: 'evt_sub_1',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          metadata: { userId: '42' },
          items: {
            data: [
              {
                price: {
                  id: 'price_123',
                  unit_amount: 2500,
                  nickname: 'Pro',
                  metadata: {
                    plan: 'pro'
                  }
                }
              }
            ]
          }
        }
      }
    };

    const subscriptionPayload = JSON.stringify(subscriptionEvent);
    const subscriptionSignature = stripeInstance.webhooks.generateTestHeaderString({
      payload: subscriptionPayload,
      secret: webhookSecret
    });

    try {
      const subscriptionResponse = await request(app)
        .post(webhookPath)
        .set('Stripe-Signature', subscriptionSignature)
        .set('Content-Type', 'application/json')
        .send(subscriptionPayload);

      expect(subscriptionResponse.status).toBe(200);
      expect(subscriptionResponse.body).toEqual({ received: true });

      const subscriptionInsert = insertCalls.find((call) => call.table === subscriptions);
      expect(subscriptionInsert).toBeDefined();
      const subscriptionValues = subscriptionInsert?.values as Record<string, unknown> | undefined;
      expect(subscriptionValues).toMatchObject({
        userId: 42,
        status: 'active',
        plan: 'pro',
        priceCents: 2500,
        processor: 'stripe',
        processorSubId: 'sub_123'
      });

      const subscriptionUpsert = conflictCalls.find((call) => call.table === subscriptions);
      expect(subscriptionUpsert).toBeDefined();
      const subscriptionUpsertSet = subscriptionUpsert?.config.set as Record<string, unknown> | undefined;
      expect(subscriptionUpsertSet).toMatchObject({
        status: 'active',
        plan: 'pro',
        priceCents: 2500,
        processor: 'stripe',
        processorSubId: 'sub_123'
      });

      const tierUpdate = updateSetCalls.find((call) => call.table === users);
      expect(tierUpdate).toBeDefined();
      const tierUpdateValues = tierUpdate?.set as Record<string, unknown> | undefined;
      expect(tierUpdateValues).toMatchObject({ tier: 'pro' });

      const invoiceEvent = {
        id: 'evt_inv_1',
        object: 'event',
        type: 'invoice.paid',
        data: {
          object: {
            id: 'in_123',
            amount_paid: 2500,
            status: 'paid',
            metadata: { userId: '42' }
          }
        }
      };

      const invoicePayload = JSON.stringify(invoiceEvent);
      const invoiceSignature = stripeInstance.webhooks.generateTestHeaderString({
        payload: invoicePayload,
        secret: webhookSecret
      });

      const invoiceResponse = await request(app)
        .post(webhookPath)
        .set('Stripe-Signature', invoiceSignature)
        .set('Content-Type', 'application/json')
        .send(invoicePayload);

      expect(invoiceResponse.status).toBe(200);
      expect(invoiceResponse.body).toEqual({ received: true });

      const invoiceInsert = insertCalls.find((call) => call.table === invoices);
      expect(invoiceInsert).toBeDefined();
      const invoiceValues = invoiceInsert?.values as Record<string, unknown> | undefined;
      expect(invoiceValues).toMatchObject({
        amountCents: 2500,
        status: 'paid',
        processor: 'stripe',
        processorRef: 'in_123'
      });
    } finally {
      await closeServer(server);
    }
  });
});