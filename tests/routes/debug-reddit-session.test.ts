import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import type { Server } from 'http';

interface ErrorResponseBody {
  message?: string;
  [key: string]: unknown;
}

const takeEnvSnapshot = (): Record<string, string | undefined> => ({ ...process.env });

const restoreEnvSnapshot = (snapshot: Record<string, string | undefined>): void => {
  const currentKeys = Object.keys(process.env);
  currentKeys.forEach(key => {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  });

  (Object.entries(snapshot) as Array<[string, string | undefined]>).forEach(([key, value]) => {
    if (typeof value === 'string') {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  });
};

const closeServer = async (server: Server | undefined): Promise<void> => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (!error) {
        resolve();
        return;
      }

      const errorWithCode = error as { code?: string };
      if (errorWithCode.code === 'ERR_SERVER_NOT_RUNNING') {
        resolve();
        return;
      }

      reject(error);
    });
  });
};

describe('GET /api/debug/reddit-session', () => {
  let server: Server | undefined;
  let envSnapshot: Record<string, string | undefined>;

  beforeEach(() => {
    envSnapshot = takeEnvSnapshot();
    server = undefined;
  });

  afterEach(async () => {
    await closeServer(server);
    restoreEnvSnapshot(envSnapshot);
    vi.resetModules();
  });

  it('blocks unauthenticated access when running in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/db';
    process.env.JWT_SECRET = 'p'.repeat(64);
    process.env.SESSION_SECRET = 's'.repeat(64);
    process.env.SENDGRID_API_KEY = 'SG.test-sendgrid-key';
    process.env.USE_PG_QUEUE = 'true';
    delete process.env.REDIS_URL;

    vi.resetModules();
    const routesModule = await import('../../server/routes.ts');
    const { registerRoutes } = routesModule;

    const app = express();
    app.use(express.json());

    server = await registerRoutes(app);

    const response = await supertest(app).get('/api/debug/reddit-session');
    const body = response.body as ErrorResponseBody;

    expect(response.status).toBe(404);
    expect(typeof body.message).toBe('string');
    const message = body.message ?? '';
    expect(message).toContain('API endpoint not found');
  });
});
