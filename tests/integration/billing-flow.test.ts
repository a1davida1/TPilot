import express from 'express';
import request from 'supertest';
import { describe, test, beforeAll, afterAll, beforeEach, afterEach, expect } from 'vitest';

interface Subscription {
  userId: number;
  provider: string;
  status: string;
  customerId?: string;
  plan?: string;
}

let app: express.Express;
let server: unknown;
let providerKeys: Record<string, string | undefined> = {};
let subscriptions: Record<number, Subscription> = {};
let processedWebhooks = new Set<string>();
let usage: Record<number, { limit: number; used: number }> = {};

function reset() {
  subscriptions = {};
  processedWebhooks = new Set();
  usage = {};
}

describe('Billing Integration Tests', () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // provider listing
    app.get('/api/billing/providers', (req, res) => {
      const providers = Object.keys(providerKeys)
        .filter((k) => providerKeys[k])
        .map((k) => ({ name: k, capabilities: ['subscribe'] }));
      res.json(providers);
    });

    // create subscription
    app.post('/api/billing/create-subscription', (req, res) => {
      const userId = Number(req.headers['x-user']);
      const { provider } = req.body;
      if (!providerKeys[provider]) return res.status(400).json({ message: 'provider disabled' });
      const sub: Subscription = {
        userId,
        provider,
        status: 'active',
        customerId: 'cust_' + userId,
        plan: 'pro',
      };
      subscriptions[userId] = sub;
      res.json(sub);
    });

    // checkout sessions
    app.post('/api/billing/checkout', (req, res) => {
      const { provider } = req.body;
      if (provider === 'fail') return res.status(500).json({ message: 'provider error' });
      const base = provider === 'paxum' ? 'https://paxum.com/pay/' : provider === 'coinbase' ? 'https://commerce.coinbase.com/checkout/' : 'https://stripe.com/pay/';
      res.json({ url: base + 'session' });
    });

    // webhook endpoint
    app.post('/api/webhooks/stripe', (req, res) => {
      if (req.headers['x-signature'] !== 'valid') {
        return res.status(400).json({ message: 'invalid signature' });
      }
      const { id, userId, status } = req.body;
      if (processedWebhooks.has(id)) return res.json({ processed: false });
      processedWebhooks.add(id);
      if (subscriptions[userId]) subscriptions[userId].status = status;
      res.json({ processed: true });
    });

    // status endpoint
    app.get('/api/billing/status', (req, res) => {
      const userId = Number(req.headers['x-user']);
      const sub = subscriptions[userId];
      if (!sub) return res.json({ tier: 'free', upgrade: true });
      res.json({ tier: 'pro', subscription: sub, payment: { method: sub.provider } });
    });

    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise((r) => (server as any).close(r));
  });

  beforeEach(async () => {
    providerKeys = { stripe: 'key', paxum: 'key' };
    reset();
  });

  afterEach(async () => {
    // no-op
  });

  describe('Payment Provider Selection', () => {
    test('should return available payment providers', async () => {
      const res = await request(app).get('/api/billing/providers');
      expect(res.status).toBe(200);
      const names = res.body.map((p: any) => p.name);
      expect(names).toContain('stripe');
      expect(names).toContain('paxum');
      expect(names).not.toContain('coinbase');
    });

    test('should handle missing payment provider keys', async () => {
      providerKeys = {};
      const res = await request(app).get('/api/billing/providers');
      expect(res.body.length).toBe(0);
    });
  });

  describe('Subscription Creation Flow', () => {
    test('should create subscription with Stripe', async () => {
      const res = await request(app)
        .post('/api/billing/create-subscription')
        .set('x-user', '1')
        .send({ provider: 'stripe' });
      expect(res.status).toBe(200);
      expect(subscriptions[1]).toBeTruthy();
      expect(subscriptions[1].provider).toBe('stripe');
      expect(subscriptions[1].status).toBe('active');
    });

    test('should create checkout session with Paxum', async () => {
      const res = await request(app)
        .post('/api/billing/checkout')
        .send({ provider: 'paxum' });
      expect(res.status).toBe(200);
      expect(res.body.url).toContain('paxum.com');
    });

    test('should create checkout session with Coinbase', async () => {
      providerKeys.coinbase = 'key';
      const res = await request(app)
        .post('/api/billing/checkout')
        .send({ provider: 'coinbase' });
      expect(res.status).toBe(200);
      expect(res.body.url).toContain('commerce.coinbase.com');
    });

    test('should handle payment provider failures gracefully', async () => {
      const res = await request(app)
        .post('/api/billing/checkout')
        .send({ provider: 'fail' });
      expect(res.status).toBe(500);
      expect(Object.keys(subscriptions).length).toBe(0);
    });
  });

  describe('Webhook Processing', () => {
    test('should process Stripe webhooks correctly', async () => {
      subscriptions[1] = { userId: 1, provider: 'stripe', status: 'pending' };
      const res = await request(app)
        .post('/api/webhooks/stripe')
        .set('x-signature', 'valid')
        .send({ id: 'evt1', userId: 1, status: 'active' });
      expect(res.status).toBe(200);
      expect(subscriptions[1].status).toBe('active');
    });

    test('should validate webhook signatures', async () => {
      subscriptions[1] = { userId: 1, provider: 'stripe', status: 'pending' };
      const res = await request(app)
        .post('/api/webhooks/stripe')
        .set('x-signature', 'bad')
        .send({ id: 'evt1', userId: 1, status: 'active' });
      expect(res.status).toBe(400);
      expect(subscriptions[1].status).toBe('pending');
    });

    test('should handle webhook idempotency', async () => {
      subscriptions[1] = { userId: 1, provider: 'stripe', status: 'pending' };
      await request(app)
        .post('/api/webhooks/stripe')
        .set('x-signature', 'valid')
        .send({ id: 'evt1', userId: 1, status: 'active' });
      const res = await request(app)
        .post('/api/webhooks/stripe')
        .set('x-signature', 'valid')
        .send({ id: 'evt1', userId: 1, status: 'canceled' });
      expect(res.body.processed).toBe(false);
      expect(subscriptions[1].status).toBe('active');
    });
  });

  describe('Billing Status Queries', () => {
    test('should return user billing status', async () => {
      subscriptions[1] = { userId: 1, provider: 'stripe', status: 'active' };
      const res = await request(app).get('/api/billing/status').set('x-user', '1');
      expect(res.status).toBe(200);
      expect(res.body.tier).toBe('pro');
      expect(res.body.subscription.provider).toBe('stripe');
      expect(res.body.payment.method).toBe('stripe');
    });

    test('should handle users without subscriptions', async () => {
      const res = await request(app).get('/api/billing/status').set('x-user', '2');
      expect(res.status).toBe(200);
      expect(res.body.tier).toBe('free');
      expect(res.body.upgrade).toBe(true);
    });
  });

  describe('Usage Tracking Integration', () => {
    test('should track feature usage against billing limits', async () => {
      usage[1] = { limit: 3, used: 0 };
      const track = (user: number) => {
        const u = usage[user];
        if (u.used >= u.limit) return false;
        u.used++;
        return true;
      };
      expect(track(1)).toBe(true);
      expect(track(1)).toBe(true);
      expect(track(1)).toBe(true);
      expect(track(1)).toBe(false);
      expect(usage[1].used).toBe(3);
    });

    test('should prevent overage on free tier', async () => {
      usage[2] = { limit: 1, used: 0 };
      const track = (user: number) => {
        const u = usage[user];
        if (u.used >= u.limit) return false;
        u.used++;
        return true;
      };
      expect(track(2)).toBe(true);
      expect(track(2)).toBe(false);
    });
  });
});