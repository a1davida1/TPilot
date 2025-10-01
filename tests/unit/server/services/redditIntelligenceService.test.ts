import type snoowrap from 'snoowrap';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDefaultRules } from '../../../../shared/schema.ts';

vi.mock('../../../../server/lib/reddit.ts', () => ({
  getRedditServiceClient: vi.fn(),
  registerDefaultRedditClients: vi.fn(),
  REDDIT_SERVICE_CLIENT_KEYS: { COMMUNITY_SYNC: 'community-sync' },
}));

vi.mock('../../../../server/reddit-communities.ts', async () => {
  const actual = await vi.importActual<typeof import('../../../../server/reddit-communities.ts')>(
    '../../../../server/reddit-communities.ts'
  );
  return {
    ...actual,
    listCommunities: vi.fn(),
  };
});

import { getRedditServiceClient } from '../../../../server/lib/reddit.ts';
import { listCommunities, type NormalizedRedditCommunity } from '../../../../server/reddit-communities.ts';
import { RedditIntelligenceService } from '../../../../server/services/reddit-intelligence.ts';
import { stateStore } from '../../../../server/services/state-store.ts';

class InMemoryCacheStore {
  private store = new Map<string, { value: unknown; expires: number }>();

  async set(key: string, value: unknown, expiresIn: number): Promise<void> {
    this.store.set(key, { value, expires: Date.now() + (expiresIn * 1000) });
  }

  async get(key: string): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('RedditIntelligenceService', () => {
  const cache = new InMemoryCacheStore();
  const getHotMock = vi.fn<(options: { limit: number }) => Promise<unknown>>();

  const community: NormalizedRedditCommunity = {
    id: 'r/testsub',
    name: 'testsub',
    displayName: 'r/testsub',
    members: 125000,
    engagementRate: 48,
    category: 'fitness',
    verificationRequired: false,
    promotionAllowed: 'limited',
    postingLimits: null,
    rules: createDefaultRules(),
    bestPostingTimes: ['08:00', '20:00'],
    averageUpvotes: 820,
    successProbability: 82,
    growthTrend: 'up',
    modActivity: 'high',
    description: 'A community for fitness transformations',
    tags: ['fitness'],
    competitionLevel: 'medium',
  };

  beforeEach(() => {
    cache.clear();
    getHotMock.mockReset();
    vi.mocked(listCommunities).mockResolvedValue([community]);
    const client = {
      getSubreddit: vi.fn(() => ({
        getHot: getHotMock,
      })),
    };
    vi.mocked(getRedditServiceClient).mockReturnValue(client as unknown as snoowrap);
    getHotMock.mockResolvedValue([
      {
        id: 'abc123',
        title: 'Intense 30-day fitness challenge results',
        subreddit: 'testsub',
        score: 540,
        num_comments: 210,
        created_utc: Math.floor(Date.now() / 1000),
        url: 'https://www.reddit.com/r/testsub/comments/abc123',
        link_flair_text: 'Progress',
        over_18: false,
      },
    ]);
  });

  it('builds intelligence dataset and caches subsequent calls', async () => {
    const service = new RedditIntelligenceService({ store: cache as unknown as typeof stateStore, cacheTtlSeconds: 60 });
    const dataset = await service.getIntelligence({ userId: 42 });

    expect(dataset.trendingTopics).toHaveLength(1);
    expect(dataset.trendingTopics[0]?.category).toBe('fitness');
    expect(dataset.subredditHealth).toHaveLength(1);
    expect(dataset.forecastingSignals).toHaveLength(1);

    expect(getHotMock).toHaveBeenCalledTimes(2);

    const secondCall = await service.getIntelligence({ userId: 42 });
    expect(secondCall.trendingTopics).toHaveLength(1);
    expect(getHotMock).toHaveBeenCalledTimes(2);
  });

  it('provides fallback topics when Reddit data is unavailable', async () => {
    getHotMock.mockRejectedValueOnce(new Error('rate limited'));
    const service = new RedditIntelligenceService({ store: cache as unknown as typeof stateStore, cacheTtlSeconds: 1 });
    const trending = await service.getTrendingTopics();

    expect(trending.length).toBeGreaterThan(0);
  });
});
