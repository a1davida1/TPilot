import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordPostOutcome,
  summarizeRemovalReasons,
  clearRecordedOutcomes,
  getRecordedOutcomes,
  type PostOutcomeStatus
} from '../ruleViolationTracker.js';

describe('ruleViolationTracker', () => {
  const userId = 42;

  beforeEach(() => {
    clearRecordedOutcomes();
  });

  it('records successful posts without inflating removal counts', () => {
    const status: PostOutcomeStatus = 'posted';
    recordPostOutcome(userId, 'testsub', { status });

    const summary = summarizeRemovalReasons(userId);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});

    const history = getRecordedOutcomes(userId);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ subreddit: 'testsub', status });
  });

  it('aggregates removal reasons for a user', () => {
    recordPostOutcome(userId, 'sub1', { status: 'removed', reason: 'spam' });
    recordPostOutcome(userId, 'sub2', { status: 'removed', reason: 'spam' });
    recordPostOutcome(userId, 'sub3', { status: 'removed', reason: 'rules_violation' });

    const summary = summarizeRemovalReasons(userId);
    expect(summary.total).toBe(3);
    expect(summary.byReason).toEqual({
      spam: 2,
      rules_violation: 1
    });
  });

  it('handles empty state by returning zero counts', () => {
    const summary = summarizeRemovalReasons(999);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});
  });

  it('defaults missing removal reasons to unspecified bucket', () => {
    recordPostOutcome(userId, 'sub1', { status: 'removed' });
    recordPostOutcome(userId, 'sub2', { status: 'removed', reason: '  ' });

    const summary = summarizeRemovalReasons(userId);
    expect(summary.total).toBe(2);
    expect(summary.byReason).toEqual({ unspecified: 2 });
  });
});