import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RedditCommunity } from '@shared/schema';

describe('normalizeCommunityRecord', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('delegates competition level and mod activity normalization to shared canonicalizers', async () => {
    const canonicalizeCompetitionLevel = vi.fn().mockReturnValue('low');
    const canonicalizeModActivity = vi.fn().mockReturnValue('unknown');

    vi.doMock('@shared/schema', async () => {
      const actual = await vi.importActual<typeof import('@shared/schema')>('@shared/schema');
      return {
        ...actual,
        canonicalizeCompetitionLevel,
        canonicalizeModActivity,
      };
    });

    const { normalizeCommunityRecord } = await import('../../../server/reddit-communities.ts');

    const rawCommunity: RedditCommunity = {
      id: 'unit_test',
      name: 'unit_test',
      displayName: 'Unit Test',
      members: 1234,
      engagementRate: 56,
      category: 'general',
      verificationRequired: false,
      promotionAllowed: 'limited',
      postingLimits: null,
      rules: null,
      bestPostingTimes: null,
      averageUpvotes: null,
      successProbability: null,
      growthTrend: null,
      modActivity: 'HIGH',
      description: null,
      tags: null,
      competitionLevel: 'MED',
      over18: false,
      subscribers: 987,
    };

    const normalized = normalizeCommunityRecord(rawCommunity);

    expect(canonicalizeCompetitionLevel).toHaveBeenCalledTimes(1);
    expect(canonicalizeCompetitionLevel).toHaveBeenCalledWith('MED');
    expect(canonicalizeModActivity).toHaveBeenCalledTimes(1);
    expect(canonicalizeModActivity).toHaveBeenCalledWith('HIGH');

    expect(normalized.competitionLevel).toBe('low');
    expect(normalized.modActivity).toBe('unknown');
  });
});
