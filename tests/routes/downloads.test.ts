import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { createLocalDownloadRouter } from '../../server/routes/downloads.js';
import { MediaManager } from '../../server/lib/media.js';

describe('createLocalDownloadRouter', () => {
  const app = express();
  app.use('/uploads', createLocalDownloadRouter());

  beforeAll(async () => {
    await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('streams the asset when a valid token is provided', async () => {
    const key = `user/${Date.now()}-valid.txt`;
    const assetPath = path.join(process.cwd(), 'uploads', `asset-${crypto.randomUUID()}.txt`);
    await fs.writeFile(assetPath, 'downloadable-content');

    const token = crypto.randomUUID();
    const validateSpy = vi
      .spyOn(MediaManager, 'validateDownloadToken')
      .mockResolvedValue({ assetId: 1, userId: 1, key });
    const pathSpy = vi
      .spyOn(MediaManager, 'getLocalAssetPath')
      .mockReturnValue(assetPath);

    const response = await request(app).get(`/uploads/${token}`);

    expect(response.status).toBe(200);
    expect(response.text).toBe('downloadable-content');
    expect(response.headers['content-type']).toMatch(/text\/plain/u);
    expect(validateSpy).toHaveBeenCalledWith(token);
    expect(pathSpy).toHaveBeenCalledWith(key);

    await fs.rm(assetPath, { force: true });
  });

  it('returns 404 for an invalid token', async () => {
    const validateSpy = vi
      .spyOn(MediaManager, 'validateDownloadToken')
      .mockResolvedValue(null);
    const pathSpy = vi.spyOn(MediaManager, 'getLocalAssetPath');

    const response = await request(app).get(`/uploads/${crypto.randomUUID()}`);
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Asset not found' });
    expect(validateSpy).toHaveBeenCalled();
    expect(pathSpy).not.toHaveBeenCalled();
  });

  it('returns 404 for an expired token', async () => {
    const token = crypto.randomUUID();
    const validateSpy = vi
      .spyOn(MediaManager, 'validateDownloadToken')
      .mockResolvedValue(null);
    const pathSpy = vi.spyOn(MediaManager, 'getLocalAssetPath');

    const response = await request(app).get(`/uploads/${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: 'Asset not found' });
    expect(validateSpy).toHaveBeenCalledWith(token);
    expect(pathSpy).not.toHaveBeenCalled();
  });
});