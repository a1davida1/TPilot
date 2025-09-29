import { beforeEach, describe, expect, it, vi } from 'vitest';
import { postRateLimits } from '../../../../shared/schema.ts';

type RowCountResult = { rowCount?: number };

type UpdateWhere = (conditions: unknown) => Promise<RowCountResult>;
type UpdateSetInput = {
  postCount24h: unknown;
  lastPostAt: Date;
  updatedAt: Date;
};
type UpdateSet = (values: UpdateSetInput) => { where: UpdateWhere };
type UpdateChain = { set: UpdateSet };

type InsertValuesInput = {
  userId: number;
  subreddit: string;
  postCount24h: number;
  lastPostAt: Date;
};
type OnConflictConfig = {
  target: [typeof postRateLimits.userId, typeof postRateLimits.subreddit];
  set: {
    postCount24h: number;
    lastPostAt: Date;
    updatedAt: Date;
  };
};
type InsertValues = (
  values: InsertValuesInput
) => { onConflictDoUpdate: (config: OnConflictConfig) => Promise<void> };
type InsertChain = { values: InsertValues };

type UpdateFn = (table: typeof postRateLimits) => UpdateChain;
type InsertFn = (table: typeof postRateLimits) => InsertChain;

const updateSpy = vi.fn<UpdateFn>();
const insertSpy = vi.fn<InsertFn>();

vi.mock('../../../../server/db.js', () => ({
  db: {
    update: updateSpy,
    insert: insertSpy,
  },
}));

describe('SafetyManager.recordPost', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('inserts a new rate limit row when no rows were updated', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-01-01T00:00:00.000Z');
    vi.setSystemTime(now);

    const updateWhere = vi.fn<UpdateWhere>().mockResolvedValue({ rowCount: 0 });
    const updateSet = vi
      .fn<UpdateSet>()
      .mockReturnValue({ where: updateWhere });
    updateSpy.mockReturnValue({ set: updateSet });

    const onConflictDoUpdate = vi
      .fn<(config: OnConflictConfig) => Promise<void>>()
      .mockResolvedValue();
    const insertValues = vi
      .fn<InsertValues>()
      .mockReturnValue({ onConflictDoUpdate });
    insertSpy.mockReturnValue({ values: insertValues });

    const { SafetyManager } = await import('../../../../server/lib/safety-systems.ts');

    await SafetyManager.recordPost('42', 'unit_testing');

    expect(updateSpy).toHaveBeenCalledWith(postRateLimits);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPostAt: now,
        updatedAt: now,
      })
    );
    expect(updateWhere).toHaveBeenCalledTimes(1);

    expect(insertSpy).toHaveBeenCalledWith(postRateLimits);
    expect(insertValues).toHaveBeenCalledWith({
      userId: 42,
      subreddit: 'unit_testing',
      postCount24h: 1,
      lastPostAt: now,
    });
    expect(onConflictDoUpdate).toHaveBeenCalledWith({
      target: [postRateLimits.userId, postRateLimits.subreddit],
      set: {
        postCount24h: 1,
        lastPostAt: now,
        updatedAt: now,
      },
    });

    vi.useRealTimers();
  });

  it('increments existing rate limit row when update succeeds', async () => {
    vi.useFakeTimers();
    const now = new Date('2024-02-01T00:00:00.000Z');
    vi.setSystemTime(now);

    const updateWhere = vi.fn<UpdateWhere>().mockResolvedValue({ rowCount: 1 });
    const updateSet = vi
      .fn<UpdateSet>()
      .mockReturnValue({ where: updateWhere });
    updateSpy.mockReturnValue({ set: updateSet });

    const insertValues = vi.fn<InsertValues>();
    insertSpy.mockReturnValue({ values: insertValues });

    const { SafetyManager } = await import('../../../../server/lib/safety-systems.ts');

    await SafetyManager.recordPost('7', 'existing_subreddit');

    expect(updateSpy).toHaveBeenCalledWith(postRateLimits);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPostAt: now,
        updatedAt: now,
      })
    );
    expect(updateWhere).toHaveBeenCalledTimes(1);

    expect(insertSpy).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});