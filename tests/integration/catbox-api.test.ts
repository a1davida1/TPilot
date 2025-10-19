import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';

import { createApp } from '../../server/index.ts';
import { storage } from '../../server/storage.ts';
import { db } from '../../server/db.ts';
import { catboxUploads } from '../../shared/schema.ts';
import { CatboxService } from '../../server/lib/catbox-service.ts';

const TEST_SECRET = process.env.JWT_SECRET || 'test-secret-key-with-at-least-32-characters!!';
process.env.JWT_SECRET = TEST_SECRET;

describe('Catbox API analytics', () => {
  let app: Express;
  let userId: number;
  let token: string;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });

    app = result.app;

    const user = await storage.createUser({
      username: 'catbox-analytics-user',
      email: 'catbox-analytics@test.com',
      password: 'hashed-password',
    });

    userId = user.id;
    token = jwt.sign({ userId, email: user.email }, TEST_SECRET);
  });

  afterAll(async () => {
    await db.delete(catboxUploads).where(eq(catboxUploads.userId, userId));
    await storage.deleteUser(userId).catch(() => {});
  });

  beforeEach(async () => {
    await db.delete(catboxUploads).where(eq(catboxUploads.userId, userId));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns zeroed stats when no uploads exist', async () => {
    const response = await request(app)
      .get('/api/catbox/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      totalUploads: 0,
      successfulUploads: 0,
      failedUploads: 0,
      totalSize: 0,
      successRate: 0,
      averageDuration: 0,
    });

    expect(Array.isArray(response.body.uploadsByDay)).toBe(true);
    expect(response.body.uploadsByDay.length).toBeGreaterThan(0);
  });

  it('aggregates upload metrics and timeline data', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(now.getDate() - 7);

    await db.insert(catboxUploads).values([
      {
        userId,
        url: 'https://files.catbox.moe/upload-1.jpg',
        filename: 'upload-1.jpg',
        fileSize: 1024,
        uploadDuration: 420,
        success: true,
        provider: 'catbox',
        uploadedAt: now,
      },
      {
        userId,
        url: 'https://files.catbox.moe/upload-2.jpg',
        filename: 'upload-2.jpg',
        fileSize: 2048,
        uploadDuration: 600,
        success: true,
        provider: 'catbox',
        uploadedAt: yesterday,
      },
      {
        userId,
        url: 'https://files.catbox.moe/upload-3.jpg',
        filename: 'upload-3.jpg',
        fileSize: 512,
        uploadDuration: 800,
        success: false,
        provider: 'catbox',
        uploadedAt: lastWeek,
        errorMessage: 'Simulated failure',
      },
    ]);

    const response = await request(app)
      .get('/api/catbox/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.totalUploads).toBe(3);
    expect(response.body.successfulUploads).toBe(2);
    expect(response.body.failedUploads).toBe(1);
    expect(response.body.totalSize).toBe(3584);
    expect(response.body.averageDuration).toBeGreaterThan(0);
    expect(response.body.successRate).toBeLessThan(100);
    expect(Array.isArray(response.body.uploadsByDay)).toBe(true);
    expect(response.body.uploadsByDay.length).toBeGreaterThanOrEqual(3);
    expect(response.body.recentUploads).toHaveLength(2);
    expect(response.body.recentUploads[0].url).toBe('https://files.catbox.moe/upload-1.jpg');
    expect(response.body.lastUploadAt).not.toBeNull();
  });

  it('records failed upload attempts for authenticated creators', async () => {
    const uploadSpy = vi.spyOn(CatboxService, 'upload').mockResolvedValue({
      success: false,
      error: 'Simulated upstream outage',
      status: 503,
    });

    const response = await request(app)
      .post('/api/catbox/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('sample-bytes'), 'failure.jpg');

    expect(response.status).toBe(503);
    expect(response.body.error).toBe('Simulated upstream outage');

    const records = await db
      .select()
      .from(catboxUploads)
      .where(eq(catboxUploads.userId, userId));

    expect(records).toHaveLength(1);
    expect(records[0]?.success).toBe(false);
    expect(records[0]?.filename).toBe('failure.jpg');
    expect(records[0]?.errorMessage).toContain('Simulated upstream outage');

    uploadSpy.mockRestore();
  });

  it('requires authentication', async () => {
    await request(app)
      .get('/api/catbox/stats')
      .expect(401);
  });
});
