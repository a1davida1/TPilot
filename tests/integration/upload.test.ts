
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import sharp from 'sharp';
import type { Logger } from 'winston';
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  test,
  expect,
  vi,
  type SpyInstance
} from 'vitest';

interface TestUser extends Record<string, unknown> {
  id: number;
  username: string;
  email: string;
  password: string;
  tier: string;
  role: string;
  isAdmin: boolean;
  emailVerified: boolean;
  isDeleted: boolean;
  mustChangePassword: boolean;
  subscriptionStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

function buildTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const timestamp = new Date();
  return {
    id: 1,
    username: 'imageshield-user',
    email: 'imageshield@example.com',
    password: 'hashed-password',
    tier: 'free',
    role: 'user',
    isAdmin: false,
    emailVerified: true,
    isDeleted: false,
    mustChangePassword: false,
    subscriptionStatus: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesRoot = path.join(__dirname, '__fixtures__', 'imageshield');
const sampleImagePath = path.join(fixturesRoot, 'sample.png');
const uploadsDir = path.join(process.cwd(), 'uploads');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-with-at-least-32-characters!!';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2b$10$w8Vsy1uZb3lROoN0YjvS8O3b0sKQ6n1kG9F7ZbWuoFkA1x/ZzOAVa';
process.env.NODE_ENV = 'test';

const currentUserRef: { value: TestUser } = { value: buildTestUser() };
const tokenStore = new Map<string, TestUser>();

vi.mock('../../server/db.js', () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(async () => [currentUserRef.value])
  };
  return { db: queryBuilder };
});

describe('ImageShield upload integration', () => {
  let app: express.Express;
  let uploadRouter: express.Router;
  let createToken: typeof import('../../server/middleware/auth.js')['createToken'];
  let logger: Logger;
  let infoSpy: SpyInstance;
  let authenticateSpy: SpyInstance;
  let createTokenSpy: SpyInstance;
  let verifyTokenSpy: SpyInstance;
  let authModule: typeof import('../../server/middleware/auth.js');
  let baseFileSize = 0;

  beforeAll(async () => {
    await fs.mkdir(fixturesRoot, { recursive: true });

    const width = 320;
    const height = 240;
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 180, g: 60, b: 120 }
      }
    })
      .png()
      .toFile(sampleImagePath);

    baseFileSize = (await fs.stat(sampleImagePath)).size;

    vi.resetModules();

    authModule = await import('../../server/middleware/auth.js');

    authenticateSpy = vi.spyOn(authModule, 'authenticateToken').mockImplementation((req: Request & { user?: TestUser }, res: Response, next: NextFunction) => {
      const token = req.cookies?.authToken;
      if (!token || !tokenStore.has(token)) {
        res.status(401).json({ message: 'Authentication required' });
        return;
      }
      req.user = tokenStore.get(token);
      next();
    });

    createTokenSpy = vi.spyOn(authModule, 'createToken').mockImplementation((user: TestUser) => {
      const token = `mock-token-${user.id}-${Date.now()}`;
      tokenStore.set(token, user);
      return token;
    });

    verifyTokenSpy = vi.spyOn(authModule, 'verifyToken').mockImplementation((token: string) => {
      const user = tokenStore.get(token);
      if (!user) {
        throw new Error('Invalid token');
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      return {
        userId: user.id,
        email: user.email,
        iat: issuedAt,
        exp: issuedAt + 86400
      };
    });

    ({ uploadRoutes: uploadRouter } = await import('../../server/routes/upload.js'));
    ({ logger } = await import('../../server/middleware/security.js'));
    createToken = authModule.createToken;

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    app.post('/api/test/login', (req, res) => {
      const tier = typeof req.body?.tier === 'string' ? req.body.tier : 'free';
      const id = typeof req.body?.id === 'number' ? req.body.id : tier === 'pro' ? 202 : 101;
      const username = typeof req.body?.username === 'string' ? req.body.username : `${tier}-user`;
      const user = buildTestUser({
        id,
        tier,
        username,
        email: `${username}@example.com`
      });
      currentUserRef.value = user;
      const token = createToken(user as Parameters<typeof createToken>[0]);
      res.cookie('authToken', token, { httpOnly: true, sameSite: 'lax' });
      res.json({ token, user });
    });

    app.post('/api/uploads', (req, res, next) => {
      req.url = '/image';
      (uploadRouter as unknown as express.RequestHandler)(req, res, next);
    });
  });

  beforeEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await fs.mkdir(uploadsDir, { recursive: true });
    tokenStore.clear();
    infoSpy = vi.spyOn(logger, 'info');
  });

  afterEach(() => {
    infoSpy.mockRestore();
  });

  afterAll(async () => {
    authenticateSpy.mockRestore();
    createTokenSpy.mockRestore();
    verifyTokenSpy.mockRestore();
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await fs.rm(fixturesRoot, { recursive: true, force: true });
  });

  test('applies ImageShield protection with watermark for free tier uploads', async () => {
    const loginResponse = await request(app)
      .post('/api/test/login')
      .send({ tier: 'free', id: 101, username: 'free-user' });

    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = cookies?.[0];
    expect(authCookie).toBeDefined();

    const response = await request(app)
      .post('/api/uploads')
      .set('Cookie', authCookie as string)
      .field('protectionLevel', 'standard')
      .attach('image', sampleImagePath, { filename: 'free-user.png' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('File uploaded and protected successfully');
    expect(response.body.watermarked).toBe(true);
    expect(response.body.protectionLevel).toBe('standard');
    expect(response.body.signature).toBeDefined();
    expect(response.body.originalSize).toBe(baseFileSize);

    const storedFiles = await fs.readdir(uploadsDir);
    expect(storedFiles).toHaveLength(1);
    const storedName = storedFiles[0];
    expect(storedName.startsWith('protected_')).toBe(true);
    expect(storedName.startsWith('upload-')).toBe(false);

    const storedPath = path.join(uploadsDir, storedName);
    const storedStats = await fs.stat(storedPath);
    expect(storedStats.size).toBe(response.body.size);
    expect(storedStats.size).not.toBe(baseFileSize);
    expect(response.body.size).not.toBe(response.body.originalSize);

    const storedBuffer = await fs.readFile(storedPath);
    const originalBuffer = await fs.readFile(sampleImagePath);
    expect(storedBuffer.equals(originalBuffer)).toBe(false);

    const validationCall = infoSpy.mock.calls.find(([message]) => message === 'File validation successful');
    expect(validationCall?.[1]).toEqual(expect.objectContaining({
      userId: 101,
      originalName: 'free-user.png',
      declaredMime: 'image/png'
    }));

    const requestValidated = infoSpy.mock.calls.find(([message]) => message === 'Upload request validated');
    expect(requestValidated?.[1]).toEqual(expect.objectContaining({
      userId: 101,
      userTier: 'free',
      protectionLevel: 'standard',
      addWatermark: true
    }));

    expect(
      infoSpy.mock.calls.some(([message]) => typeof message === 'string' && message.startsWith('Protected file uploaded:'))
    ).toBe(true);
  });

  test('respects premium tier settings and skips watermarking', async () => {
    const loginResponse = await request(app)
      .post('/api/test/login')
      .send({ tier: 'pro', id: 202, username: 'premium-user' });

    const cookies = loginResponse.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const authCookie = cookies?.[0];
    expect(authCookie).toBeDefined();

    const response = await request(app)
      .post('/api/uploads')
      .set('Cookie', authCookie as string)
      .field('protectionLevel', 'heavy')
      .attach('image', sampleImagePath, { filename: 'premium-user.png' });

    expect(response.status).toBe(200);
    expect(response.body.watermarked).toBe(false);
    expect(response.body.protectionLevel).toBe('heavy');

    const storedFiles = await fs.readdir(uploadsDir);
    expect(storedFiles).toHaveLength(1);
    expect(storedFiles[0].startsWith('protected_')).toBe(true);
    expect(storedFiles[0].startsWith('upload-')).toBe(false);
    const storedPath = path.join(uploadsDir, storedFiles[0]);

    const stats = await fs.stat(storedPath);
    expect(stats.size).toBe(response.body.size);
    expect(stats.size).not.toBe(baseFileSize);
    expect(response.body.size).not.toBe(response.body.originalSize);

    const processedBuffer = await fs.readFile(storedPath);
    const originalBuffer = await fs.readFile(sampleImagePath);
    expect(processedBuffer.equals(originalBuffer)).toBe(false);

    const requestValidated = infoSpy.mock.calls.find(([message]) => message === 'Upload request validated');
    expect(requestValidated?.[1]).toEqual(expect.objectContaining({
      userId: 202,
      userTier: 'pro',
      addWatermark: false
    }));
  });
});
