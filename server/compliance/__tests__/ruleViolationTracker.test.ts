import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { InsertRedditPostOutcome, RedditPostOutcome } from '@shared/schema';
import type { PostOutcomeStatus } from '../ruleViolationTracker.js';

const persistenceFile = path.join(tmpdir(), `reddit-post-outcomes-test-${process.pid}.json`);

type PersistedOutcome = Required<Pick<RedditPostOutcome, 'id' | 'userId' | 'subreddit' | 'status'>> & {
  reason: string | null;
  occurredAt: string;
};

const readPersistedOutcomes = async (): Promise<PersistedOutcome[]> => {
  try {
    const raw = await fs.readFile(persistenceFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => ({
      id: Number(entry.id) || 0,
      userId: Number(entry.userId) || 0,
      subreddit: String(entry.subreddit ?? ''),
      status: String(entry.status ?? ''),
      reason: typeof entry.reason === 'string' ? entry.reason : null,
      occurredAt: typeof entry.occurredAt === 'string'
        ? entry.occurredAt
        : new Date(entry.occurredAt ?? Date.now()).toISOString(),
    }));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writePersistedOutcomes = async (records: PersistedOutcome[]): Promise<void> => {
  await fs.writeFile(persistenceFile, JSON.stringify(records), 'utf8');
};

const getNextId = (records: PersistedOutcome[]): number => {
  if (records.length === 0) {
    return 1;
  }
  return Math.max(...records.map((record) => record.id)) + 1;
};

vi.mock('../../storage.js', () => {
  const recordRedditPostOutcome = async (outcome: InsertRedditPostOutcome): Promise<void> => {
    const records = await readPersistedOutcomes();
    const occurredAt = outcome.occurredAt instanceof Date
      ? outcome.occurredAt.toISOString()
      : outcome.occurredAt ?? new Date().toISOString();

    const persisted: PersistedOutcome = {
      id: getNextId(records),
      userId: outcome.userId,
      subreddit: outcome.subreddit,
      status: outcome.status,
      reason: typeof outcome.reason === 'string' ? outcome.reason : null,
      occurredAt,
    };

    records.push(persisted);
    records.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    await writePersistedOutcomes(records);
  };

  const getRedditPostOutcomes = async (userId: number): Promise<RedditPostOutcome[]> => {
    const records = await readPersistedOutcomes();
    return records
      .filter((record) => record.userId === userId)
      .map((record) => ({
        id: record.id,
        userId: record.userId,
        subreddit: record.subreddit,
        status: record.status,
        reason: record.reason,
        occurredAt: new Date(record.occurredAt),
      }));
  };

  const getRedditPostRemovalSummary = async (
    userId: number,
  ): Promise<Array<{ reason: string | null; count: number }>> => {
    const records = await readPersistedOutcomes();
    const counts = new Map<string | null, number>();

    for (const record of records) {
      if (record.userId !== userId || record.status !== 'removed') {
        continue;
      }
      const key = record.reason ?? null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([reason, count]) => ({ reason, count }));
  };

  const clearRedditPostOutcomes = async (userId?: number): Promise<void> => {
    const records = await readPersistedOutcomes();
    if (typeof userId === 'number') {
      const filtered = records.filter((record) => record.userId !== userId);
      await writePersistedOutcomes(filtered);
      return;
    }
    await writePersistedOutcomes([]);
  };

  return {
    storage: {
      recordRedditPostOutcome,
      getRedditPostOutcomes,
      getRedditPostRemovalSummary,
      clearRedditPostOutcomes,
    },
  };
});

type RuleViolationTrackerModule = typeof import('../ruleViolationTracker.js');

const importTracker = async (): Promise<RuleViolationTrackerModule> => import('../ruleViolationTracker.js');

let trackerModule: RuleViolationTrackerModule;

describe('ruleViolationTracker', () => {
  const userId = 42;

  beforeEach(async () => {
    await fs.rm(persistenceFile, { force: true }).catch(() => undefined);
    vi.resetModules();
    trackerModule = await importTracker();
    await trackerModule.clearRecordedOutcomes();
  });

  afterAll(async () => {
    trackerModule = await importTracker();
    await trackerModule.clearRecordedOutcomes();
    await fs.rm(persistenceFile, { force: true }).catch(() => undefined);
  });

  it('records successful posts without inflating removal counts', async () => {
    const { recordPostOutcome, summarizeRemovalReasons, getRecordedOutcomes } = trackerModule;
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
    const { recordPostOutcome, summarizeRemovalReasons } = trackerModule;
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
    const { summarizeRemovalReasons } = trackerModule;
    const summary = await summarizeRemovalReasons(999);
    expect(summary.total).toBe(0);
    expect(summary.byReason).toEqual({});
  });

  it('defaults missing removal reasons to unspecified bucket', async () => {
    const { recordPostOutcome, summarizeRemovalReasons } = trackerModule;
    await recordPostOutcome(userId, 'sub1', { status: 'removed' });
    await recordPostOutcome(userId, 'sub2', { status: 'removed', reason: '  ' });

    const summary = await summarizeRemovalReasons(userId);
    expect(summary.total).toBe(2);
    expect(summary.byReason).toEqual({ unspecified: 2 });
  });

  it('persists recorded outcomes across module reloads', async () => {
    const { recordPostOutcome, getRecordedOutcomes } = trackerModule;
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
