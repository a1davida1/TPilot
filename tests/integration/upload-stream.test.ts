
import express from 'express';
import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  test,
  expect,
  vi
} from 'vitest';

interface MockUploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  filename: string;
  path: string;
  size: number;
}

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

const streamingState = vi.hoisted(() => ({
  files: [] as MockUploadedFile[],
  body: {} as Record<string, unknown>
}));

const authenticatedUser = vi.hoisted(() => ({ id: 99, tier: 'free' }));

vi.mock('../../server/middleware/security.js', () => ({
  uploadLimiter: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
  logger: loggerMock
}));

vi.mock('../../server/middleware/tiered-rate-limit.js', () => ({
  imageProtectionLimiter: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  }
}));

vi.mock('../../server/middleware/streaming-upload.js', () => ({
  cleanupUploadedFiles: (_req: unknown, _res: unknown, next: () => void) => {
    next();
  },
  imageStreamingUpload: (
    req: Record<string, unknown> & { streamingFiles?: MockUploadedFile[]; body?: Record<string, unknown> },
    _res: unknown,
    next: () => void
  ) => {
    req.streamingFiles = streamingState.files;
    req.body = { ...streamingState.body };
    next();
  }
}));

vi.mock('../../server/middleware/auth.js', async () => {
  const actual = await vi.importActual<typeof import('../../server/middleware/auth.js')>(
    '../../server/middleware/auth.js'
  );

  return {
    ...actual,
    authenticateToken: (req: Record<string, unknown> & { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = authenticatedUser;
      next();
    }
  };
});

describe('stream upload error handling', () => {
  let app: express.Express;
  let sampleImagePath: string;
  const uploadsDir = path.join(process.cwd(), 'uploads');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fixturesDir = path.join(__dirname, '__fixtures__', 'stream');

  beforeAll(async () => {
    await fs.mkdir(fixturesDir, { recursive: true });

    sampleImagePath = path.join(fixturesDir, 'sample.png');
    await sharp({
      create: {
        width: 48,
        height: 48,
        channels: 3,
        background: { r: 20, g: 40, b: 80 }
      }
    })
      .png()
      .toFile(sampleImagePath);

    const { uploadRoutes } = await import('../../server/routes/upload.js');

    app = express();
    app.use(express.json());
    app.use('/api/uploads', uploadRoutes);
  });

  beforeEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await fs.mkdir(uploadsDir, { recursive: true });
    streamingState.files = [];
    streamingState.body = {};
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
  });

  afterAll(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
    await fs.rm(fixturesDir, { recursive: true, force: true });
  });

  test('returns 500 when secure filename generation fails', async () => {
    const tempFilename = `stream-temp-${Date.now()}.png`;
    const tempFilePath = path.join(uploadsDir, tempFilename);
    await fs.copyFile(sampleImagePath, tempFilePath);
    const stats = await fs.stat(tempFilePath);

    streamingState.files = [{
      fieldname: 'file',
      originalname: 'sample.png',
      encoding: '7bit',
      mimetype: 'image/png',
      filename: tempFilename,
      path: tempFilePath,
      size: stats.size
    }];

    streamingState.body = {
      protectionLevel: 'standard',
      addWatermark: false
    };

    const randomBytesSpy = vi.spyOn(crypto, 'randomBytes').mockImplementation(() => {
      throw new Error('random failure');
    });
    const unlinkSpy = vi.spyOn(fs, 'unlink');

    let response: request.Response | undefined;
    let unlinkArgs: unknown[] = [];
    try {
      response = await request(app)
        .post('/api/uploads/stream')
        .send({});
      unlinkArgs = unlinkSpy.mock.calls.map(call => call[0]);
    } finally {
      randomBytesSpy.mockRestore();
      unlinkSpy.mockRestore();
    }

    expect(response).toBeDefined();
    expect(response?.status).toBe(500);
    expect(response?.body).toEqual({ message: 'Upload processing failed' });

    expect(loggerMock.error).toHaveBeenCalled();
    expect(unlinkArgs).toContain(tempFilePath);
    expect(unlinkArgs.every(arg => typeof arg === 'string' && arg.length > 0)).toBe(true);
  });
});
