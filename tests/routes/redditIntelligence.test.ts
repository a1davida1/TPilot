import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../server/middleware/auth.ts', () => ({
  authenticateToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const requestWithUser = req as express.Request & { user?: { id: number } };
    requestWithUser.user = { id: 99 };
    next();
  }
}));

vi.mock('../../server/services/reddit-intelligence.ts', () => ({
  redditIntelligenceService: {
    getIntelligence: vi.fn(),
    getTrendingTopics: vi.fn()
  }
}));

import { registerRedditRoutes } from '../../server/reddit-routes.ts';
import { redditIntelligenceService } from '../../server/services/reddit-intelligence.ts';

function createApp() {
  const app = express();
  app.use(express.json());
  registerRedditRoutes(app);
  return app;
}

describe('GET /api/reddit/intelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated intelligence for authenticated users', async () => {
    const dataset = {
      fetchedAt: new Date().toISOString(),
      trendingTopics: [
        {
          topic: 'Sample',
          subreddit: 'r/test',
          score: 90,
          comments: 100,
          category: 'creative',
          url: 'https://example.com',
          nsfw: false,
          postedAt: new Date().toISOString()
        }
      ],
      subredditHealth: [],
      forecastingSignals: []
    };
    vi.mocked(redditIntelligenceService.getIntelligence).mockResolvedValue(dataset);

    const response = await request(createApp()).get('/api/reddit/intelligence');

    expect(response.status).toBe(200);
    expect(response.body.trendingTopics).toHaveLength(1);
    expect(redditIntelligenceService.getIntelligence).toHaveBeenCalledWith({ userId: 99 });
  });

  it('handles service failures gracefully', async () => {
    vi.mocked(redditIntelligenceService.getIntelligence).mockRejectedValue(new Error('offline'));

    const response = await request(createApp()).get('/api/reddit/intelligence');

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('Failed to load Reddit intelligence');
  });
});
