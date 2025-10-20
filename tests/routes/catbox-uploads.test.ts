import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { AuthRequest } from '../../server/middleware/auth.js';

let authMiddleware: (req: AuthRequest, res: express.Response, next: express.NextFunction) => void;
const getUploadsMock = vi.fn();

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn(() => {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      return authMiddleware(req, res, next);
    };
  })
}));

vi.mock('../../server/services/catbox-gallery-service.js', () => ({
  getUserCatboxGalleryUploads: getUploadsMock,
}));

import catboxApiRouter from '../../server/routes/catbox-api.js';

describe('GET /api/catbox/uploads', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    authMiddleware = (req: AuthRequest, _res, next) => {
      req.user = { id: 1, email: 'user@example.com' } as never;
      next();
    };

    app = express();
    app.use(cookieParser());
    app.use('/api/catbox', catboxApiRouter);
  });

  it('returns 401 when the user is not authenticated', async () => {
    authMiddleware = (req: AuthRequest, _res, next) => {
      req.user = undefined as never;
      next();
    };

    const response = await request(app).get('/api/catbox/uploads');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required' });
    expect(getUploadsMock).not.toHaveBeenCalled();
  });

  it('returns Catbox uploads for the authenticated user', async () => {
    const uploads = [
      {
        id: 5,
        url: 'https://files.catbox.moe/example.jpg',
        filename: 'example.jpg',
        fileSize: 128000,
        mime: 'image/jpeg',
        uploadedAt: '2024-02-10T00:00:00.000Z',
        provider: 'catbox'
      }
    ];
    getUploadsMock.mockResolvedValue(uploads);

    const response = await request(app).get('/api/catbox/uploads?limit=5');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ uploads });
    expect(getUploadsMock).toHaveBeenCalledWith(1, 5);
  });

  it('returns 500 when loading uploads fails', async () => {
    getUploadsMock.mockRejectedValue(new Error('db offline'));

    const response = await request(app).get('/api/catbox/uploads');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Failed to load Catbox uploads' });
  });

  it('rejects invalid pagination parameters', async () => {
    const response = await request(app).get('/api/catbox/uploads?limit=NaN');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid request parameters' });
    expect(getUploadsMock).not.toHaveBeenCalled();
  });
});
