import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

const loggerInfoMock = vi.fn();
const loggerErrorMock = vi.fn();

let lastInsertPayload: Record<string, unknown> | undefined;

const returningMock = vi.fn<[], Promise<Record<string, unknown>[]>>();

const insertMock = vi.fn(() => ({
  values: (payload: Record<string, unknown>) => {
    lastInsertPayload = payload;
    return {
      returning: returningMock,
    };
  },
}));

const chainMock = () => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
});

vi.mock('../../server/db.js', () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
    select: vi.fn(() => chainMock()),
    update: vi.fn(() => chainMock()),
    delete: vi.fn(() => chainMock()),
  },
}));

vi.mock('../../server/middleware/auth', () => ({
  authenticateToken: () => (req: express.Request & { user?: { id: number; tier?: string } }, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 99, tier: 'pro' };
    next();
  },
}));

vi.mock('../../server/lib/scheduler/worker-orchestrator.js', () => ({
  workerOrchestrator: {
    cancelScheduledPost: vi.fn(),
    forceRetry: vi.fn(),
    getRetryStatus: vi.fn(),
    bulkCancelPosts: vi.fn(),
    getWorkerStats: vi.fn(),
  },
}));

vi.mock('../../server/lib/schedule-optimizer.js', () => ({
  getOptimalPostingTimes: vi.fn(async () => []),
  getNextOptimalTime: vi.fn(async () => new Date().toISOString()),
}));

vi.mock('../../server/bootstrap/logger.js', () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
    warn: vi.fn(),
    child: vi.fn(() => ({
      info: loggerInfoMock,
      error: loggerErrorMock,
      warn: vi.fn(),
    })),
  },
}));

describe('POST /api/scheduled-posts', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    lastInsertPayload = undefined;
    returningMock.mockReset();
    returningMock.mockImplementation(async () => [{
      id: 123,
      ...(lastInsertPayload ?? {}),
    }]);

    vi.resetModules();
    const { scheduledPostsRouter } = await import('../../server/routes/scheduled-posts.ts');
    app = express();
    app.use(express.json());
    app.use('/api/scheduled-posts', scheduledPostsRouter);
  });

  it('persists sanitized caption text alongside the caption id', async () => {
    const scheduledFor = new Date(Date.now() + 3_600_000).toISOString();

    const response = await request(app)
      .post('/api/scheduled-posts')
      .send({
        subreddit: '  SampleSub  ',
        title: '  Launch Title  ',
        imageUrl: 'https://example.com/image.jpg',
        caption: '  Final caption with emoji 😊  ',
        captionId: '  cap-abc123  ',
        nsfw: true,
        scheduledFor,
      });

    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalled();
    expect(lastInsertPayload).toMatchObject({
      subreddit: 'SampleSub',
      title: 'Launch Title',
      caption: 'Final caption with emoji 😊',
      content: 'cap-abc123',
      nsfw: true,
    });
    expect(response.body).toMatchObject({
      caption: 'Final caption with emoji 😊',
      subreddit: 'SampleSub',
    });
  });
});
