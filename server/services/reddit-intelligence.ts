import { getRedditServiceClient, registerDefaultRedditClients, REDDIT_SERVICE_CLIENT_KEYS } from '../lib/reddit.js';
import { listCommunities, type NormalizedRedditCommunity } from '../reddit-communities.js';
import { stateStore } from './state-store.js';
import { logger } from '../lib/logger.js';
import { db } from '../db.js';
import { creatorAccounts, redditPostOutcomes } from '@shared/schema';
import { eq, sql, and, desc, gte } from 'drizzle-orm';

type CacheStore = typeof stateStore;

type SnoowrapClient = {
  getSubreddit(name: string): {
    getHot(options: { limit: number }): Promise<unknown>;
    getRising?(options: { limit: number }): Promise<unknown>;
    getTop?(options: { limit: number; time?: string }): Promise<unknown>;
  };
};

interface SnoowrapSubmissionLike {
  id: string;
  title: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  url?: string;
  link_flair_text?: string | null;
  over_18?: boolean;
  subreddit?: string;
  subreddit_name_prefixed?: string;
  subreddit_name?: string;
  subreddit_display_name?: string;
  subreddit_type?: string;
  subreddit_subscribers?: number;
}

export interface RedditTrendingTopic {
  topic: string;
  subreddit: string;
  score: number;
  comments: number;
  category: string;
  url: string;
  flair?: string;
  nsfw: boolean;
  postedAt: string;
  complianceWarnings?: string[];
  verificationRequired?: boolean;
  promotionAllowed?: string;
  cooldownHours?: number | null;
}

export interface SubredditHealthMetric {
  subreddit: string;
  members: number;
  engagementRate: number;
  growthTrend: string | null;
  modActivity: string | null;
  healthScore: number;
  status: 'excellent' | 'healthy' | 'watch' | 'risky';
  warnings: string[];
  sellingPolicy: string;
  competitionLevel: string | null;
}

export interface RedditForecastingSignal {
  subreddit: string;
  signal: 'surging' | 'steady' | 'cooling';
  confidence: number;
  rationale: string;
  projectedEngagement: number;
}

export interface RedditIntelligenceDataset {
  fetchedAt: string;
  trendingTopics: RedditTrendingTopic[];
  subredditHealth: SubredditHealthMetric[];
  forecastingSignals: RedditForecastingSignal[];
}

interface IntelligenceOptions {
  userId?: number;
  _optInPersonalized?: boolean;
}

const CACHE_NAMESPACE = 'reddit:intelligence:v1';
const DEFAULT_CACHE_TTL_SECONDS = 300;
const MAX_HEALTH_COMMUNITIES = 50;
const MAX_FORECAST_SIGNALS = 20;
const TRENDING_LIMIT = 25;

function isIterable(value: unknown): value is Iterable<unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const iterator = (value as { [Symbol.iterator]?: unknown })[Symbol.iterator];
  return typeof iterator === 'function';
}

function isSnoowrapSubmission(value: unknown): value is SnoowrapSubmissionLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') {
    return false;
  }
  const subredditCandidate = record.subreddit;
  const prefixedCandidate = record.subreddit_name_prefixed;
  if (typeof subredditCandidate === 'string') {
    return true;
  }
  if (typeof prefixedCandidate === 'string') {
    return true;
  }
  if (typeof subredditCandidate === 'object' && subredditCandidate !== null) {
    const nestedDisplayName = (subredditCandidate as Record<string, unknown>).display_name;
    return typeof nestedDisplayName === 'string';
  }
  return false;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

function normalizeSubredditName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (trimmed.startsWith('r/')) {
    return trimmed.slice(2);
  }
  return trimmed;
}

function extractSubredditName(entry: SnoowrapSubmissionLike): string {
  if (typeof entry.subreddit === 'string' && entry.subreddit.length > 0) {
    return normalizeSubredditName(entry.subreddit);
  }
  if (typeof entry.subreddit_name_prefixed === 'string' && entry.subreddit_name_prefixed.length > 0) {
    return normalizeSubredditName(entry.subreddit_name_prefixed);
  }
  const nested = entry.subreddit;
  if (typeof nested === 'object' && nested !== null) {
    const nestedDisplay = (nested as Record<string, unknown>).display_name;
    if (typeof nestedDisplay === 'string' && nestedDisplay.length > 0) {
      return normalizeSubredditName(nestedDisplay);
    }
  }
  return 'unknown';
}

function determineStatus(healthScore: number): 'excellent' | 'healthy' | 'watch' | 'risky' {
  if (healthScore >= 85) {
    return 'excellent';
  }
  if (healthScore >= 70) {
    return 'healthy';
  }
  if (healthScore >= 50) {
    return 'watch';
  }
  return 'risky';
}

function deriveSellingPolicy(community: NormalizedRedditCommunity): string {
  const policy = community.rules?.content?.sellingPolicy;
  if (policy) {
    return policy;
  }
  return community.promotionAllowed ?? 'unknown';
}

function calculateSignal(trendScore: number, growthTrend: string | null | undefined): 'surging' | 'steady' | 'cooling' {
  if (growthTrend === 'down') {
    return 'cooling';
  }
  if (growthTrend === 'up' && trendScore >= 75) {
    return 'surging';
  }
  if (trendScore >= 85) {
    return 'surging';
  }
  return 'steady';
}

function buildRationale(community: NormalizedRedditCommunity, trend: RedditTrendingTopic, signal: RedditForecastingSignal['signal']): string {
  const fragments: string[] = [];
  if (signal === 'surging') {
    fragments.push('High engagement momentum detected');
  } else if (signal === 'cooling') {
    fragments.push('Downward trajectory observed');
  } else {
    fragments.push('Stable performance indicators');
  }
  if (community.growthTrend) {
    fragments.push(`Growth trend: ${community.growthTrend}`);
  }
  if (community.modActivity) {
    fragments.push(`Mod activity: ${community.modActivity}`);
  }
  fragments.push(`Trend score: ${trend.score}`);
  return fragments.join(' • ');
}

function isDataset(value: unknown): value is RedditIntelligenceDataset {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.fetchedAt !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.trendingTopics) || !Array.isArray(candidate.subredditHealth) || !Array.isArray(candidate.forecastingSignals)) {
    return false;
  }
  return true;
}

export class RedditIntelligenceService {
  private cacheStore: CacheStore;
  private ttlSeconds: number;
  private outcomeMetricsCache: Map<string, { successCount: number; totalPosts: number }> | null = null;
  private outcomeMetricsCacheTime: number = 0;
  private readonly OUTCOME_METRICS_CACHE_TTL = 300000; // 5 minutes

  constructor(options?: { cacheTtlSeconds?: number; store?: CacheStore }) {
    this.cacheStore = options?.store ?? stateStore;
    this.ttlSeconds = options?.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS;
  }

  async invalidateCache(userId?: number): Promise<void> {
    const cacheKey = this.buildCacheKey(userId);
    try {
      await this.cacheStore.delete(cacheKey);
      logger.info('Reddit intelligence cache invalidated', { cacheKey });
    } catch (error) {
      logger.warn('Failed to invalidate Reddit intelligence cache', { cacheKey, error });
    }
  }

  async getIntelligence(options?: IntelligenceOptions): Promise<RedditIntelligenceDataset> {
    const cacheKey = this.buildCacheKey(options?.userId);
    const _optInPersonalized = options?._optInPersonalized ?? (options?.userId !== undefined);
    
    try {
      const cached = await this.cacheStore.get(cacheKey);
      if (isDataset(cached)) {
        return cached;
      }
    } catch (error) {
      logger.warn('Failed to read cached Reddit intelligence snapshot', { error });
    }

    const dataset = await this.buildDataset({ ...(options ?? {}), _optInPersonalized });

    try {
      await this.cacheStore.set(cacheKey, dataset, this.ttlSeconds);
    } catch (error) {
      logger.warn('Failed to cache Reddit intelligence snapshot', { error });
    }

    return dataset;
  }

  async getTrendingTopics(): Promise<RedditTrendingTopic[]> {
    const dataset = await this.getIntelligence();
    if (dataset.trendingTopics.length > 0) {
      return dataset.trendingTopics;
    }
    return this.getFallbackTrendingTopics();
  }

  private buildCacheKey(userId: number | undefined): string {
    if (typeof userId === 'number' && Number.isFinite(userId)) {
      return `${CACHE_NAMESPACE}:user:${userId}`;
    }
    return `${CACHE_NAMESPACE}:global`;
  }

  private async buildDataset(options?: IntelligenceOptions): Promise<RedditIntelligenceDataset> {
    const communities = await listCommunities();
    const communityMap = new Map<string, NormalizedRedditCommunity>();
    communities.forEach(community => {
      const normalizedName = normalizeSubredditName(community.name);
      communityMap.set(normalizedName, community);
    });

    const optInPersonalized = options?._optInPersonalized === true;

    // Fetch user's linked Reddit account and preferences
    let userCommunities: string[] = [];
    if (optInPersonalized && options?.userId) {
      userCommunities = await this.getUserCommunities(options.userId);
    }

    const client = await this.getClient();
    const trendingTopics = await this.fetchTrendingTopics(client, communityMap, userCommunities, optInPersonalized);
    const subredditHealth = await this.computeSubredditHealth(communities, trendingTopics, userCommunities, optInPersonalized);
    const forecastingSignals = this.buildForecastingSignals(trendingTopics, communityMap, userCommunities, optInPersonalized);

    return {
      fetchedAt: new Date().toISOString(),
      trendingTopics,
      subredditHealth,
      forecastingSignals,
    };
  }

  private async getClient(): Promise<SnoowrapClient | null> {
    try {
      registerDefaultRedditClients();
    } catch (error) {
      logger.warn('Unable to register default Reddit client', { error });
    }

    try {
      const client = getRedditServiceClient(REDDIT_SERVICE_CLIENT_KEYS.COMMUNITY_SYNC);
      if (!client) {
        return null;
      }
      return client as unknown as SnoowrapClient;
    } catch (error) {
      logger.error('Failed to acquire Reddit service client', { error });
      return null;
    }
  }

  private async fetchTrendingTopics(
    client: SnoowrapClient | null,
    communityMap: Map<string, NormalizedRedditCommunity>,
    userCommunities: string[] = [],
    optInPersonalized = false
  ): Promise<RedditTrendingTopic[]> {
    if (!client) {
      logger.warn('Reddit service client unavailable; falling back to cached community insights only');
      return [];
    }

    const listings: SnoowrapSubmissionLike[] = [];
    const personalized = optInPersonalized && userCommunities.length > 0;

    // Broaden collection sources: hot, rising, and time-bound top listings
    const fetchers: Array<Promise<void>> = [
      this.collectListings(client, 'popular', 'hot', TRENDING_LIMIT, listings),
      this.collectListings(client, 'popular', 'rising', Math.floor(TRENDING_LIMIT / 2), listings),
      this.collectListings(client, 'popular', 'top', Math.floor(TRENDING_LIMIT / 2), listings, 'day'),
      this.collectListings(client, 'all', 'hot', Math.floor(TRENDING_LIMIT / 2), listings),
      this.collectListings(client, 'all', 'top', Math.floor(TRENDING_LIMIT / 3), listings, 'week'),
    ];

    // Add user-specific communities if personalized
    if (personalized) {
      for (const community of userCommunities.slice(0, 5)) {
        fetchers.push(this.collectListings(client, community, 'hot', 5, listings));
      }
    }

    await Promise.all(fetchers);

    const seenTopics = new Set<string>();
    const userCommunitiesSet = personalized
      ? new Set(userCommunities.map(c => normalizeSubredditName(c)))
      : null;

    return listings
      .map(entry => this.transformTrendingEntry(entry, communityMap))
      .filter((trend): trend is RedditTrendingTopic => {
        if (!trend) {
          return false;
        }
        if (seenTopics.has(trend.topic.toLowerCase())) {
          return false;
        }
        seenTopics.add(trend.topic.toLowerCase());
        return true;
      })
      .map(trend => {
        if (userCommunitiesSet && userCommunitiesSet.has(normalizeSubredditName(trend.subreddit))) {
          return {
            ...trend,
            score: trend.score + 12,
          };
        }
        return trend;
      })
      .sort((a, b) => {
        if (!userCommunitiesSet) {
          return b.score - a.score;
        }
        const aInUser = userCommunitiesSet.has(normalizeSubredditName(a.subreddit));
        const bInUser = userCommunitiesSet.has(normalizeSubredditName(b.subreddit));
        if (aInUser && !bInUser) return -1;
        if (!aInUser && bInUser) return 1;
        return b.score - a.score;
      })
      .slice(0, TRENDING_LIMIT);
  }

  private async collectListings(
    client: SnoowrapClient, 
    subreddit: string, 
    type: 'hot' | 'rising' | 'top',
    limit: number, 
    sink: SnoowrapSubmissionLike[],
    time?: 'day' | 'week' | 'month' | 'year' | 'all'
  ): Promise<void> {
    try {
      const subredditHandle = client.getSubreddit(subreddit);
      let listing;
      
      switch (type) {
        case 'hot':
          listing = await subredditHandle.getHot({ limit });
          break;
        case 'rising':
          if (subredditHandle.getRising) {
            listing = await subredditHandle.getRising({ limit });
          } else {
            listing = await subredditHandle.getHot({ limit });
          }
          break;
        case 'top':
          if (subredditHandle.getTop) {
            listing = await subredditHandle.getTop({ limit, time: time || 'day' });
          } else {
            listing = await subredditHandle.getHot({ limit });
          }
          break;
        default:
          listing = await subredditHandle.getHot({ limit });
      }
      
      const normalized = this.normalizeListing(listing);
      sink.push(...normalized);
    } catch (error) {
      logger.warn('Failed to collect Reddit listings', { subreddit, type, error });
    }
  }

  private normalizeListing(listing: unknown): SnoowrapSubmissionLike[] {
    const items: SnoowrapSubmissionLike[] = [];
    const bucket: unknown[] = [];

    if (Array.isArray(listing)) {
      bucket.push(...listing);
    } else if (isIterable(listing)) {
      for (const entry of listing) {
        bucket.push(entry);
      }
    }

    bucket.forEach(entry => {
      if (isSnoowrapSubmission(entry)) {
        items.push(entry);
      }
    });

    return items;
  }

  private transformTrendingEntry(entry: SnoowrapSubmissionLike, communityMap: Map<string, NormalizedRedditCommunity>): RedditTrendingTopic | null {
    const normalizedSubreddit = extractSubredditName(entry);
    if (!normalizedSubreddit || normalizedSubreddit === 'unknown') {
      return null;
    }
    const community = communityMap.get(normalizedSubreddit);
    const category = community?.category ?? 'general';
    const score = toNumber(entry.score);
    const comments = toNumber(entry.num_comments);
    const engagementRate = community?.engagementRate ?? 0;
    const successProbability = community?.successProbability ?? 60;
    const growthBoost = community?.growthTrend === 'up' ? 20 : community?.growthTrend === 'down' ? -10 : 0;
    const modBoost = community?.modActivity === 'high' ? 10 : community?.modActivity === 'low' ? -5 : 0;

    const weightedScore = Math.round(
      Math.max(0, score * 0.6 + comments * 0.4) + (engagementRate * 0.4) + (successProbability * 0.3) + growthBoost + modBoost,
    );

    const subredditLabel = community?.displayName ?? `r/${normalizedSubreddit}`;

    // Annotate with compliance signals
    const complianceWarnings: string[] = [];
    if (community?.verificationRequired) {
      complianceWarnings.push('Verification required');
    }
    if (community?.promotionAllowed === 'no') {
      complianceWarnings.push('Promotion not allowed');
    } else if (community?.promotionAllowed === 'limited') {
      complianceWarnings.push('Limited promotion allowed');
    }
    if (community?.rules?.posting?.cooldownHours && community.rules.posting.cooldownHours >= 24) {
      complianceWarnings.push(`${community.rules.posting.cooldownHours}h cooldown`);
    }
    if (entry.over_18 === true) {
      complianceWarnings.push('NSFW content');
    }
    if (community?.rules?.content?.nsfwRequired) {
      complianceWarnings.push('NSFW required');
    }

    return {
      topic: entry.title,
      subreddit: subredditLabel,
      score: weightedScore,
      comments,
      category,
      url: typeof entry.url === 'string' ? entry.url : `https://www.reddit.com/r/${normalizedSubreddit}/`,
      flair: typeof entry.link_flair_text === 'string' ? entry.link_flair_text : undefined,
      nsfw: entry.over_18 === true,
      postedAt: entry.created_utc ? new Date(entry.created_utc * 1000).toISOString() : new Date().toISOString(),
      complianceWarnings: complianceWarnings.length > 0 ? complianceWarnings : undefined,
      verificationRequired: community?.verificationRequired,
      promotionAllowed: community?.promotionAllowed,
      cooldownHours: community?.rules?.posting?.cooldownHours,
    };
  }

  private async getUserCommunities(userId: number): Promise<string[]> {
    try {
      const userIdNum = userId;

      // Get user's linked Reddit account and their engaged communities
      const linkedAccounts = await db
        .select({ 
          handle: creatorAccounts.handle,
        })
        .from(creatorAccounts)
        .where(and(
          eq(creatorAccounts.userId, userIdNum),
          eq(creatorAccounts.platform, 'reddit')
        ))
        .limit(1);

      if (linkedAccounts.length === 0) {
        return [];
      }

      // Get communities the user has posted to successfully
      const outcomes = await db
        .select({
          subreddit: redditPostOutcomes.subreddit,
        })
        .from(redditPostOutcomes)  
        .where(and(
          eq(redditPostOutcomes.userId, userIdNum),
          eq(redditPostOutcomes.status, 'approved')
        ))
        .groupBy(redditPostOutcomes.subreddit)
        .orderBy(desc(sql`count(*)`))
        .limit(20);

      const communities = outcomes.map(o => o.subreddit).filter(Boolean);
      
      // Return top communities the user has successfully posted to
      return communities.slice(0, 10); // Limit to top 10
    } catch (error) {
      logger.warn('Failed to get user communities', { userId, error });
      return [];
    }
  }

  private async computeSubredditHealth(
    communities: NormalizedRedditCommunity[],
    trendingTopics: RedditTrendingTopic[],
    userCommunities: string[] = [],
    optInPersonalized = false
  ): Promise<SubredditHealthMetric[]> {
    const trendingSet = new Set<string>(
      trendingTopics.map(topic => normalizeSubredditName(topic.subreddit)),
    );

    // Fetch post outcomes to adjust health scoring
    const outcomeMetrics = await this.getOutcomeMetrics();
    const userCommunitySet = optInPersonalized && userCommunities.length > 0
      ? new Set(userCommunities.map(community => normalizeSubredditName(community)))
      : null;

    const prioritized: NormalizedRedditCommunity[] = [];
    const seenCommunities = new Set<string>();

    const pushCommunity = (community: NormalizedRedditCommunity) => {
      const normalized = normalizeSubredditName(community.name);
      if (seenCommunities.has(normalized)) {
        return;
      }
      seenCommunities.add(normalized);
      prioritized.push(community);
    };

    if (userCommunitySet) {
      for (const communityName of userCommunitySet) {
        const match = communities.find(candidate => normalizeSubredditName(candidate.name) === communityName);
        if (match) {
          pushCommunity(match);
        }
      }
    }

    for (const community of communities) {
      pushCommunity(community);
    }

    return prioritized
      .slice(0, MAX_HEALTH_COMMUNITIES)
      .map(community => this.evaluateCommunityHealth(community, trendingSet, outcomeMetrics, userCommunitySet))
      .filter((metric): metric is SubredditHealthMetric => metric !== null);
  }

  private async getOutcomeMetrics(): Promise<Map<string, { successCount: number; totalPosts: number }>> {
    // Check cache first
    const now = Date.now();
    if (this.outcomeMetricsCache && (now - this.outcomeMetricsCacheTime) < this.OUTCOME_METRICS_CACHE_TTL) {
      return this.outcomeMetricsCache;
    }

    const metricsMap = new Map<string, { successCount: number; totalPosts: number }>();

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const outcomes = await db
        .select({
          subreddit: redditPostOutcomes.subreddit,
          status: redditPostOutcomes.status,
          count: sql<number>`count(*)::int`,
        })
        .from(redditPostOutcomes)
        .where(gte(redditPostOutcomes.occurredAt, thirtyDaysAgo))
        .groupBy(redditPostOutcomes.subreddit, redditPostOutcomes.status);

      for (const row of outcomes) {
        const normalizedSubreddit = normalizeSubredditName(row.subreddit);
        const existing = metricsMap.get(normalizedSubreddit) || { successCount: 0, totalPosts: 0 };
        
        existing.totalPosts += row.count;
        // Consider 'approved' as success
        if (row.status === 'approved') {
          existing.successCount += row.count;
        }
        
        metricsMap.set(normalizedSubreddit, existing);
      }

      // Cache the results
      this.outcomeMetricsCache = metricsMap;
      this.outcomeMetricsCacheTime = now;
    } catch (error) {
      logger.warn('Failed to get post outcome metrics (table may not exist yet)', { error });
    }

    return metricsMap;
  }

  private evaluateCommunityHealth(
    community: NormalizedRedditCommunity,
    trendingSet: Set<string>,
    outcomeMetrics: Map<string, { successCount: number; totalPosts: number }>,
    userCommunitySet: Set<string> | null = null,
  ): SubredditHealthMetric | null {
    const normalizedName = normalizeSubredditName(community.name);
    if (!normalizedName) {
      return null;
    }

    let engagementRate = community.engagementRate ?? 0;
    const successProbability = community.successProbability ?? 60;
    const isUserCommunity = userCommunitySet?.has(normalizedName) ?? false;

    // Adjust engagement based on post outcomes
    const outcomeData = outcomeMetrics.get(normalizedName);
    if (outcomeData && outcomeData.totalPosts > 0) {
      const successRate = outcomeData.successCount / outcomeData.totalPosts;
      engagementRate = engagementRate * (0.6 + successRate * 0.4); // Weight success rate at 40%
    }

    if (isUserCommunity) {
      engagementRate = Math.min(100, (engagementRate * 1.1) + 5);
    }

    const averageUpvotes = community.averageUpvotes ?? 0;
    const growthTrend = community.growthTrend ?? null;
    const modActivity = community.modActivity ?? null;
    const trendBoost = trendingSet.has(normalizedName) ? 15 : 0;
    const growthBoost = growthTrend === 'up' ? 15 : growthTrend === 'down' ? -10 : 0;
    const modBoost = modActivity === 'high' ? 10 : modActivity === 'low' ? -10 : 0;
    const competitionPenalty = community.competitionLevel === 'high' ? -10 : 0;
    const personalizationBoost = isUserCommunity ? 12 : 0;

    const healthScore = Math.round(
      (successProbability * 0.4) + (engagementRate * 0.3) + (averageUpvotes * 0.1) + trendBoost + growthBoost + modBoost + competitionPenalty + personalizationBoost,
    );
    const adjustedHealthScore = Math.max(0, healthScore);

    const warnings: string[] = [];
    if (community.verificationRequired) {
      warnings.push('Verification required');
    }
    if (community.promotionAllowed === 'no') {
      warnings.push('Promotion not allowed');
    }
    if (community.promotionAllowed === 'limited') {
      warnings.push('Promotion limited');
    }
    if (community.competitionLevel === 'high') {
      warnings.push('High competition');
    }
    if (community.rules?.posting?.cooldownHours && community.rules.posting.cooldownHours >= 24) {
      warnings.push(`${community.rules.posting.cooldownHours}h cooldown between posts`);
    }

    return {
      subreddit: community.displayName,
      members: community.members,
      engagementRate,
      growthTrend,
      modActivity,
      healthScore: adjustedHealthScore,
      status: determineStatus(adjustedHealthScore),
      warnings,
      sellingPolicy: deriveSellingPolicy(community),
      competitionLevel: community.competitionLevel ?? null,
    };
  }

  private buildForecastingSignals(
    trendingTopics: RedditTrendingTopic[],
    communityMap: Map<string, NormalizedRedditCommunity>,
    userCommunities: string[] = [],
    optInPersonalized = false
  ): RedditForecastingSignal[] {
    const signals: RedditForecastingSignal[] = [];
    const userCommunitySet = optInPersonalized && userCommunities.length > 0
      ? new Set(userCommunities.map(community => normalizeSubredditName(community)))
      : null;

    for (const trend of trendingTopics.slice(0, MAX_FORECAST_SIGNALS)) {
      const normalized = normalizeSubredditName(trend.subreddit);
      const community = communityMap.get(normalized);
      if (!community) {
        continue;
      }
      const signal = calculateSignal(trend.score, community.growthTrend);
      const baseConfidence = community.successProbability ?? 60;
      const engagementRate = community.engagementRate ?? 0;
      const isUserCommunity = userCommunitySet?.has(normalized) ?? false;
      let confidence = Math.max(40, Math.min(95, Math.round((baseConfidence * 0.5) + (engagementRate * 0.3) + (trend.score * 0.2))));
      if (isUserCommunity) {
        confidence = Math.min(99, confidence + 8);
      }

      let projectedEngagement = Math.max(0, Math.round((engagementRate || 40) * (1 + trend.score / 150)));
      if (isUserCommunity) {
        projectedEngagement = Math.max(projectedEngagement, Math.round(projectedEngagement * 1.1 + 5));
      }

      let rationale = buildRationale(community, trend, signal);
      if (isUserCommunity) {
        rationale = `${rationale} • Personalized: aligned with your proven communities`;
      }

      signals.push({
        subreddit: community.displayName,
        signal,
        confidence,
        rationale,
        projectedEngagement,
      });
    }

    return signals;
  }

  private getFallbackTrendingTopics(): RedditTrendingTopic[] {
    const now = new Date().toISOString();
    return [
      {
        topic: 'Behind-the-scenes exclusives',
        subreddit: 'r/CreatorSuccess',
        score: 78,
        comments: 120,
        category: 'exclusive',
        url: 'https://www.reddit.com/r/CreatorSuccess/',
        flair: undefined,
        nsfw: false,
        postedAt: now,
      },
      {
        topic: 'Fitness transformation journeys',
        subreddit: 'r/Fitness',
        score: 82,
        comments: 210,
        category: 'fitness',
        url: 'https://www.reddit.com/r/Fitness/',
        flair: undefined,
        nsfw: false,
        postedAt: now,
      },
      {
        topic: 'Cosplay build tutorials',
        subreddit: 'r/Cosplay',
        score: 75,
        comments: 95,
        category: 'creative',
        url: 'https://www.reddit.com/r/Cosplay/',
        flair: undefined,
        nsfw: false,
        postedAt: now,
      },
    ];
  }
}

export const redditIntelligenceService = new RedditIntelligenceService();
