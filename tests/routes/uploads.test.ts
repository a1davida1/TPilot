import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import uploadsRouter, { uploadErrorHandler } from '../../server/routes/uploads.js';
import { MediaManager } from '../../server/lib/media.js';
import { storage } from '../../server/storage.js';
import type { AuthRequest } from '../../server/middleware/auth.js';

// Mock dependencies
vi.mock('../../server/lib/media.js');
vi.mock('../../server/storage.js');

// Create a mock authenticateToken that we can control
let mockAuthenticateToken: ((req: AuthRequest, res: express.Response, next: express.NextFunction) => void) | undefined;

vi.mock('../../server/middleware/auth.js', () => ({
  authenticateToken: vi.fn((required: boolean) => {
    return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
      if (mockAuthenticateToken) {
        return mockAuthenticateToken(req, res, next);
      }
      if (required && !req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    };
  })
}));

describe('POST /api/uploads', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateToken = undefined;
    
    // Set up Express app with proper middleware ordering
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use(uploadsRouter);
    app.use(uploadErrorHandler);
  });

  afterEach(() => {
    mockAuthenticateToken = undefined;
  });

  it('should successfully upload a file for authenticated user', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
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

    // Mock authenticated user
    mockAuthenticateToken = (req: AuthRequest, _res, next) => {
      req.user = mockUser as never;
      next();
    };

    vi.mocked(MediaManager.uploadFile).mockResolvedValue(mockMediaAsset);
    vi.mocked(storage.createUserImage).mockResolvedValue(mockUserImage);

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .set('Content-Type', 'multipart/form-data');

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
        mimeType: 'image/jpeg'
      })
    );
  });

  it('should return 400 if no file is provided', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    
    mockAuthenticateToken = (req: AuthRequest, _res, next) => {
      req.user = mockUser as never;
      next();
    };

    const response = await request(app)
      .post('/api/uploads')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'No file provided' });
  });

  it('should return 400 for unsupported file types', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    
    mockAuthenticateToken = (req: AuthRequest, _res, next) => {
      req.user = mockUser as never;
      next();
    };

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake pdf data'), 'test.pdf')
      .set('Content-Type', 'multipart/form-data');

    // Multer should reject this file type and uploadErrorHandler should format the response
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: expect.stringContaining('Unsupported file type')
    });
  });

  it('should return 413 for oversized files', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    
    mockAuthenticateToken = (req: AuthRequest, _res, next) => {
      req.user = mockUser as never;
      next();
    };
    
    vi.mocked(MediaManager.uploadFile).mockRejectedValue(
      new Error('Storage quota exceeded. Used: 100MB, Quota: 100MB')
    );

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .set('Content-Type', 'multipart/form-data');

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('quota exceeded');
  });

  it('should return 401 for unauthenticated requests', async () => {
    // Don't set mockAuthenticateToken, so auth will fail
    
    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .set('Content-Type', 'multipart/form-data');

    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  it('should handle upload errors gracefully', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };
    
    mockAuthenticateToken = (req: AuthRequest, _res, next) => {
      req.user = mockUser as never;
      next();
    };
    
    vi.mocked(MediaManager.uploadFile).mockRejectedValue(
      new Error('Upload failed')
    );

    const response = await request(app)
      .post('/api/uploads')
      .attach('file', Buffer.from('fake image data'), 'test.jpg')
      .set('Content-Type', 'multipart/form-data');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Upload failed' });
  });
});
