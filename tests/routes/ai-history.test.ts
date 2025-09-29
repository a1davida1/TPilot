import express, { type NextFunction, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAiHistoryHandler } from '../../server/api-routes.ts';
import type { AuthRequest } from '../../server/middleware/auth.ts';

describe('GET /api/ai/history', () => {
  const validToken = 'valid-token';
  const authenticatedUser = { id: 42 } as const;
  const mockGetUserHistory = vi.fn<(userId: number, limit?: number) => Promise<unknown[]>>();

  const authenticateStub = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.replace('Bearer', '').trim();
    if (token !== validToken) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    req.user = { id: authenticatedUser.id } as AuthRequest['user'];
    next();
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects anonymous callers', async () => {
    const app = express();
    const handler = createAiHistoryHandler({ getUserHistory: mockGetUserHistory });

    app.get('/api/ai/history', authenticateStub, handler);

    const response = await request(app).get('/api/ai/history').expect(401);

    expect(response.body).toMatchObject({ error: 'Access token required' });
    expect(mockGetUserHistory).not.toHaveBeenCalled();
  });

  it('returns history for authenticated users', async () => {
    const app = express();
    const history = [{ id: 1, outputJson: { text: 'first' } }];

    mockGetUserHistory.mockResolvedValueOnce(history);
    const handler = createAiHistoryHandler({ getUserHistory: mockGetUserHistory });

    app.get('/api/ai/history', authenticateStub, handler);

    const response = await request(app)
      .get('/api/ai/history')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body).toEqual(history);
    expect(mockGetUserHistory).toHaveBeenCalledWith(authenticatedUser.id, 20);
  });

  it('respects the provided limit query parameter', async () => {
    const app = express();
    const history = [{ id: 1 }, { id: 2 }];

    mockGetUserHistory.mockResolvedValueOnce(history);
    const handler = createAiHistoryHandler({ getUserHistory: mockGetUserHistory });

    app.get('/api/ai/history', authenticateStub, handler);

    const response = await request(app)
      .get('/api/ai/history?limit=5')
      .set('Authorization', `Bearer ${validToken}`)
      .expect(200);

    expect(response.body).toEqual(history);
    expect(mockGetUserHistory).toHaveBeenCalledWith(authenticatedUser.id, 5);
  });
});