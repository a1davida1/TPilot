import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  recordPostOutcome,
  summarizeRemovalReasons,
  clearRecordedOutcomes,
  getRecordedOutcomes,
  type PostOutcomeStatus
} from '../ruleViolationTracker.js';

describe('ruleViolationTracker', () => {
  const userId = 42;

  beforeEach(async () => {
    await clearRecordedOutcomes();
  });

  afterAll(async () => {
    await clearRecordedOutcomes();
  });

  it('records successful posts without inflating removal counts', async () => {
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
    const summary = await summarizeRemovalReasons(999);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});
  });

  it('defaults missing removal reasons to unspecified bucket', async () => {
    await recordPostOutcome(userId, 'sub1', { status: 'removed' });
    await recordPostOutcome(userId, 'sub2', { status: 'removed', reason: '  ' });

    const summary = await summarizeRemovalReasons(userId);
    expect(summary.total).toBe(2);
    expect(summary.byReason).toEqual({ unspecified: 2 });
  });

  it('persists recorded outcomes across module reloads', async () => {
    await recordPostOutcome(userId, 'persist1', { status: 'removed', reason: 'spam' });
    await recordPostOutcome(userId, 'persist2', { status: 'posted' });

    const initialHistory = await getRecordedOutcomes(userId);
    expect(initialHistory).toHaveLength(2);
    expect(initialHistory[0].timestamp).toEqual(expect.any(Number));

    vi.resetModules();
    const reloadedModule = await import('../ruleViolationTracker.js');
    const reloadedHistory = await reloadedModule.getRecordedOutcomes(userId);
    expect(reloadedHistory).toHaveLength(2);
    expect(reloadedHistory.map(outcome => outcome.subreddit)).toEqual([
      'persist1',
      'persist2'
    ]);

    await reloadedModule.clearRecordedOutcomes(userId);
  });
});
