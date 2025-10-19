import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { AuthRequest } from '../../server/middleware/auth.js';

let authMiddleware: (req: AuthRequest, res: express.Response, next: express.NextFunction) => void = (req, _res, next) => {
  req.user = { id: 1, email: 'user@example.com' } as never;
  next();
};

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn(() => {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      return authMiddleware(req, res, next);
    };
  })
}));

vi.mock('../../server/lib/catbox-service.js', () => ({
  CatboxService: {
    getUserHash: vi.fn(),
    upload: vi.fn()
  }
}));
vi.mock('../../server/services/catbox-analytics-service.ts', () => ({
  CatboxAnalyticsService: {
    recordUpload: vi.fn().mockResolvedValue(undefined),
  },
}));

import catboxProxyRouter from '../../server/routes/catbox-proxy.js';
import { CatboxService } from '../../server/lib/catbox-service.js';

describe('POST /api/upload/catbox-proxy', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();

    authMiddleware = (req: AuthRequest, _res, next) => {
      req.user = { id: 1, email: 'user@example.com' } as never;
      next();
    };

    app = express();
    app.use(cookieParser());
    app.use('/api/upload', catboxProxyRouter);
  });

  it('returns 400 when no file is provided', async () => {
    const response = await request(app).post('/api/upload/catbox-proxy');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'No file provided' });
  });

  it('uses stored user hash for authenticated uploads', async () => {
    vi.mocked(CatboxService.getUserHash).mockResolvedValue('stored-hash');
    vi.mocked(CatboxService.upload).mockResolvedValue({
      success: true,
      url: 'https://files.catbox.moe/test.png'
    });

    const response = await request(app)
      .post('/api/upload/catbox-proxy')
      .attach('file', Buffer.from('image-bytes'), 'test.png');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      imageUrl: 'https://files.catbox.moe/test.png',
      provider: 'catbox'
    });

    expect(CatboxService.getUserHash).toHaveBeenCalledWith(1);
    expect(CatboxService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        reqtype: 'fileupload',
        filename: 'test.png',
        mimeType: 'image/png',
        userhash: 'stored-hash'
      })
    );

    const uploadPayload = vi.mocked(CatboxService.upload).mock.calls[0]?.[0];
    expect(uploadPayload?.file).toBeInstanceOf(Uint8Array);
  });

  it('propagates Catbox 412 errors with guidance', async () => {
    vi.mocked(CatboxService.getUserHash).mockResolvedValue(null);
    vi.mocked(CatboxService.upload).mockResolvedValue({
      success: false,
      error: 'You must provide a userhash',
      status: 412
    });

    const response = await request(app)
      .post('/api/upload/catbox-proxy')
      .attach('file', Buffer.from('image-bytes'), 'example.jpg');

    expect(response.status).toBe(412);
    expect(response.body.error).toContain('Catbox rejected the upload');
    expect(response.body.details).toBe('You must provide a userhash');

    expect(CatboxService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        reqtype: 'fileupload',
        filename: 'example.jpg',
        mimeType: 'image/jpeg',
        userhash: undefined
      })
    );

    const uploadPayload = vi.mocked(CatboxService.upload).mock.calls[0]?.[0];
    expect(uploadPayload?.file).toBeInstanceOf(Uint8Array);
  });

  it('prefers request-provided userhash over stored value', async () => {
    vi.mocked(CatboxService.getUserHash).mockResolvedValue('stored-hash-should-not-be-used');
    vi.mocked(CatboxService.upload).mockResolvedValue({
      success: true,
      url: 'https://files.catbox.moe/request.png'
    });

    const response = await request(app)
      .post('/api/upload/catbox-proxy')
      .field('userhash', 'request-hash')
      .attach('file', Buffer.from('image-bytes'), 'from-request.png');

    expect(response.status).toBe(200);
    expect(CatboxService.getUserHash).not.toHaveBeenCalled();
    expect(CatboxService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        reqtype: 'fileupload',
        filename: 'from-request.png',
        mimeType: 'image/png',
        userhash: 'request-hash'
      })
    );

    const uploadPayload = vi.mocked(CatboxService.upload).mock.calls[0]?.[0];
    expect(uploadPayload?.file).toBeInstanceOf(Uint8Array);
  });
});
