
import { describe, it, expect, vi, afterEach } from 'vitest';

import { MetricsWorker } from '../../../../server/lib/workers/metrics-worker.ts';
import type { RedditManager } from '../../../../server/lib/reddit.ts';
import { db } from '../../../../server/db.ts';
import { postJobs } from '../../../../shared/schema.ts';

type RedditSubmission = Awaited<
  ReturnType<RedditManager['prototype']['getSubmission']>
>;

type FetchPostMetrics = (
  reddit: { getSubmission(postId: string): Promise<RedditSubmission> },
  redditPostId: string
) => Promise<unknown>;

type PostMetrics = {
  score: number;
  upvoteRatio: number;
  numComments: number;
  views: number;
  collectedAt: Date;
};

type UpdatePostMetrics = (
  postJobId: number,
  metrics: PostMetrics
) => Promise<unknown>;

describe('MetricsWorker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults missing submission metrics to zero', async () => {
    const worker = new MetricsWorker();
    const fetchPostMetrics = (worker as unknown as {
      fetchPostMetrics: FetchPostMetrics;
    }).fetchPostMetrics;

    const redditSubmission: RedditSubmission = {} as RedditSubmission;

    const reddit = {
      getSubmission: vi
        .fn<(postId: string) => Promise<RedditSubmission>>()
        .mockResolvedValue(redditSubmission),
    } satisfies { getSubmission(postId: string): Promise<RedditSubmission> };

    const result = await fetchPostMetrics(reddit, 't3_example');

    expect(reddit.getSubmission).toHaveBeenCalledWith('t3_example');
    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');

    if (!result || typeof result !== 'object') {
      throw new Error('Expected metrics object');
    }

    const metrics = result as Record<string, unknown>;

    expect(metrics.score).toBe(0);
    expect(metrics.upvoteRatio).toBe(0);
    expect(metrics.numComments).toBe(0);
    expect(metrics.views).toBe(0);
    expect(metrics.collectedAt).toBeInstanceOf(Date);
  });

  it('persists metrics updates with normalized values', async () => {
    const worker = new MetricsWorker();
    const updatePostMetrics = (worker as unknown as {
      updatePostMetrics: UpdatePostMetrics;
    }).updatePostMetrics;

    const whereSpy = vi
      .fn<(condition: unknown) => Promise<unknown>>()
      .mockResolvedValue(undefined);

    const setResult = { where: whereSpy } satisfies {
      where(condition: unknown): Promise<unknown>;
    };

    const setSpy = vi
      .fn<(values: Record<string, unknown>) => typeof setResult>()
      .mockReturnValue(setResult);

    const updateSpy = vi
      .spyOn(db, 'update')
      .mockReturnValue({ set: setSpy } as unknown as ReturnType<typeof db.update>);

    const collectedAt = new Date('2024-01-01T00:00:00.000Z');

    await updatePostMetrics(42, {
      score: 12,
      upvoteRatio: 0.87,
      numComments: 4,
      views: 150,
      collectedAt,
    });

    expect(updateSpy).toHaveBeenCalledWith(postJobs);
    expect(setSpy).toHaveBeenCalledTimes(1);

    const setArgs = setSpy.mock.calls[0];
    expect(setArgs).toBeDefined();

    const [values] = setArgs;
    expect(values).toBeDefined();

    const resultJson = values.resultJson as Record<string, unknown>;
    expect(resultJson.score).toBe(12);
    expect(resultJson.upvoteRatio).toBe(0.87);
    expect(resultJson.comments).toBe(4);
    expect(resultJson.views).toBe(150);
    expect(typeof resultJson.lastCollected).toBe('string');
    expect(values.updatedAt).toBeInstanceOf(Date);
    expect(whereSpy).toHaveBeenCalledTimes(1);
  });
});
