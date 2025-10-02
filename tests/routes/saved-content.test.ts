import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { RequestHandler } from 'express';
import request from 'supertest';

const createSavedContentMock = vi.fn();
const getUserContentGenerationsMock = vi.fn();
const getSocialMediaPostMock = vi.fn();
const authenticateTokenMock = vi.fn<(requireAuth?: boolean) => RequestHandler>();
const loggerErrorMock = vi.fn();

vi.mock('../../server/storage.ts', () => ({
  storage: {
    getUserContentGenerations: getUserContentGenerationsMock,
    getSocialMediaPost: getSocialMediaPostMock,
    createSavedContent: createSavedContentMock,
  },
}));

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: authenticateTokenMock,
}));

vi.mock('../../server/middleware/security.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/middleware/security.ts')>();
  return {
    ...actual,
    validateEnvironment: vi.fn(),
    securityMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => next(),
    ipLoggingMiddleware: (req: express.Request, res: express.Response, next: express.NextFunction) => next(),
    errorHandler: (err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => next(err),
    logger: {
      ...actual.logger,
      info: vi.fn(),
      warn: vi.fn(),
      error: loggerErrorMock,
    },
  };
});

let registerSavedContentRoutes: typeof import('../../server/routes.ts').registerSavedContentRoutes;

describe('POST /api/saved-content', () => {
  let app: express.Express;

  beforeEach(async () => {
    createSavedContentMock.mockReset();
    getUserContentGenerationsMock.mockReset();
    getSocialMediaPostMock.mockReset();
    authenticateTokenMock.mockReset();
    loggerErrorMock.mockReset();
    vi.resetModules();
    ({ registerSavedContentRoutes } = await import('../../server/routes.ts'));

    app = express();
    app.use(express.json());

    authenticateTokenMock.mockReturnValue(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as express.Request & { user?: { id: number } }).user = { id: 1 };
        next();
      }
    );

    registerSavedContentRoutes(app);
  });

  it('creates saved content with valid payload', async () => {
    getUserContentGenerationsMock.mockResolvedValue([{ id: 25 }]);
    getSocialMediaPostMock.mockResolvedValue({ id: 7, userId: 1, platform: 'instagram' });
    const storedRecord = {
      id: 11,
      userId: 1,
      title: 'Launch Day',
      content: 'Excited to share!',
      platform: 'instagram',
      tags: ['launch'],
      metadata: { priority: 'high' },
      contentGenerationId: 25,
      socialMediaPostId: 7,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    createSavedContentMock.mockResolvedValue(storedRecord);

    const response = await request(app)
      .post('/api/saved-content')
      .send({
        title: ' Launch Day ',
        content: ' Excited to share! ',
        platform: 'instagram',
        tags: ['launch'],
        metadata: { priority: 'high' },
        contentGenerationId: '25',
        socialMediaPostId: '7',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(storedRecord);
    expect(createSavedContentMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      title: 'Launch Day',
      content: 'Excited to share!',
      platform: 'instagram',
      tags: ['launch'],
      metadata: { priority: 'high' },
      contentGenerationId: 25,
      socialMediaPostId: 7,
    }));
  });

  it('rejects when referenced generation is not owned', async () => {
    getUserContentGenerationsMock.mockResolvedValue([]);

    const response = await request(app)
      .post('/api/saved-content')
      .send({
        title: 'Post',
        content: 'Body',
        contentGenerationId: 99,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Content generation not found' });
    expect(createSavedContentMock).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid social media post id', async () => {
    const response = await request(app)
      .post('/api/saved-content')
      .send({
        title: 'Post',
        content: 'Body',
        socialMediaPostId: 'abc',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Invalid socialMediaPostId' });
    expect(createSavedContentMock).not.toHaveBeenCalled();
  });

  it('handles storage errors gracefully', async () => {
    getUserContentGenerationsMock.mockResolvedValue([]);
    const failure = new Error('db failure');
    createSavedContentMock.mockRejectedValue(failure);

    const response = await request(app)
      .post('/api/saved-content')
      .send({
        title: 'Post',
        content: 'Body',
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: 'Failed to save content' });
    expect(loggerErrorMock).toHaveBeenCalledWith('Failed to save content:', failure);
  });
});