import { analyticsMetrics, contentFlags, contentGenerations, redditPostOutcomes, scheduledPosts, subredditRules, redditCommunityRuleSetSchema, legacyRedditCommunityRuleSetSchema } from '@shared/schema';
import { db } from '@server/db';
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import type { z } from 'zod';

const HOURS_24 = 24;
const HOURS_72 = 72;
const DEFAULT_LOOKBACK_DAYS = 30;
const EXTENDED_LOOKBACK_DAYS = 90;

export type RiskWarningType = 'cadence' | 'removal' | 'rule';
export type RiskWarningSeverity = 'low' | 'medium' | 'high';

export interface RiskWarningMetadata {
  scheduledFor?: string;
  cooldownHours?: number;
  hoursSinceLastPost?: number;
  removalReason?: string | null;
  removalAt?: string;
  ruleReference?: string;
  notes?: string;
}

export interface RiskWarning {
  id: string;
  type: RiskWarningType;
  severity: RiskWarningSeverity;
  subreddit: string;
  title: string;
  message: string;
  recommendedAction: string;
  metadata?: RiskWarningMetadata;
}

export interface RiskEvaluationStats {
  upcomingCount: number;
  flaggedSubreddits: number;
  removalCount: number;
  cooldownConflicts: number;
}

export interface RiskEvaluationResult {
  generatedAt: string;
  warnings: RiskWarning[];
  stats: RiskEvaluationStats;
}

interface UpcomingScheduledPost { id: number; subreddit: string; scheduledFor: Date; title: string | null; }
interface RecentOutcome { subreddit: string; status: string; reason: string | null; occurredAt: Date; }
interface RecentFlag { reason: string; description: string | null; status: string; createdAt: Date; subreddit: string | null; }
interface SubredditRuleRecord { subreddit: string; rulesJson: unknown; }
interface RiskSnapshot { userId: number; generatedAt: Date; warnings: RiskWarning[]; stats: RiskEvaluationStats; }

export interface RiskEvaluatorDataSource {
  getUpcomingScheduledPosts(userId: number, now: Date): Promise<UpcomingScheduledPost[]>;
  getRecentOutcomes(userId: number, since: Date): Promise<RecentOutcome[]>;
  getRecentFlags(userId: number, since: Date): Promise<RecentFlag[]>;
  getSubredditRules(subreddits: string[]): Promise<SubredditRuleRecord[]>;
  saveRiskSnapshot(snapshot: RiskSnapshot): Promise<void>;
}

interface EvaluateOptions { userId: number; includeHistory?: boolean; }
interface EvaluateDependencies { dataSource?: RiskEvaluatorDataSource; now?: Date; }

function clampToSafeSubredditName(value: string): string {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.startsWith('r/') || trimmed.startsWith('R/') ? trimmed.slice(2) : trimmed;
  return withoutPrefix.replace(/[^A-Za-z0-9_+]/gu, '').toLowerCase();
}

function hoursBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60);
}

function createWarningId(type: RiskWarningType, subreddit: string, suffix: string): string {
  return `${type}:${subreddit}:${suffix}`;
}

function calculateRiskScore(warnings: RiskWarning[]): number {
  const weight: Record<RiskWarningSeverity, number> = { high: 3, medium: 2, low: 1 };
  return warnings.reduce((total, warning) => total + (weight[warning.severity] ?? 0), 0);
}

function buildStats(warnings: RiskWarning[], cooldownConflicts: number, removalCount: number, upcomingCount: number): RiskEvaluationStats {
  return {
    upcomingCount,
    flaggedSubreddits: new Set(warnings.map(warning => warning.subreddit)).size,
    removalCount,
    cooldownConflicts,
  };
}

function buildCooldownWarnings(
  posts: UpcomingScheduledPost[],
  outcomes: RecentOutcome[],
  rulesBySubreddit: Map<string, z.infer<typeof redditCommunityRuleSetSchema> | z.infer<typeof legacyRedditCommunityRuleSetSchema> | null>,
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const historyBySubreddit = new Map<string, RecentOutcome[]>();
  for (const outcome of outcomes) {
    const subreddit = clampToSafeSubredditName(outcome.subreddit);
    const existing = historyBySubreddit.get(subreddit) ?? [];
    existing.push(outcome);
    historyBySubreddit.set(subreddit, existing);
  }
  const postsBySubreddit = posts.reduce<Record<string, UpcomingScheduledPost[]>>((accumulator, post) => {
    const key = clampToSafeSubredditName(post.subreddit);
    if (!accumulator[key]) accumulator[key] = [];
    accumulator[key]?.push(post);
    return accumulator;
  }, {});
  for (const [subreddit, subredditPosts] of Object.entries(postsBySubreddit)) {
    const sortedPosts = [...subredditPosts].sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
    const recentHistory = historyBySubreddit.get(subreddit) ?? [];
    const sortedHistory = [...recentHistory].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const ruleSet = rulesBySubreddit.get(subreddit);
    const cooldownHours = ruleSet?.posting?.cooldownHours ?? (ruleSet && 'maxPostsPerDay' in ruleSet && ruleSet.maxPostsPerDay ? HOURS_24 : null);
    for (let index = 0; index < sortedPosts.length; index += 1) {
      const post = sortedPosts[index];
      const previousPost = sortedPosts[index - 1];
      let conflictDetected = false;
      let referenceHours = HOURS_72;
      let hoursSincePrevious = Infinity;
      if (previousPost) {
        hoursSincePrevious = hoursBetween(post.scheduledFor, previousPost.scheduledFor);
        if (hoursSincePrevious < HOURS_72) { conflictDetected = true; referenceHours = Math.max(referenceHours, cooldownHours ?? 0); }
      }
      if (!conflictDetected && sortedHistory.length > 0) {
        const lastOutcome = sortedHistory[0];
        hoursSincePrevious = hoursBetween(post.scheduledFor, lastOutcome.occurredAt);
        if (hoursSincePrevious < HOURS_72) { conflictDetected = true; referenceHours = Math.max(referenceHours, cooldownHours ?? 0); }
      }
      if (!conflictDetected && cooldownHours !== null) {
        const lastEvent = previousPost ? previousPost.scheduledFor : sortedHistory[0]?.occurredAt;
        if (lastEvent) {
          hoursSincePrevious = hoursBetween(post.scheduledFor, lastEvent);
          if (hoursSincePrevious < cooldownHours) { conflictDetected = true; referenceHours = Math.max(referenceHours, cooldownHours); }
        }
      }
      if (conflictDetected) {
        const severity: RiskWarningSeverity = hoursSincePrevious < HOURS_24 ? 'high' : hoursSincePrevious < HOURS_72 ? 'medium' : 'low';
        warnings.push({
          id: createWarningId('cadence', subreddit, post.scheduledFor.getTime().toString()),
          type: 'cadence',
          severity,
          subreddit,
          title: `Cooldown risk in r/${subreddit}`,
          message: `Multiple posts are scheduled within a ${referenceHours}-hour window for r/${subreddit}. Reddit mods regularly remove rapid-fire posts.`,
          recommendedAction: `Delay this post by at least ${Math.ceil(referenceHours - hoursSincePrevious)} hours to reset the subreddit cooldown.`,
          metadata: {
            scheduledFor: post.scheduledFor.toISOString(),
            cooldownHours: referenceHours,
            hoursSinceLastPost: Number.isFinite(hoursSincePrevious) ? Number(hoursSincePrevious.toFixed(2)) : undefined,
            notes: ruleSet?.notes ?? undefined,
          },
        });
      }
    }
  }
  return warnings;
}

function buildRemovalWarnings(outcomes: RecentOutcome[]): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const removalStatuses = new Set(['removed', 'rejected', 'shadowbanned', 'failed']);
  const grouped = new Map<string, RecentOutcome[]>();
  for (const outcome of outcomes) {
    if (!removalStatuses.has(outcome.status.toLowerCase())) continue;
    const subreddit = clampToSafeSubredditName(outcome.subreddit);
    const list = grouped.get(subreddit) ?? [];
    list.push(outcome);
    grouped.set(subreddit, list);
  }
  for (const [subreddit, entries] of grouped.entries()) {
    const sorted = [...entries].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    const latest = sorted[0];
    const severity: RiskWarningSeverity = sorted.length >= 3 ? 'high' : sorted.length === 2 ? 'medium' : 'low';
    warnings.push({
      id: createWarningId('removal', subreddit, latest.occurredAt.getTime().toString()),
      type: 'removal',
      severity,
      subreddit,
      title: `Recent removals in r/${subreddit}`,
      message: `${sorted.length} recent post${sorted.length > 1 ? 's' : ''} were removed. Latest reason: ${latest.reason ?? 'Not provided by moderators.'}`,
      recommendedAction: 'Review the moderator feedback, adjust your title/body, and wait for cooldown before reposting.',
      metadata: { removalReason: latest.reason, removalAt: latest.occurredAt.toISOString() },
    });
  }
  return warnings;
}

function buildRuleWarnings(
  rulesBySubreddit: Map<string, z.infer<typeof redditCommunityRuleSetSchema> | z.infer<typeof legacyRedditCommunityRuleSetSchema> | null>,
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  for (const [subreddit, ruleSet] of rulesBySubreddit.entries()) {
    if (!ruleSet) continue;
    const contentRules = 'content' in ruleSet ? ruleSet.content : undefined;
    const promotionalAllowance = contentRules?.promotionalLinks ?? ('promotionalLinksAllowed' in ruleSet ? ruleSet.promotionalLinksAllowed : undefined);
    if (promotionalAllowance && promotionalAllowance !== 'yes') {
      warnings.push({
        id: createWarningId('rule', subreddit, 'promo'),
        type: 'rule',
        severity: promotionalAllowance === 'no' ? 'high' : 'medium',
        subreddit,
        title: `Promotion limits in r/${subreddit}`,
        message: promotionalAllowance === 'no'
          ? 'Moderator rules ban promotional links. Affiliate URLs or self-promo may trigger removals.'
          : 'Promotional links are limited. Keep CTAs subtle to avoid auto removals.',
        recommendedAction: promotionalAllowance === 'no' ? 'Remove external links or monetized promos before posting.' : 'Trim promotional copy and keep CTAs lightweight for this community.',
        metadata: { ruleReference: 'promotionalLinks', notes: ruleSet?.notes ?? undefined },
      });
    }
    const requiresOriginal = contentRules?.requiresOriginalContent ?? ('requiresOriginalContent' in ruleSet ? ruleSet.requiresOriginalContent : undefined);
    if (requiresOriginal) {
      warnings.push({
        id: createWarningId('rule', subreddit, 'original'),
        type: 'rule',
        severity: 'medium',
        subreddit,
        title: `Original content rule in r/${subreddit}`,
        message: 'This subreddit requires original, unreleased content. Reposts or AI composites risk fast removals.',
        recommendedAction: 'Swap in fresh imagery and unique captioning before posting to stay compliant.',
        metadata: { ruleReference: 'requiresOriginalContent', notes: ruleSet?.notes ?? undefined },
      });
    }
    const watermarksAllowed = contentRules?.watermarksAllowed;
    if (watermarksAllowed === false) {
      warnings.push({
        id: createWarningId('rule', subreddit, 'watermark'),
        type: 'rule',
        severity: 'low',
        subreddit,
        title: `Disable ImageShield for r/${subreddit}`,
        message: 'Mods flagged watermarks in the past. ImageShield overlays may trigger auto-removal.',
        recommendedAction: 'Disable ImageShield or use a light corner mark when posting to this subreddit.',
        metadata: { ruleReference: 'watermarksAllowed', notes: ruleSet?.notes ?? undefined },
      });
    }
  }
  return warnings;
}

function mergeWarnings(...warningGroups: RiskWarning[]): RiskWarning[] {
  const unique = new Map<string, RiskWarning>();
  for (const warning of warningGroups) {
    const existing = unique.get(warning.id);
    if (!existing) { unique.set(warning.id, warning); continue; }
    const severityOrder: RiskWarningSeverity[] = ['low', 'medium', 'high'];
    const existingIndex = severityOrder.indexOf(existing.severity);
    const newIndex = severityOrder.indexOf(warning.severity);
    if (newIndex > existingIndex) unique.set(warning.id, warning);
  }
  return Array.from(unique.values());
}

class DatabaseRiskDataSource implements RiskEvaluatorDataSource {
  async getUpcomingScheduledPosts(userId: number, now: Date): Promise<UpcomingScheduledPost[]> {
    const rows = await db.select({ id: scheduledPosts.id, subreddit: scheduledPosts.subreddit, scheduledFor: scheduledPosts.scheduledFor, title: scheduledPosts.title, status: scheduledPosts.status })
      .from(scheduledPosts).where(and(eq(scheduledPosts.userId, userId), eq(scheduledPosts.status, 'pending'), gte(scheduledPosts.scheduledFor, now))).orderBy(asc(scheduledPosts.scheduledFor));
    return rows.map((row) => ({ id: row.id, subreddit: row.subreddit, scheduledFor: row.scheduledFor, title: row.title ?? null }));
  }
  async getRecentOutcomes(userId: number, since: Date): Promise<RecentOutcome[]> {
    const rows = await db.select({ subreddit: redditPostOutcomes.subreddit, status: redditPostOutcomes.status, reason: redditPostOutcomes.reason, occurredAt: redditPostOutcomes.occurredAt })
      .from(redditPostOutcomes).where(and(eq(redditPostOutcomes.userId, userId), gte(redditPostOutcomes.occurredAt, since))).orderBy(asc(redditPostOutcomes.occurredAt));
    return rows.map((row) => ({ subreddit: row.subreddit, status: row.status, reason: row.reason, occurredAt: row.occurredAt }));
  }
  async getRecentFlags(userId: number, since: Date): Promise<RecentFlag[]> {
    const rows = await db.select({ reason: contentFlags.reason, description: contentFlags.description, status: contentFlags.status, createdAt: contentFlags.createdAt, subreddit: contentGenerations.subreddit, userId: contentGenerations.userId })
      .from(contentFlags).innerJoin(contentGenerations, eq(contentFlags.contentId, contentGenerations.id)).where(and(eq(contentGenerations.userId, userId), gte(contentFlags.createdAt, since)));
    return rows.map((row) => ({ reason: row.reason, description: row.description, status: row.status, createdAt: row.createdAt, subreddit: row.subreddit ?? null }));
  }
  async getSubredditRules(subreddits: string[]): Promise<SubredditRuleRecord[]> {
    if (subreddits.length === 0) return [];
    const rows = await db.select({ subreddit: subredditRules.subreddit, rulesJson: subredditRules.rulesJson }).from(subredditRules).where(inArray(subredditRules.subreddit, subreddits));
    return rows.map((row) => ({ subreddit: row.subreddit, rulesJson: row.rulesJson }));
  }
  async saveRiskSnapshot(snapshot: RiskSnapshot): Promise<void> {
    const riskScore = calculateRiskScore(snapshot.warnings);
    const platformViews = { reddit: { riskScore, warnings: snapshot.warnings, stats: snapshot.stats } } as Record<string, unknown>;
    const topEntries = snapshot.warnings.slice(0, 5).map((warning) => ({ subreddit: warning.subreddit, severity: warning.severity, type: warning.type, title: warning.title }));
    await db.insert(analyticsMetrics).values({
      userId: snapshot.userId, metricType: 'reddit-risk', date: snapshot.generatedAt, totalViews: snapshot.warnings.length, totalEngagement: snapshot.stats.removalCount,
      contentGenerated: snapshot.stats.upcomingCount, platformViews, topContent: topEntries, engagementRate: 0,
      growth: { riskScore, cooldownConflicts: snapshot.stats.cooldownConflicts, flaggedSubreddits: snapshot.stats.flaggedSubreddits }, revenue: 0,
    }).onConflictDoUpdate({
      target: [analyticsMetrics.userId, analyticsMetrics.date, analyticsMetrics.metricType],
      set: {
        totalViews: snapshot.warnings.length, totalEngagement: snapshot.stats.removalCount, contentGenerated: snapshot.stats.upcomingCount, platformViews, topContent: topEntries,
        growth: { riskScore, cooldownConflicts: snapshot.stats.cooldownConflicts, flaggedSubreddits: snapshot.stats.flaggedSubreddits }, revenue: 0,
      },
    });
  }
}

const defaultDataSource = new DatabaseRiskDataSource();

function parseRuleSet(value: unknown) {
  const newSchemaResult = redditCommunityRuleSetSchema.safeParse(value);
  if (newSchemaResult.success) return newSchemaResult.data;
  const legacyResult = legacyRedditCommunityRuleSetSchema.safeParse(value);
  if (legacyResult.success) return legacyResult.data;
  return null;
}

export async function evaluateRedditPostingRisk(options: EvaluateOptions, dependencies: EvaluateDependencies = {}): Promise<RiskEvaluationResult> {
  const { userId, includeHistory = false } = options;
  const now = dependencies.now ?? new Date();
  const lookbackDays = includeHistory ? EXTENDED_LOOKBACK_DAYS : DEFAULT_LOOKBACK_DAYS;
  const lookbackStart = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  const dataSource = dependencies.dataSource ?? defaultDataSource;
  const [upcomingPosts, recentOutcomes, recentFlags] = await Promise.all([
    dataSource.getUpcomingScheduledPosts(userId, now),
    dataSource.getRecentOutcomes(userId, lookbackStart),
    dataSource.getRecentFlags(userId, lookbackStart),
  ]);
  const relevantSubreddits = Array.from(new Set([
    ...upcomingPosts.map((post) => clampToSafeSubredditName(post.subreddit)),
    ...recentOutcomes.map((outcome) => clampToSafeSubredditName(outcome.subreddit)),
    ...recentFlags.map((flag) => (flag.subreddit ? clampToSafeSubredditName(flag.subreddit) : null)).filter((value): value is string => value !== null),
  ].filter((name) => name.length > 0)));
  const rawRules = await dataSource.getSubredditRules(relevantSubreddits);
  const rulesBySubreddit = new Map<string, ReturnType<typeof parseRuleSet>>();
  for (const entry of rawRules) rulesBySubreddit.set(clampToSafeSubredditName(entry.subreddit), parseRuleSet(entry.rulesJson));
  const cadenceWarnings = buildCooldownWarnings(upcomingPosts, recentOutcomes, rulesBySubreddit);
  const removalWarnings = buildRemovalWarnings(recentOutcomes);
  const ruleWarnings = buildRuleWarnings(rulesBySubreddit);
  const flagWarnings: RiskWarning[] = recentFlags.map((flag) => {
    const subreddit = flag.subreddit ? clampToSafeSubredditName(flag.subreddit) : 'unknown';
    return {
      id: createWarningId('removal', subreddit, flag.createdAt.getTime().toString()),
      type: 'removal', severity: flag.status === 'removed' ? 'high' : 'medium', subreddit,
      title: `Moderation flag on ${subreddit === 'unknown' ? 'recent content' : `r/${subreddit}`}`,
      message: flag.description ?? flag.reason,
      recommendedAction: 'Address the flagged issue before rescheduling this asset.',
      metadata: { removalReason: flag.reason, removalAt: flag.createdAt.toISOString(), notes: flag.description ?? undefined },
    };
  });
  const warnings = mergeWarnings(...cadenceWarnings, ...removalWarnings, ...ruleWarnings, ...flagWarnings);
  const cooldownConflicts = cadenceWarnings.length;
  const removalCount = removalWarnings.length + flagWarnings.length;
  const stats = buildStats(warnings, cooldownConflicts, removalCount, upcomingPosts.length);
  const result: RiskEvaluationResult = { generatedAt: now.toISOString(), warnings, stats };
  await dataSource.saveRiskSnapshot({ userId, generatedAt: now, warnings, stats });
  return result;
}
