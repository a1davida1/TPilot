/**
 * Subreddit Discovery Service
 * Automatically discovers and adds subreddits to the database when users post
 * Crowdsources subreddit data from actual user activity
 */

import { db } from '../db.js';
import { postMetrics, redditCommunities, redditPostOutcomes } from '@shared/schema';
import { and, eq, gte, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

// RedditClient type (minimal interface for what we need)
interface RedditClient {
  getSubreddit(name: string): {
    fetch(): Promise<{
      display_name: string;
      subscribers: number;
      over18: boolean;
      public_description?: string;
      description?: string;
    }>;  
  };
}

type RedditUser = RedditClient;

interface SubredditInfo {
  name: string;
  displayName: string;
  subscribers: number;
  over18: boolean;
  description?: string;
  publicDescription?: string;
}

/**
 * Check if subreddit exists in database, add if not
 * Called whenever a user posts to a subreddit
 */
export async function ensureSubredditExists(
  subredditName: string,
  redditClient?: RedditUser
): Promise<boolean> {
  try {
    // Normalize name (remove r/ prefix if present)
    const normalizedName = subredditName.toLowerCase().replace(/^r\//, '');

    // Check if already exists
    const existing = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.name, normalizedName))
      .limit(1);

    if (existing.length > 0) {
      logger.debug(`Subreddit r/${normalizedName} already exists in database`);
      return true;
    }

    // Fetch from Reddit API
    if (!redditClient) {
      logger.warn(`No Reddit client provided, cannot fetch r/${normalizedName} info`);
      return false;
    }

    logger.info(`Discovering new subreddit: r/${normalizedName}`);
    const subredditInfo = await fetchSubredditInfo(normalizedName, redditClient);

    if (!subredditInfo) {
      logger.error(`Failed to fetch info for r/${normalizedName}`);
      return false;
    }

    // Add to database with basic info
    await db.insert(redditCommunities).values({
      id: normalizedName,
      name: normalizedName,
      displayName: subredditInfo.displayName,
      members: subredditInfo.subscribers,
      subscribers: subredditInfo.subscribers,
      engagementRate: 0, // Will be calculated over time
      category: 'user-discovered', // Mark as crowdsourced
      verificationRequired: false, // Unknown initially
      promotionAllowed: 'unknown', // Will be determined from posts
      over18: subredditInfo.over18,
      description: subredditInfo.description || subredditInfo.publicDescription,
      tags: ['user-discovered'],
      averageUpvotes: null,
      successProbability: null,
      growthTrend: null,
      modActivity: null,
      competitionLevel: null,
      postingLimits: null,
      rules: null,
      bestPostingTimes: null
    });

    logger.info(`✅ Added new subreddit to database: r/${normalizedName} (${subredditInfo.subscribers.toLocaleString()} subscribers)`);
    return true;

  } catch (error) {
    logger.error('Failed to ensure subreddit exists', {
      subreddit: subredditName,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

/**
 * Fetch subreddit info from Reddit API
 */
async function fetchSubredditInfo(
  subredditName: string,
  redditClient: RedditUser
): Promise<SubredditInfo | null> {
  try {
    // Use snoowrap to get subreddit info
    const subreddit = await redditClient.getSubreddit(subredditName).fetch();

    return {
      name: subreddit.display_name.toLowerCase(),
      displayName: subreddit.display_name,
      subscribers: subreddit.subscribers || 0,
      over18: subreddit.over18 || false,
      description: subreddit.description,
      publicDescription: subreddit.public_description
    };

  } catch (error) {
    logger.error(`Failed to fetch subreddit info from Reddit`, {
      subreddit: subredditName,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Update subreddit metadata from user activity
 * Called after successful posts to aggregate data
 */
export async function updateSubredditMetadata(
  subredditName: string,
  postData: {
    upvotes?: number;
    successful: boolean;
    postedAt: Date;
  }
): Promise<void> {
  try {
    const normalizedName = subredditName.toLowerCase().replace(/^r\//, '');

    const metrics = await calculateSubredditMetrics(normalizedName);

    if (!metrics) {
      logger.debug(`No aggregated metrics available for r/${normalizedName}`, postData);
      return;
    }

    const updatePayload = buildCommunityMetricsUpdate(metrics);

    await db
      .update(redditCommunities)
      .set(updatePayload)
      .where(eq(redditCommunities.name, normalizedName));

    logger.debug(`Updated aggregated metrics for r/${normalizedName}`, {
      ...postData,
      ...updatePayload
    });

  } catch (error) {
    logger.error('Failed to update subreddit metadata', {
      subreddit: subredditName,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Background job to enrich discovered subreddits with aggregated data
 * Run this weekly to update crowdsourced metrics
 */
export async function enrichDiscoveredSubreddits(): Promise<void> {
  try {
    logger.info('Starting subreddit enrichment job...');

    // Get all user-discovered subreddits
    const discovered = await db
      .select()
      .from(redditCommunities)
      .where(eq(redditCommunities.category, 'user-discovered'))
      .limit(100); // Process in batches

    logger.info(`Found ${discovered.length} user-discovered subreddits to enrich`);

    for (const subreddit of discovered) {
      try {
        const metrics = await calculateSubredditMetrics(subreddit.name);

        if (!metrics) {
          logger.debug(`Skipping enrichment for r/${subreddit.name} due to missing metrics`);
          continue;
        }

        const updatePayload = buildCommunityMetricsUpdate(metrics);

        await db
          .update(redditCommunities)
          .set(updatePayload)
          .where(eq(redditCommunities.id, subreddit.id));

        logger.info(`✅ Enriched r/${subreddit.name} with user data`);

      } catch (error) {
        logger.error(`Failed to enrich r/${subreddit.name}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Subreddit enrichment job completed');

  } catch (error) {
    logger.error('Subreddit enrichment job failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

interface AggregatedSubredditMetrics {
  avgUpvotes: number;
  avgComments: number;
  successRate: number | null;
  totalPosts: number;
  bestHours: number[];
}

/**
 * Helper to calculate subreddit metrics from all users' posts
 */
async function calculateSubredditMetrics(
  subredditName: string
): Promise<AggregatedSubredditMetrics | null> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    const [metricsRow] = await db
      .select({
        avgScore: sql<number>`COALESCE(AVG(${postMetrics.score}), 0)`,
        avgComments: sql<number>`COALESCE(AVG(${postMetrics.comments}), 0)`,
        totalPosts: sql<number>`COUNT(*)` 
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.subreddit, subredditName),
          gte(postMetrics.postedAt, ninetyDaysAgo)
        )
      );

    const avgUpvotes = Number(metricsRow?.avgScore ?? 0);
    const avgComments = Number(metricsRow?.avgComments ?? 0);
    const totalPosts = Number(metricsRow?.totalPosts ?? 0);

    const [outcomeRow] = await db
      .select({
        totalAttempts: sql<number>`COUNT(*)`,
        successfulPosts: sql<number>`SUM(CASE WHEN ${redditPostOutcomes.success} = true OR ${redditPostOutcomes.status} = 'completed' THEN 1 ELSE 0 END)` 
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.subreddit, subredditName),
          gte(redditPostOutcomes.occurredAt, ninetyDaysAgo)
        )
      );

    const totalAttempts = Number(outcomeRow?.totalAttempts ?? 0);
    const successfulPosts = Number(outcomeRow?.successfulPosts ?? 0);
    const successRate = totalAttempts > 0 ? successfulPosts / totalAttempts : null;

    let bestHours: number[] = [];
    try {
      const { detectPeakHours } = await import('./analytics-service.js');
      const peakAnalysis = await detectPeakHours(subredditName);
      bestHours = peakAnalysis.peakHours.slice(0, 5);
    } catch (peakError) {
      logger.warn(`Failed to detect peak hours for r/${subredditName}`, {
        error: peakError instanceof Error ? peakError.message : 'Unknown error'
      });
    }

    return {
      avgUpvotes,
      avgComments,
      successRate,
      totalPosts,
      bestHours
    };
  } catch (error) {
    logger.error(`Failed to calculate metrics for r/${subredditName}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

function buildCommunityMetricsUpdate(metrics: AggregatedSubredditMetrics): {
  averageUpvotes: number | null;
  engagementRate: number;
  successProbability: number | null;
  bestPostingTimes: string[] | null;
} {
  const averageUpvotes = metrics.totalPosts > 0 ? Math.round(metrics.avgUpvotes) : null;
  const engagementRate = metrics.totalPosts > 0 ? Math.max(0, Math.round(metrics.avgComments)) : 0;
  const successProbability =
    metrics.successRate === null ? null : Math.round(metrics.successRate * 100);
  const bestPostingTimes =
    metrics.bestHours.length > 0 ? metrics.bestHours.map(formatPostingHour) : null;

  return { averageUpvotes, engagementRate, successProbability, bestPostingTimes };
}

function formatPostingHour(hour: number): string {
  const normalizedHour = Number.isFinite(hour) ? Math.min(23, Math.max(0, Math.trunc(hour))) : 0;
  return `${normalizedHour.toString().padStart(2, '0')}:00`;
}
