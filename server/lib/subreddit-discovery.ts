/**
 * Subreddit Discovery Service
 * Automatically discovers and adds subreddits to the database when users post
 * Crowdsources subreddit data from actual user activity
 */

import { db } from '../db.js';
import { redditCommunities } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
// RedditUser type from snoowrap
type RedditUser = any; // Using any for now since we don't export it from reddit.ts

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
    const subreddit = await (redditClient as any).getSubreddit(subredditName).fetch();

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

    // This would be enhanced with aggregated calculations
    // For now, just log that we could update it
    logger.debug(`Could aggregate data for r/${normalizedName}`, postData);

    // TODO: Implement aggregation logic
    // - Calculate average upvotes from postMetrics
    // - Determine best posting times from successful posts
    // - Calculate success probability
    // - Update engagement rate

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
        // Calculate aggregated metrics from postMetrics table
        const metrics = await calculateSubredditMetrics(subreddit.name);

        if (metrics) {
          await db
            .update(redditCommunities)
            .set({
              averageUpvotes: metrics.avgUpvotes,
              successProbability: Math.round(metrics.successRate * 100),
              engagementRate: Math.round(metrics.avgComments),
              bestPostingTimes: metrics.bestHours?.map((h: number) => `${h}:00`)
            })
            .where(eq(redditCommunities.id, subreddit.id));

          logger.info(`✅ Enriched r/${subreddit.name} with user data`);
        }

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

/**
 * Helper to calculate subreddit metrics from all users' posts
 */
async function calculateSubredditMetrics(subredditName: string) {
  // This would use the analytics-service functions to calculate
  // aggregated metrics across ALL users who posted to this subreddit
  const { getGlobalSubredditMetrics } = await import('./analytics-service.js');
  
  try {
    const metrics = await getGlobalSubredditMetrics(subredditName);
    return {
      avgUpvotes: metrics.avgUpvotes,
      successRate: metrics.successRate,
      avgComments: metrics.avgComments,
      bestHours: [] as number[] // Would need to import detectPeakHours
    };
  } catch (error) {
    logger.error(`Failed to calculate metrics for r/${subredditName}`, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}
