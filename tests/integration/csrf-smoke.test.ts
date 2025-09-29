import express, { type Request, type Response, type NextFunction } from 'express';
import type { Server } from 'http';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';
import request from 'supertest';
import { describe, it, beforeAll, beforeEach, afterAll, expect } from 'vitest';

import { csrfProtectedRoutes } from '../../server/routes.ts';
import { createApp } from '../../server/index.ts';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

type CsrfScenario = {
  method: 'post' | 'patch' | 'delete';
  path: string;
};

describe('CSRF smoke tests for sensitive routes', () => {
  const scenarios: CsrfScenario[] = [
    { method: 'post', path: '/api/generate-content' },
    { method: 'post', path: '/api/reddit/submit' },
    { method: 'delete', path: '/api/auth/delete-account' },
    { method: 'patch', path: '/api/user/settings' }
  ];

  it('includes renamed endpoints in the CSRF protection list', () => {
    scenarios.forEach(({ path }) => {
      expect(csrfProtectedRoutes).toContain(path);
    });
  });

  describe('middleware enforcement', () => {
    let app: express.Express;
    let agent: request.SuperTest<request.Test>;

    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use(session({
        secret: 'integration-csrf-secret',
        resave: false,
        saveUninitialized: true,
        cookie: {
          secure: false,
          httpOnly: true,
          sameSite: 'lax'
        }
      }));

      const csrfProtection = csrf({
        cookie: false,
        ignoreMethods: ['GET', 'HEAD', 'OPTIONS']
      });

      csrfProtectedRoutes.forEach(route => {
        if (route.includes('*')) {
          const baseRoute = route.replace('/*', '');
          app.use(baseRoute, csrfProtection);
          app.use(`${baseRoute}/*`, csrfProtection);
        } else {
          app.use(route, csrfProtection);
        }
      });

      app.get('/session-init', (req, res) => {
        if (req.session) {
          req.session.userId = 42;
        }
        res.json({ ok: true });
      });

      scenarios.forEach(({ method, path }) => {
        app[method](path, (req, res) => {
          res.json({ success: true, path });
        });
      });

      app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'EBADCSRFTOKEN') {
          res.status(403).json({
            message: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_INVALID',
            path: req.path
          });
          return;
        }
        next(err);
      });
    });

    beforeEach(async () => {
      agent = request.agent(app);
      await agent.get('/session-init').expect(200);
    });

    scenarios.forEach(({ method, path }) => {
      it(`rejects forged ${method.toUpperCase()} ${path} requests without a CSRF token`, async () => {
        const response = await agent[method](path).send({});
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('code', 'CSRF_TOKEN_INVALID');
      });
    });
  });
});

describe('Real route CSRF protection', () => {
  let app: express.Express;
  let agent: request.SuperTest<request.Test>;
  let httpServer: Server | undefined;
  let csrfToken: string;

  beforeAll(async () => {
    const { app: createdApp, server } = await createApp({
      configureStaticAssets: false,
      startQueue: false,
      enableVite: false
    });
    app = createdApp;
    httpServer = server;
    agent = request.agent(app);
  });

  beforeEach(async () => {
    const response = await agent.get('/api/csrf-token').expect(200);
    csrfToken = response.body?.csrfToken as string;
  });

  afterAll(async () => {
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it('rejects forged POST /api/reddit/submit requests without a CSRF token', async () => {
    const response = await agent
      .post('/api/reddit/submit')
      .send({
        subreddit: 'unit_tests',
        title: 'Forged CSRF attempt',
        kind: 'text',
        body: 'This should never reach the handler.'
      });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(String(response.body.error)).toContain('invalid csrf token');
  });

  it('rejects forged POST /api/auth/forgot-password requests without a CSRF token', async () => {
    const response = await agent
      .post('/api/auth/forgot-password')
      .send({ email: 'test-user@example.com' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(String(response.body.error)).toContain('invalid csrf token');
  });

  it('allows POST /api/auth/login to proceed when a CSRF token is provided', async () => {
    const response = await agent
      .post('/api/auth/login')
      .send({ username: 'unknown-user', password: 'invalid-password', _csrf: csrfToken });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ message: 'Invalid credentials' });
  });

  it('allows POST /api/auth/forgot-password to reach its handler when a CSRF token is provided', async () => {
    const response = await agent
      .post('/api/auth/forgot-password')
      .send({ email: 'test-user@example.com', _csrf: csrfToken });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/reset/i) });
  });

  it('rejects forged POST /api/billing/checkout requests without a CSRF token', async () => {
    const response = await agent
      .post('/api/billing/checkout')
      .send({ priceId: 'price_test' });

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('error');
    expect(String(response.body.error)).toContain('invalid csrf token');
  });

  it('allows POST /api/billing/checkout to reach authentication when a CSRF token is provided', async () => {
    const response = await agent
      .post('/api/billing/checkout')
      .send({ priceId: 'price_test', _csrf: csrfToken });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: 'unauthorized' });
  });
});