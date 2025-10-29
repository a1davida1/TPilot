/**
 * User Analytics Service
 * Aggregates user-specific activity data for dashboard display
 */

import { db } from '../db.js';
import {
  redditPostOutcomes,
  contentGenerations,
  postMetrics,
  users,
} from '@shared/schema';
import { eq, and, gte, desc, sql, count } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface AnalyticsOverview {
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  successRate: number;
  totalCaptionsGenerated: number;
  totalUpvotes: number;
  totalViews: number;
  averageScore: number;
  mostUsedSubreddits: Array<{
    subreddit: string;
    count: number;
    successRate: number;
  }>;
}

export interface SubredditPerformance {
  subreddit: string;
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  successRate: number;
  avgUpvotes: number;
  avgScore: number;
  totalViews: number;
  lastPosted: string | null;
}

export interface RecentActivity {
  id: number;
  type: 'post' | 'generation';
  subreddit?: string;
  status: string;
  timestamp: Date;
  details?: string;
}

export interface PostingActivity {
  date: string;
  posts: number;
  successful: number;
  failed: number;
}

/**
 * Get user analytics overview
 */
export async function getUserAnalyticsOverview(
  userId: number,
  daysBack: number = 30
): Promise<AnalyticsOverview> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get post outcomes
    const postOutcomes = await db
      .select({
        total: count(),
        success: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN success = false THEN 1 END)`,
        totalUpvotes: sql<number>`COALESCE(SUM(upvotes), 0)`,
        totalViews: sql<number>`COALESCE(SUM(views), 0)`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      );

    // Get caption generations count
    const generationsResult = await db
      .select({ count: count() })
      .from(contentGenerations)
      .where(
        and(
          eq(contentGenerations.userId, userId),
          gte(contentGenerations.createdAt, startDate)
        )
      );

    // Get average score from post metrics
    const avgScoreResult = await db
      .select({
        avgScore: sql<number>`COALESCE(AVG(score), 0)`,
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          gte(postMetrics.postedAt, startDate)
        )
      );

    // Get most used subreddits with success rates
    const subredditStats = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        count: count(),
        successful: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .orderBy(desc(count()))
      .limit(5);

    const stats = postOutcomes[0];
    const totalPosts = Number(stats?.total ?? 0);
    const successfulPosts = Number(stats?.success ?? 0);
    const failedPosts = Number(stats?.failed ?? 0);

    return {
      totalPosts,
      successfulPosts,
      failedPosts,
      successRate: totalPosts > 0 ? Math.round((successfulPosts / totalPosts) * 100) : 0,
      totalCaptionsGenerated: Number(generationsResult[0]?.count ?? 0),
      totalUpvotes: Number(stats?.totalUpvotes ?? 0),
      totalViews: Number(stats?.totalViews ?? 0),
      averageScore: Math.round(Number(avgScoreResult[0]?.avgScore ?? 0)),
      mostUsedSubreddits: subredditStats.map(s => ({
        subreddit: s.subreddit,
        count: Number(s.count),
        successRate: Math.round((Number(s.successful) / Number(s.count)) * 100)
      }))
    };
  } catch (error) {
    logger.error('Failed to get analytics overview', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get subreddit-specific performance metrics
 */
export async function getSubredditPerformance(
  userId: number,
  daysBack: number = 30
): Promise<SubredditPerformance[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const subredditStats = await db
      .select({
        subreddit: redditPostOutcomes.subreddit,
        totalPosts: count(),
        successful: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN success = false THEN 1 END)`,
        avgUpvotes: sql<number>`COALESCE(AVG(upvotes), 0)`,
        totalViews: sql<number>`COALESCE(SUM(views), 0)`,
        lastPosted: sql<Date | null>`MAX(occurred_at)`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      )
      .groupBy(redditPostOutcomes.subreddit)
      .orderBy(desc(count()));

    // Get corresponding scores from post_metrics
    const metricsData = await db
      .select({
        subreddit: postMetrics.subreddit,
        avgScore: sql<number>`COALESCE(AVG(score), 0)`,
      })
      .from(postMetrics)
      .where(
        and(
          eq(postMetrics.userId, userId),
          gte(postMetrics.postedAt, startDate)
        )
      )
      .groupBy(postMetrics.subreddit);

    const metricsMap = new Map(
      metricsData.map(m => [m.subreddit, Math.round(Number(m.avgScore))])
    );

    return subredditStats.map(s => {
      const total = Number(s.totalPosts);
      const successful = Number(s.successful);

      // Convert lastPosted to Date if it's a string (Drizzle returns it as string from SQL)
      let lastPostedISO: string | null = null;
      if (s.lastPosted) {
        if (typeof s.lastPosted === 'string') {
          lastPostedISO = new Date(s.lastPosted).toISOString();
        } else if (s.lastPosted instanceof Date) {
          lastPostedISO = s.lastPosted.toISOString();
        }
      }

      return {
        subreddit: s.subreddit,
        totalPosts: total,
        successfulPosts: successful,
        failedPosts: Number(s.failed),
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        avgUpvotes: Math.round(Number(s.avgUpvotes)),
        avgScore: metricsMap.get(s.subreddit) ?? 0,
        totalViews: Number(s.totalViews),
        lastPosted: lastPostedISO
      };
    });
  } catch (error) {
    logger.error('Failed to get subreddit performance', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get recent activity timeline
 */
export async function getRecentActivity(
  userId: number,
  limit: number = 20
): Promise<RecentActivity[]> {
  try {
    // Get recent posts
    const recentPosts = await db
      .select({
        id: redditPostOutcomes.id,
        subreddit: redditPostOutcomes.subreddit,
        status: redditPostOutcomes.status,
        success: redditPostOutcomes.success,
        timestamp: redditPostOutcomes.occurredAt,
        reason: redditPostOutcomes.reason,
      })
      .from(redditPostOutcomes)
      .where(eq(redditPostOutcomes.userId, userId))
      .orderBy(desc(redditPostOutcomes.occurredAt))
      .limit(limit);

    const activities: RecentActivity[] = recentPosts.map(post => ({
      id: post.id,
      type: 'post' as const,
      subreddit: post.subreddit,
      status: post.success ? 'success' : 'failed',
      timestamp: post.timestamp,
      details: post.reason ?? undefined
    }));

    return activities.sort((a, b) =>
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  } catch (error) {
    logger.error('Failed to get recent activity', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get posting activity over time (for charts)
 */
export async function getPostingActivity(
  userId: number,
  daysBack: number = 30
): Promise<PostingActivity[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const dailyStats = await db
      .select({
        date: sql<string>`DATE(occurred_at)`,
        posts: count(),
        successful: sql<number>`COUNT(CASE WHEN success = true THEN 1 END)`,
        failed: sql<number>`COUNT(CASE WHEN success = false THEN 1 END)`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.userId, userId),
          gte(redditPostOutcomes.occurredAt, startDate)
        )
      )
      .groupBy(sql`DATE(occurred_at)`)
      .orderBy(sql`DATE(occurred_at) ASC`);

    return dailyStats.map(day => ({
      date: day.date,
      posts: Number(day.posts),
      successful: Number(day.successful),
      failed: Number(day.failed)
    }));
  } catch (error) {
    logger.error('Failed to get posting activity', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get user's Reddit karma and account age for context
 */
export async function getUserRedditStats(userId: number) {
  try {
    const [userData] = await db
      .select({
        redditKarma: users.redditKarma,
        redditAccountCreated: users.redditAccountCreated,
        redditUsername: users.redditUsername,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userData) {
      return null;
    }

    const accountAgeDays = userData.redditAccountCreated
      ? Math.floor(
          (Date.now() - userData.redditAccountCreated.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null;

    return {
      karma: userData.redditKarma ?? 0,
      accountAgeDays,
      username: userData.redditUsername ?? null,
    };
  } catch (error) {
    logger.error('Failed to get user Reddit stats', {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}
