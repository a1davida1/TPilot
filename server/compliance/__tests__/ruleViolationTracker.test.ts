import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordPostOutcome,
  summarizeRemovalReasons,
  clearRecordedOutcomes,
  getRecordedOutcomes,
  type PostOutcomeStatus
} from '../ruleViolationTracker.js';

vi.mock('../../storage.js', () => ({
  storage: {
    recordRedditPostOutcome: vi.fn().mockResolvedValue(undefined),
    getRedditPostOutcomes: vi.fn().mockResolvedValue([]),
    getRedditPostRemovalSummary: vi.fn().mockResolvedValue([]),
    clearRedditPostOutcomes: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('ruleViolationTracker', () => {
  const userId = 42;

  beforeEach(async () => {
    vi.clearAllMocks();
    await clearRecordedOutcomes();
  });

  it('records successful posts without inflating removal counts', async () => {
    const { storage } = await import('../../storage.js');
    vi.mocked(storage.getRedditPostOutcomes).mockResolvedValue([{
      id: 1,
      userId,
      subreddit: 'testsub',
      status: 'posted',
      reason: null,
      occurredAt: new Date()
    }]);
    vi.mocked(storage.getRedditPostRemovalSummary).mockResolvedValue([]);

    const status: PostOutcomeStatus = 'posted';
    await recordPostOutcome(userId, 'testsub', { status });

    const summary = await summarizeRemovalReasons(userId);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});

    const history = await getRecordedOutcomes(userId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ subreddit: 'testsub', status });
  });

  it('aggregates removal reasons for a user', async () => {
    const { storage } = await import('../../storage.js');
    vi.mocked(storage.getRedditPostRemovalSummary).mockResolvedValue([
      { reason: 'spam', count: 2 },
      { reason: 'rules_violation', count: 1 }
    ]);

    await recordPostOutcome(userId, 'sub1', { status: 'removed', reason: 'spam' });
    await recordPostOutcome(userId, 'sub2', { status: 'removed', reason: 'spam' });
    await recordPostOutcome(userId, 'sub3', { status: 'removed', reason: 'rules_violation' });

    const summary = await summarizeRemovalReasons(userId);
    expect(summary.total).toBe(3);
    expect(summary.byReason).toEqual({
      spam: 2,
      rules_violation: 1
    });
  });

  it('handles empty state by returning zero counts', async () => {
    const { storage } = await import('../../storage.js');
    vi.mocked(storage.getRedditPostRemovalSummary).mockResolvedValue([]);

    const summary = await summarizeRemovalReasons(999);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});
  });

  it('defaults missing removal reasons to unspecified bucket', async () => {
    const { storage } = await import('../../storage.js');
    vi.mocked(storage.getRedditPostRemovalSummary).mockResolvedValue([
      { reason: null, count: 1 },
      { reason: '  ', count: 1 }
    ]);

    await recordPostOutcome(userId, 'sub1', { status: 'removed' });
    await recordPostOutcome(userId, 'sub2', { status: 'removed', reason: '  ' });

    const summary = await summarizeRemovalReasons(userId);
    expect(summary.total).toBe(2);
    expect(summary.byReason).toEqual({ unspecified: 2 });
  });
});
