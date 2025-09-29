
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

import { createApp } from '../../server/index.ts';
import { db } from '../../server/db.ts';
import { postJobs, users } from '../../shared/schema.ts';
import * as queueModule from '../../server/lib/queue/index.ts';
import { PostScheduler } from '../../server/lib/scheduling.ts';

interface PostingJobPayload {
  userId: number;
  postJobId: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal: string;
  mediaKey?: string;
}

type PostJobInsert = typeof postJobs.$inferInsert;
type PostJobRecord = typeof postJobs.$inferSelect;

// Set up test environment variables
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret-key-1234567890abcd';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-api-key';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$abcdefghijklmnopqrstuv';
process.env.GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || 'test-google-genai-api-key';
process.env.REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID || 'test-reddit-client-id';
process.env.REDDIT_CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET || 'test-reddit-client-secret';
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123456789012345678901234567890';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123456789012345678901234567890';
process.env.STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || '2023-10-16';

describe('POST /api/posts/schedule', () => {
  let app: Express;
  let userId: number;
  let authToken: string;
  let username: string;
  let testUser: typeof users.$inferSelect;

  beforeAll(async () => {
    const result = await createApp({
      startQueue: false,
      configureStaticAssets: false,
      enableVite: false,
    });

    app = result.app;

    const uniqueSuffix = Date.now();
    username = `scheduler-user-${uniqueSuffix}`;
    userId = Number(String(uniqueSuffix).slice(-6)) || 1;
    const email = `scheduler-${uniqueSuffix}@example.com`;
    const hashedPassword = await bcrypt.hash('ScheduleTestPass123!', 10);
    const now = new Date();

    testUser = {
      id: userId,
      username,
      password: hashedPassword,
      email,
      emailVerified: true,
      firstName: null,
      lastName: null,
      tier: 'free',
      subscriptionStatus: 'active',
      trialEndsAt: null,
      provider: null,
      providerId: null,
      avatar: null,
      referralCodeId: null,
      referredBy: null,
      createdAt: now,
      updatedAt: now,
    };

    authToken = jwt.sign(
      {
        userId,
        username,
        email,
      },
      process.env.JWT_SECRET || 'test-secret-key-1234567890-abcdef',
      { expiresIn: '1h' }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  const mockUserLookup = () => {
    vi.spyOn(db, 'select').mockReturnValue({
      from: () => ({
        where: async () => [testUser],
      }),
    } as unknown as ReturnType<typeof db.select>);
  };

  let nextPostJobId = 1;

  const mockPostJobInsert = () => {
    vi.spyOn(db, 'insert').mockImplementation(() => ({
      values: (values: PostJobInsert) => ({
        returning: async () => {
          const timestamp = new Date();
          const record: PostJobRecord = {
            id: nextPostJobId++,
            userId: values.userId,
            subreddit: values.subreddit,
            titleFinal: values.titleFinal,
            bodyFinal: values.bodyFinal,
            mediaKey: values.mediaKey ?? null,
            scheduledAt: values.scheduledAt ?? timestamp,
            status: 'queued',
            resultJson: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          return [record];
        },
      }),
    }) as unknown as ReturnType<typeof db.insert>);
  };

  const mockUserAndScheduledPostsLookup = (scheduledPosts: PostJobRecord[]) => {
    vi.spyOn(db, 'select').mockImplementation(() => ({
      from: (table: unknown) => {
        if (table === users) {
          return {
            where: async () => [testUser],
          };
        }

        if (table === postJobs) {
          return {
            where: () => ({
              orderBy: () => ({
                limit: async () => scheduledPosts,
              }),
            }),
          };
        }

        throw new Error('Unexpected table query in mock');
      },
    }) as unknown as ReturnType<typeof db.select>);
  };

  it('enqueues a posting job for authenticated users', async () => {
    const fixedNow = 1_700_000_000_000;
    const futureDate = new Date(fixedNow + 60_000);

    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    mockUserLookup();
    mockPostJobInsert();

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

  it('accepts authenticated cookie sessions and enqueues a posting job', async () => {
    const fixedNow = 1_700_000_500_000;
    const futureDate = new Date(fixedNow + 120_000);

    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    mockUserLookup();
    mockPostJobInsert();

    const addJobSpy = vi
      .spyOn(queueModule, 'addJob')
      .mockResolvedValue(undefined);
    const chooseSendTimeSpy = vi
      .spyOn(PostScheduler, 'chooseSendTime')
      .mockResolvedValue(futureDate);

    const authCookie = `authToken=${authToken}; Path=/; HttpOnly`;

    const response = await request(app)
      .post('/api/posts/schedule')
      .set('Cookie', authCookie)
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
      message: 'Access token required',
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
      .expect(403);

    expect(response.body).toMatchObject({
      error: 'Invalid token',
      message: 'Invalid token',
    });
  });

  it('accepts custom scheduledAt parameter', async () => {
    const customDate = new Date('2024-12-25T10:00:00.000Z');

    mockUserLookup();
    mockPostJobInsert();

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
    mockUserLookup();

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
    mockUserLookup();
    mockPostJobInsert();

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

  it('returns scheduled posts for authenticated users', async () => {
    const now = new Date();
    const scheduledPosts: PostJobRecord[] = [
      {
        id: 101,
        userId,
        subreddit: 'integrationtest',
        titleFinal: 'Scheduled Title 1',
        bodyFinal: 'Scheduled Body 1',
        mediaKey: null,
        scheduledAt: new Date(now.getTime() + 60_000),
        status: 'queued',
        resultJson: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 102,
        userId,
        subreddit: 'integrationtest2',
        titleFinal: 'Scheduled Title 2',
        bodyFinal: 'Scheduled Body 2',
        mediaKey: null,
        scheduledAt: new Date(now.getTime() + 120_000),
        status: 'queued',
        resultJson: null,
        createdAt: now,
        updatedAt: now,
      },
    ];

    mockUserAndScheduledPostsLookup(scheduledPosts);

    const response = await request(app)
      .get('/api/posts/scheduled')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const expectedResponse = scheduledPosts.map((post) => ({
      ...post,
      scheduledAt: post.scheduledAt.toISOString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    }));

    expect(response.body).toEqual(expectedResponse);
  });

  it('rejects unauthenticated requests for scheduled posts', async () => {
    const response = await request(app)
      .get('/api/posts/scheduled')
      .expect(401);

    expect(response.body).toMatchObject({
      error: 'Access token required',
    });
  });
});
