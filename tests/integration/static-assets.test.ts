
import path from 'path';
import fs from 'fs/promises';
import request from 'supertest';
import { createServer, type Server } from 'http';
import type { Express } from 'express';
import {
  describe,
  it,
  beforeAll,
  afterAll,
  expect,
  vi,
  type SpyInstance
} from 'vitest';

const clientDistRoot = path.resolve(process.cwd(), 'client', 'dist');
const assetsDirectory = path.join(clientDistRoot, 'assets');
const indexFilePath = path.join(clientDistRoot, 'index.html');
const jsAssetPath = path.join(assetsDirectory, 'app.js');
const cssAssetPath = path.join(assetsDirectory, 'styles.css');

vi.mock('../../server/routes.js', () => ({
  registerRoutes: vi.fn(async (app: Express) => createServer(app))
}));

vi.mock('../../server/auth.js', () => ({
  setupAuth: vi.fn()
}));

vi.mock('../../server/social-auth.js', () => ({
  setupSocialAuth: vi.fn()
}));

vi.mock('../../server/routes/webhooks.stripe.js', () => ({
  mountStripeWebhook: vi.fn()
}));

vi.mock('../../server/routes/billing.js', () => ({
  mountBillingRoutes: vi.fn()
}));

vi.mock('../../server/bootstrap/queue.js', () => ({
  startQueue: vi.fn(async () => undefined)
}));

type LoggerType = typeof import('../../server/bootstrap/logger.js')['logger'];
type LoggerInfoParams = Parameters<LoggerType['info']>;
type LoggerInfoReturn = ReturnType<LoggerType['info']>;
type LoggerWarnParams = Parameters<LoggerType['warn']>;
type LoggerWarnReturn = ReturnType<LoggerType['warn']>;

type InfoSpy = SpyInstance<LoggerInfoParams, LoggerInfoReturn>;
type WarnSpy = SpyInstance<LoggerWarnParams, LoggerWarnReturn>;

type CreateApp = typeof import('../../server/app.js')['createApp'];

type CreateAppResult = Awaited<ReturnType<CreateApp>>;

let createApp: CreateApp;
let loggerInstance: LoggerType;

async function removeClientDist(): Promise<void> {
  await fs.rm(clientDistRoot, { recursive: true, force: true });
}

async function seedClientBuild(includeIndex: boolean): Promise<void> {
  await removeClientDist();
  await fs.mkdir(assetsDirectory, { recursive: true });
  if (includeIndex) {
    await fs.writeFile(indexFilePath, '<!doctype html><html><head><title>Static Test</title></head><body>Static Asset Test</body></html>');
  }
  await fs.writeFile(jsAssetPath, 'console.log("static assets test");');
  await fs.writeFile(cssAssetPath, 'body { background: #123456; }');
}

function collectLogs<Args extends unknown[], ReturnType>(
  spy: SpyInstance<Args, ReturnType>,
  predicate: (message: string) => boolean
): boolean {
  return spy.mock.calls.some((call) => {
    const [message] = call;
    return typeof message === 'string' && predicate(message);
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
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
  process.env.ENABLE_VITE_DEV = 'false';
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'static-assets-test-secret-1234567890';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'static-assets-test-session-secret-123456';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'https://example.com/database';

  ({ createApp } = await import('../../server/app.js'));
  ({ logger: loggerInstance } = await import('../../server/bootstrap/logger.js'));
});

afterAll(async () => {
  await removeClientDist();
});

describe('Static asset delivery', () => {
  it('serves built assets with explicit content types and emits informative logs', async () => {
    await seedClientBuild(true);

    const infoSpy: InfoSpy = vi.spyOn(loggerInstance, 'info').mockImplementation(() => loggerInstance);
    const warnSpy: WarnSpy = vi.spyOn(loggerInstance, 'warn').mockImplementation(() => loggerInstance);

    const { app, server }: CreateAppResult = await createApp({
      configureStaticAssets: true,
      startQueue: false,
      enableVite: false
    });

    try {
      const jsResponse = await request(app).get('/assets/app.js');
      expect(jsResponse.status).toBe(200);
      expect(jsResponse.headers['content-type']).toContain('application/javascript');
      expect(jsResponse.text).toContain('static assets test');

      const cssResponse = await request(app).get('/assets/styles.css');
      expect(cssResponse.status).toBe(200);
      expect(cssResponse.headers['content-type']).toContain('text/css');
      expect(cssResponse.text).toContain('background');

      expect(collectLogs(infoSpy, (message) => message.includes(`Serving client from: ${clientDistRoot}`))).toBe(true);
      expect(collectLogs(infoSpy, (message) => message.includes('Asset request received: GET /assets/app.js'))).toBe(true);
      expect(collectLogs(infoSpy, (message) => message.includes('Asset request received: GET /assets/styles.css'))).toBe(true);
      expect(collectLogs(infoSpy, (message) => message.includes(jsAssetPath))).toBe(true);
      expect(collectLogs(infoSpy, (message) => message.includes(cssAssetPath))).toBe(true);
      expect(collectLogs(warnSpy, (message) => message.includes('Client build not found'))).toBe(false);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      await closeServer(server);
      await removeClientDist();
    }
  });

  it('warns and returns a 404 when the SPA index.html is missing', async () => {
    await seedClientBuild(false);

    const infoSpy: InfoSpy = vi.spyOn(loggerInstance, 'info').mockImplementation(() => loggerInstance);
    const warnSpy: WarnSpy = vi.spyOn(loggerInstance, 'warn').mockImplementation(() => loggerInstance);

    const { app, server }: CreateAppResult = await createApp({
      configureStaticAssets: true,
      startQueue: false,
      enableVite: false
    });

    try {
      const response = await request(app).get('/');
      expect(response.status).toBe(404);
      expect(response.text).toContain('Client build not found');

      expect(collectLogs(warnSpy, (message) => message.includes(`Client build not found at ${indexFilePath}`))).toBe(true);
      expect(collectLogs(infoSpy, (message) => message.includes(`Serving client from: ${clientDistRoot}`))).toBe(false);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      await closeServer(server);
      await removeClientDist();
    }
  });
});
