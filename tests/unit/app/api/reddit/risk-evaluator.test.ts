import { describe, expect, it } from 'vitest';

import {
  evaluateRedditPostingRisk,
  type RiskEvaluatorDataSource,
  type RiskEvaluationResult,
  type RiskWarning,
} from '../../../../../app/api/reddit/_lib/risk-evaluator';

interface SnapshotRecord {
  result: RiskEvaluationResult;
  userId: number;
}

class FakeDataSource implements RiskEvaluatorDataSource {
  public snapshots: SnapshotRecord[] = [];

  constructor(
    private readonly upcoming: Array<{ id: number; subreddit: string; scheduledFor: Date; title: string | null }>,
    private readonly outcomes: Array<{ subreddit: string; status: string; reason: string | null; occurredAt: Date }>,
    private readonly flags: Array<{ reason: string; description: string | null; status: string; createdAt: Date; subreddit: string | null }>,
    private readonly ruleMap: Map<string, unknown>,
  ) {}

  async getUpcomingScheduledPosts(_userId: number, _now: Date): Promise<typeof this.upcoming> {
    return this.upcoming;
  }

  async getRecentOutcomes(_userId: number, _since: Date): Promise<typeof this.outcomes> {
    return this.outcomes;
  }

  async getRecentFlags(_userId: number, _since: Date): Promise<typeof this.flags> {
    return this.flags;
  }

  async getSubredditRules(subreddits: string[]) {
    return subreddits
      .filter((subreddit) => this.ruleMap.has(subreddit))
      .map((subreddit) => ({ subreddit, rulesJson: this.ruleMap.get(subreddit) }));
  }

  async saveRiskSnapshot(snapshot: { userId: number; generatedAt: Date; warnings: RiskWarning[]; stats: RiskEvaluationResult['stats'] }) {
    this.snapshots.push({
      userId: snapshot.userId,
      result: {
        generatedAt: snapshot.generatedAt.toISOString(),
        warnings: snapshot.warnings,
        stats: snapshot.stats,
      },
    });
  }
}

describe('evaluateRedditPostingRisk', () => {
  it('detects cooldown conflicts based on scheduling cadence', async () => {
    const now = new Date('2024-01-10T10:00:00.000Z');
    const dataSource = new FakeDataSource(
      [
        { id: 1, subreddit: 'gonewild', scheduledFor: new Date('2024-01-10T12:00:00.000Z'), title: 'Morning drop' },
        { id: 2, subreddit: 'gonewild', scheduledFor: new Date('2024-01-10T18:00:00.000Z'), title: 'Evening drop' },
      ],
      [],
      [],
      new Map([
        [
          'gonewild',
          {
            posting: { cooldownHours: 48 },
            notes: 'Mods enforce a strict 48-hour gap.',
          },
        ],
      ]),
    );

    const result = await evaluateRedditPostingRisk(
      { userId: 42 },
      { dataSource, now },
    );

    expect(result.warnings).toHaveLength(1);
    const [warning] = result.warnings;
    expect(warning.type).toBe('cadence');
    expect(warning.severity).toBe('high');
    expect(warning.recommendedAction).toContain('Delay this post');
    expect(warning.metadata?.cooldownHours).toBe(48);
    expect(dataSource.snapshots).toHaveLength(1);
    expect(dataSource.snapshots[0]?.userId).toBe(42);
    expect(dataSource.snapshots[0]?.result.warnings[0]?.type).toBe('cadence');
  });

  it('returns removal warnings when moderators recently removed posts', async () => {
    const now = new Date('2024-03-01T12:00:00.000Z');
    const dataSource = new FakeDataSource(
      [],
      [
        {
          subreddit: 'nsfwcosplay',
          status: 'removed',
          reason: 'Title too promotional',
          occurredAt: new Date('2024-02-28T11:00:00.000Z'),
        },
      ],
      [],
      new Map(),
    );

    const result = await evaluateRedditPostingRisk(
      { userId: 99 },
      { dataSource, now },
    );

    expect(result.warnings).toHaveLength(1);
    const [warning] = result.warnings;
    expect(warning.type).toBe('removal');
    expect(warning.message).toContain('removed');
    expect(warning.metadata?.removalReason).toBe('Title too promotional');
    expect(result.stats.removalCount).toBe(1);
  });

  it('surfaces rule-based warnings for promotional restrictions', async () => {
    const now = new Date('2024-04-10T08:00:00.000Z');
    const dataSource = new FakeDataSource(
      [],
      [],
      [],
      new Map([
        [
          'onlyfanspromos',
          {
            content: { promotionalLinks: 'no' },
            notes: 'Allow soft CTAs only',
          },
        ],
      ]),
    );

    const result = await evaluateRedditPostingRisk(
      { userId: 7 },
      { dataSource, now },
    );

    expect(result.warnings).toHaveLength(1);
    const [warning] = result.warnings;
    expect(warning.type).toBe('rule');
    expect(warning.recommendedAction).toContain('Remove external links');
    expect(warning.metadata?.ruleReference).toBe('promotionalLinks');
  });
});
