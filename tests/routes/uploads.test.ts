import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import type { AuthRequest } from '../../server/middleware/auth.js';

// Hoist auth middleware mock to module scope with default
let authMiddleware: (req: AuthRequest, res: express.Response, next: express.NextFunction) => void = (req, _res, next) => {
  req.user = { id: 1, email: 'test@example.com' } as never;
  next();
};

// Mock authenticateToken BEFORE importing the router
vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn(() => {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      return authMiddleware(req, res, next);
    };
  })
}));

// Mock dependencies
vi.mock('../../server/lib/media.js');
vi.mock('../../server/storage.js');

// Import AFTER mocking
import uploadsRouter, { uploadErrorHandler } from '../../server/routes/uploads.js';
import { MediaManager } from '../../server/lib/media.js';
import { storage } from '../../server/storage.js';

describe('POST /api/uploads', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default to authenticated user
    authMiddleware = (req: AuthRequest, _res, next) => {
      req.user = { id: 1, email: 'test@example.com' } as never;
      next();
    };
    
    // Set up Express app with proper middleware ordering
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(uploadsRouter);
    app.use(uploadErrorHandler);
  });

  it('should successfully upload a file for authenticated user', async () => {
    const mockMediaAsset = {
      id: 1,
      key: 'user-1/file.jpg',
      filename: 'test.jpg',
      bytes: 1024,
      mime: 'image/jpeg',
      visibility: 'private',
      signedUrl: 'https://example.com/signed-url',
      downloadUrl: 'https://example.com/download',
      createdAt: new Date()
    };
    const mockUserImage = {
      id: 1,
      userId: 1,
      filename: 'test.jpg',
      originalName: 'test.jpg',
      url: 'https://example.com/signed-url',
      mimeType: 'image/jpeg',
      size: 1024,
      isProtected: false,
      protectionLevel: 'none',
      tags: null,
      metadata: { mediaAssetId: 1, key: 'user-1/file.jpg' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    vi.mocked(MediaManager.uploadFile).mockResolvedValue(mockMediaAsset);
    vi.mocked(storage.createUserImage).mockResolvedValue(mockUserImage);

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .field('mimetype', 'image/jpeg');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: 1,
      filename: 'test.jpg',
      url: 'https://example.com/signed-url',
      downloadUrl: 'https://example.com/download',
      mimeType: 'image/jpeg',
      size: expect.any(Number)
    });

    expect(MediaManager.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        userId: 1,
        filename: 'test.jpg',
        visibility: 'private',
        applyWatermark: false
      })
    );

    expect(storage.createUserImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        filename: 'test.jpg',
        mimeType: expect.any(String)
      })
    );
  });

  it('should return 400 if no file is provided', async () => {
    const response = await request(app)
      .post('/api/uploads')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'No file provided' });
  });

  it('should return 400 for unsupported file types via error handler', async () => {
    // Create a proper MulterError
    const multerError = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    multerError.message = 'Unsupported file type';
    
    const req = {} as express.Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as unknown as express.Response;
    const next = vi.fn();

    uploadErrorHandler(multerError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('Unsupported file type')
    });
  });

  it('should return 413 for file size limit via error handler', async () => {
    const multerError = new multer.MulterError('LIMIT_FILE_SIZE');
    
    const req = {} as express.Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    } as unknown as express.Response;
    const next = vi.fn();

    uploadErrorHandler(multerError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.stringContaining('File too large')
    });
  });

  it('should return 413 for storage quota exceeded', async () => {
    vi.mocked(MediaManager.uploadFile).mockRejectedValue(
      new Error('Storage quota exceeded. Used: 100MB, Quota: 100MB')
    );

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .field('mimetype', 'image/jpeg');

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('quota exceeded');
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Override authMiddleware to reject auth
    authMiddleware = (_req: AuthRequest, res, _next) => {
      return res.status(401).json({ error: 'Authentication required' });
    };
    
    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .field('mimetype', 'image/jpeg');

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  it('should handle upload errors gracefully', async () => {
    vi.mocked(MediaManager.uploadFile).mockRejectedValue(
      new Error('Upload failed')
    );

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .field('mimetype', 'image/jpeg');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Upload failed' });
  });
});
