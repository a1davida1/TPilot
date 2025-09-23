import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request, { Test } from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import { createApp } from '../../server/app.js';
import { storage } from '../../server/storage.js';
import { db } from '../../server/db.js';
import { postJobs, type InsertUser } from '../../shared/schema.js';
import * as queueModule from '../../server/lib/queue/index.js';
import { PostScheduler } from '../../server/lib/scheduling.js';

interface PostingJobPayload {
  userId: number;
  postJobId: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal: string;
  mediaKey?: string;
}

describe('POST /api/posts/schedule', () => {
  let app: Express;
  let userId: number;
  let authToken: string;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });

    app = result.app;

    const uniqueSuffix = Date.now();
    const newUser: InsertUser = {
      username: `scheduler-user-${uniqueSuffix}`,
      password: 'hashed-password',
      email: `scheduler-${uniqueSuffix}@example.com`,
      emailVerified: true,
      tier: 'free',
      subscriptionStatus: 'active',
    };

    const createdUser = await storage.createUser(newUser);
    userId = createdUser.id;

    authToken = jwt.sign(
      {
        userId,
        username: createdUser.username,
        email: createdUser.email,
      },
      process.env.JWT_SECRET || 'test-secret-key',
    );
  });

  afterEach(async () => {
    if (typeof userId === 'number') {
      await db.delete(postJobs).where(eq(postJobs.userId, userId));
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (typeof userId === 'number') {
      await db.delete(postJobs).where(eq(postJobs.userId, userId));
      await storage.deleteUser(userId).catch(() => {});
    }
  });

  it('enqueues a posting job for authenticated users', async () => {
    const fixedNow = 1_700_000_000_000;
    const futureDate = new Date(fixedNow + 60_000);

    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const addJobSpy = vi
      .spyOn(queueModule, 'addJob')
      .mockResolvedValue(undefined);
    const chooseSendTimeSpy = vi
      .spyOn(PostScheduler, 'chooseSendTime')
      .mockResolvedValue(futureDate);

    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subreddit: 'integrationtest',
        title: 'Integration Test Title',
        body: 'Integration test body',
      })
      .expect(200);

    expect(chooseSendTimeSpy).toHaveBeenCalledWith('integrationtest');
    expect(response.body).toMatchObject({
      success: true,
      postJobId: expect.any(Number),
      scheduledAt: futureDate.toISOString(),
    });

    expect(addJobSpy).toHaveBeenCalledTimes(1);
    const callArgs = addJobSpy.mock.calls[0] as [
      queueModule.QueueNames | 'posting',
      PostingJobPayload,
      { delay: number }
    ];

    expect(callArgs[0]).toBe('posting');
    expect(callArgs[1]).toMatchObject({
      userId,
      postJobId: expect.any(Number),
      subreddit: 'integrationtest',
      titleFinal: 'Integration Test Title',
      bodyFinal: 'Integration test body',
    });
    expect(callArgs[2]).toMatchObject({
      delay: expect.any(Number),
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const response = await request(app)
      .post('/api/posts/schedule')
      .send({
        subreddit: 'integrationtest',
        title: 'Test Title',
        body: 'Test body',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'Access token required',
    });
  });

  it('rejects requests with invalid tokens', async () => {
    const invalidToken = 'invalid-token-format';

    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Authorization', `Bearer ${invalidToken}`)
      .send({
        subreddit: 'integrationtest',
        title: 'Test Title',
        body: 'Test body',
      })
      .expect(401);

    expect(response.body).toMatchObject({
      error: expect.stringContaining('invalid'),
    });
  });

  it('accepts custom scheduledAt parameter', async () => {
    const customDate = new Date('2024-12-25T10:00:00.000Z');

    const addJobSpy = vi
      .spyOn(queueModule, 'addJob')
      .mockResolvedValue(undefined);

    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subreddit: 'integrationtest',
        title: 'Christmas Post',
        body: 'Happy holidays!',
        scheduledAt: customDate.toISOString(),
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      postJobId: expect.any(Number),
      scheduledAt: customDate.toISOString(),
    });

    expect(addJobSpy).toHaveBeenCalledTimes(1);
  });

  it('validates required fields', async () => {
    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        // Missing subreddit, title, and body
      })
      .expect(400);

    expect(response.body).toMatchObject({
      error: expect.stringContaining('required'),
    });
  });

  it('handles mediaKey parameter', async () => {
    const addJobSpy = vi
      .spyOn(queueModule, 'addJob')
      .mockResolvedValue(undefined);
    const chooseSendTimeSpy = vi
      .spyOn(PostScheduler, 'chooseSendTime')
      .mockResolvedValue(new Date(Date.now() + 60_000));

    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        subreddit: 'integrationtest',
        title: 'Post with Media',
        body: 'This post has media',
        mediaKey: 'test-media-key',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      postJobId: expect.any(Number),
      scheduledAt: expect.any(String),
    });

    const callArgs = addJobSpy.mock.calls[0] as [
      queueModule.QueueNames | 'posting',
      PostingJobPayload,
      { delay: number }
    ];

    expect(callArgs[1]).toMatchObject({
      mediaKey: 'test-media-key',
    });
  });
});