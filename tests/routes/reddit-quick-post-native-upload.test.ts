import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerRedditRoutes } from '../../server/reddit-routes.ts';
import { RedditNativeUploadService } from '../../server/services/reddit-native-upload.ts';
import { SafetyManager } from '../../server/lib/safety-systems.js';
import { recordPostOutcome } from '../../server/compliance/ruleViolationTracker.js';
import { RedditManager } from '../../server/lib/reddit.js';

type RequestWithUser = express.Request & { user?: { id: number } };

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: vi.fn(() => (req: RequestWithUser, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 42 };
    next();
  }),
}));

vi.mock('../../server/services/reddit-native-upload.ts', () => ({
  RedditNativeUploadService: {
    uploadAndPost: vi.fn(),
  },
}));

vi.mock('../../server/lib/safety-systems.js', () => ({
  SafetyManager: {
    recordPost: vi.fn().mockResolvedValue(undefined),
    recordPostForDuplicateDetection: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../server/compliance/ruleViolationTracker.js', () => ({
  recordPostOutcome: vi.fn().mockResolvedValue(undefined),
  summarizeRemovalReasons: vi.fn(),
}));

vi.mock('../../server/bootstrap/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../server/services/state-store.js', () => ({
  stateStore: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  encrypt: vi.fn((value: unknown) => value),
  decrypt: vi.fn((value: unknown) => value),
  rateLimit: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

vi.mock('../../server/services/reddit-intelligence.ts', () => ({
  redditIntelligenceService: {
    getIntelligence: vi.fn(),
    getTrendingTopics: vi.fn(),
  },
}));

vi.mock('../../server/lib/reddit.js', () => {
  class RedditManagerMock {
    constructor(..._args: unknown[]) {}

    static forUser = vi.fn();

    static canPostToSubreddit = vi.fn();

    submitPost = vi.fn();

    submitGalleryPost = vi.fn();

    applyFlair = vi.fn();

    testConnection = vi.fn();

    getProfile = vi.fn();

    checkSubredditCapabilities = vi.fn();
  }

  return {
    RedditManager: RedditManagerMock,
    getRedditAuthUrl: vi.fn(() => 'https://reddit.example/auth'),
    exchangeRedditCode: vi.fn(),
    getUserRedditCommunityEligibility: vi.fn(),
  };
});

function createApp() {
  const app = express();
  app.use(express.json());
  registerRedditRoutes(app);
  return app;
}

describe('POST /api/reddit/post', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Reddit native upload for quick post images and returns CDN metadata', async () => {
    const uploadResult = {
      success: true,
      postId: 't3_test123',
      url: 'https://www.reddit.com/r/test/comments/test123/title',
      redditImageUrl: 'https://i.redd.it/test-image.jpg',
      warnings: ['Catbox fallback skipped'],
    };
    vi.mocked(RedditNativeUploadService.uploadAndPost).mockResolvedValue(uploadResult);

    const response = await request(createApp())
      .post('/api/reddit/post')
      .send({
        title: 'Native upload verification',
        subreddit: 'test',
        imageUrl: 'https://cdn.example.com/photo.png?token=secret',
        text: 'Body caption',
        nsfw: true,
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        postId: 't3_test123',
        url: uploadResult.url,
        redditImageUrl: uploadResult.redditImageUrl,
        warnings: uploadResult.warnings,
      })
    );

    expect(RedditNativeUploadService.uploadAndPost).toHaveBeenCalledWith({
      userId: 42,
      subreddit: 'test',
      title: 'Native upload verification',
      imageUrl: 'https://cdn.example.com/photo.png',
      nsfw: true,
      spoiler: false,
      allowCatboxFallback: true,
    });

    expect(SafetyManager.recordPost).toHaveBeenCalledWith('42', 'test');
    expect(SafetyManager.recordPostForDuplicateDetection).toHaveBeenCalledWith(
      '42',
      'test',
      'Native upload verification',
      'Body caption',
    );
    expect(recordPostOutcome).not.toHaveBeenCalled();
  });

  it('propagates native upload errors and records removal outcomes', async () => {
    vi.mocked(RedditNativeUploadService.uploadAndPost).mockResolvedValue({
      success: false,
      error: 'No active Reddit account found. Please connect your Reddit account first.',
      decision: {
        reason: 'account_required',
        reasons: ['account_required'],
        warnings: ['Link your Reddit account'],
        postsInLast24h: 1,
        maxPostsPer24h: 3,
        nextAllowedPost: new Date().toISOString(),
      },
    });

    const response = await request(createApp())
      .post('/api/reddit/post')
      .send({
        title: 'Missing account',
        subreddit: 'test',
        imageUrl: 'https://cdn.example.com/missing.png',
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('No active Reddit account');

    expect(recordPostOutcome).toHaveBeenCalledWith(42, 'test', {
      status: 'removed',
      reason: 'No active Reddit account found. Please connect your Reddit account first.',
    });
    expect(SafetyManager.recordPost).not.toHaveBeenCalled();
  });

  it('falls back to text posting when no image is provided', async () => {
    const redditClient = {
      submitPost: vi.fn().mockResolvedValue({
        success: true,
        postId: 't3_text123',
        url: 'https://www.reddit.com/r/test/comments/text123/title',
        decision: { warnings: [] },
      }),
    };
    vi.mocked(RedditManager.forUser).mockResolvedValue(redditClient as never);

    const response = await request(createApp())
      .post('/api/reddit/post')
      .send({
        title: 'Text fallback',
        subreddit: 'test',
        text: 'Only text provided',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        postId: 't3_text123',
        url: 'https://www.reddit.com/r/test/comments/text123/title',
      }),
    );

    expect(RedditNativeUploadService.uploadAndPost).not.toHaveBeenCalled();
    expect(redditClient.submitPost).toHaveBeenCalledWith({
      subreddit: 'test',
      title: 'Text fallback',
      body: 'Only text provided',
      nsfw: false,
      spoiler: false,
    });
    expect(recordPostOutcome).toHaveBeenCalledWith(42, 'test', { status: 'posted' });
  });
});
