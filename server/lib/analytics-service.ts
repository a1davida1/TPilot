/**
 * Analytics Service
 * Real-time analytics queries from postMetrics and reddit_post_outcomes tables
 * with Redis caching for performance
 */

import { db } from '../db.js';
import { postMetrics, redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { cacheGetOrSet, CACHE_KEYS, CACHE_TTL } from './cache.js';

export interface SubredditMetrics {
  avgUpvotes: number;
  avgComments: number;
  successRate: number;
  totalPosts: number;
  trending?: 'up' | 'down' | 'stable';
  trendPercent?: number;
  bestHours?: number[];
  bestDay?: string;
  vsGlobal?: {
    percentile: number;
    betterThan: string;
  };
}

export interface PerformanceAnalytics {
  user: SubredditMetrics;
  global: SubredditMetrics;
  recommendations: string[];
  last30Days?: {
    posts: number;
    totalUpvotes: number;
    totalComments: number;
    growth: string;
  };
}

export interface PeakHoursAnalysis {
  subreddit: string;
  peakHours: number[];
  hourlyScores: Record<number, number>;
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
}

/**
 * Get user-specific metrics for a subreddit with real data
 */
export async function getUserSubredditMetrics(
  userId: number,
  subreddit: string
): Promise<SubredditMetrics> {
  const cacheKey = CACHE_KEYS.USER_SUBREDDIT_METRICS(userId, subreddit);
  
  return await cacheGetOrSet(
    cacheKey,
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query postMetrics table for user's historical performance
      const metricsQuery = await db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${postMetrics.score}), 0)`,
          avgComments: sql<number>`COALESCE(AVG(${postMetrics.comments}), 0)`,
          totalPosts: sql<number>`COUNT(*)`,
          maxScore: sql<number>`MAX(${postMetrics.score})`,
          minScore: sql<number>`MIN(${postMetrics.score})`
        })
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.userId, userId),
            eq(postMetrics.subreddit, subreddit),
            gte(postMetrics.postedAt, thirtyDaysAgo)
          )
        );

      // Query reddit_post_outcomes for success rate
      const outcomesQuery = await db
        .select({
          totalAttempts: sql<number>`COUNT(*)`,
          successfulPosts: sql<number>`SUM(CASE WHEN ${redditPostOutcomes.status} = 'completed' THEN 1 ELSE 0 END)`
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit),
            gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
          )
        );

      const metrics = metricsQuery[0];
      const outcomes = outcomesQuery[0];

      const totalPosts = Number(metrics?.totalPosts || 0);
      const avgUpvotes = Math.round(Number(metrics?.avgScore || 0));
      const avgComments = Math.round(Number(metrics?.avgComments || 0));
      const successfulCount = Number(outcomes?.successfulPosts || 0);
      const totalAttempts = Number(outcomes?.totalAttempts || 0);
      const successRate = totalAttempts > 0 ? successfulCount / totalAttempts : 0;

      // Calculate trending (compare last 15 days vs previous 15 days)
      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      const recentMetrics = await db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${postMetrics.score}), 0)`
        })
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.userId, userId),
            eq(postMetrics.subreddit, subreddit),
            gte(postMetrics.postedAt, fifteenDaysAgo)
          )
        );

      const olderMetrics = await db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${postMetrics.score}), 0)`
        })
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.userId, userId),
            eq(postMetrics.subreddit, subreddit),
            gte(postMetrics.postedAt, thirtyDaysAgo),
            sql`${postMetrics.postedAt} < ${fifteenDaysAgo}`
          )
        );

      const recentAvg = Number(recentMetrics[0]?.avgScore || 0);
      const olderAvg = Number(olderMetrics[0]?.avgScore || 0);
      
      let trending: 'up' | 'down' | 'stable' = 'stable';
      let trendPercent = 0;
      
      if (olderAvg > 0 && recentAvg > 0) {
        trendPercent = Math.round(((recentAvg - olderAvg) / olderAvg) * 100);
        if (trendPercent > 10) trending = 'up';
        else if (trendPercent < -10) trending = 'down';
      }

      return {
        avgUpvotes,
        avgComments,
        successRate: Math.round(successRate * 100) / 100,
        totalPosts,
        trending,
        trendPercent
      };
    },
    CACHE_TTL.ONE_HOUR
  );
}

/**
 * Get global platform metrics for a subreddit
 */
export async function getGlobalSubredditMetrics(
  subreddit: string
): Promise<SubredditMetrics> {
  const cacheKey = CACHE_KEYS.GLOBAL_SUBREDDIT_METRICS(subreddit);
  
  return await cacheGetOrSet(
    cacheKey,
    async () => {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Query postMetrics table for global performance
      const metricsQuery = await db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${postMetrics.score}), 0)`,
          avgComments: sql<number>`COALESCE(AVG(${postMetrics.comments}), 0)`,
          totalPosts: sql<number>`COUNT(*)`,
          p50Score: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${postMetrics.score})`,
          p75Score: sql<number>`PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${postMetrics.score})`,
          p90Score: sql<number>`PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ${postMetrics.score})`
        })
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.subreddit, subreddit),
            gte(postMetrics.postedAt, ninetyDaysAgo)
          )
        );

      // Query reddit_post_outcomes for global success rate
      const outcomesQuery = await db
        .select({
          totalAttempts: sql<number>`COUNT(*)`,
          successfulPosts: sql<number>`SUM(CASE WHEN ${redditPostOutcomes.status} = 'completed' THEN 1 ELSE 0 END)`
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.subreddit, subreddit),
            gte(redditPostOutcomes.occurredAt, ninetyDaysAgo)
          )
        );

      const metrics = metricsQuery[0];
      const outcomes = outcomesQuery[0];

      const totalPosts = Number(metrics?.totalPosts || 0);
      const avgUpvotes = Math.round(Number(metrics?.avgScore || 0));
      const avgComments = Math.round(Number(metrics?.avgComments || 0));
      const successfulCount = Number(outcomes?.successfulPosts || 0);
      const totalAttempts = Number(outcomes?.totalAttempts || 0);
      const successRate = totalAttempts > 0 ? successfulCount / totalAttempts : 0;

      return {
        avgUpvotes,
        avgComments,
        successRate: Math.round(successRate * 100) / 100,
        totalPosts
      };
    },
    CACHE_TTL.SIX_HOURS // Global metrics change slowly
  );
}

/**
 * Detect peak hours for a subreddit based on historical data
 */
export async function detectPeakHours(
  subreddit: string,
  userId?: number
): Promise<PeakHoursAnalysis> {
  const cacheKey = userId 
    ? CACHE_KEYS.USER_SUBREDDIT_METRICS(userId, subreddit) + ':peaks'
    : CACHE_KEYS.SUBREDDIT_PEAK_HOURS(subreddit);
  
  return await cacheGetOrSet(
    cacheKey,
    async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query performance by hour of day
      const hourlyQuery = await db
        .select({
          hour: sql<number>`EXTRACT(HOUR FROM ${postMetrics.postedAt})`,
          avgScore: sql<number>`AVG(${postMetrics.score})`,
          postCount: sql<number>`COUNT(*)`
        })
        .from(postMetrics)
        .where(
          and(
            eq(postMetrics.subreddit, subreddit),
            userId ? eq(postMetrics.userId, userId) : sql`true`,
            gte(postMetrics.postedAt, thirtyDaysAgo)
          )
        )
        .groupBy(sql`EXTRACT(HOUR FROM ${postMetrics.postedAt})`)
        .orderBy(desc(sql`AVG(${postMetrics.score})`));

      const hourlyScores: Record<number, number> = {};
      let totalPosts = 0;

      hourlyQuery.forEach((row) => {
        const hour = Number(row.hour);
        const score = Number(row.avgScore || 0);
        hourlyScores[hour] = Math.round(score);
        totalPosts += Number(row.postCount || 0);
      });

      // Identify peak hours (top performing hours)
      const sortedHours = Object.entries(hourlyScores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6) // Top 6 hours
        .map(([hour]) => Number(hour))
        .sort((a, b) => a - b);

      // Determine confidence based on sample size
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (totalPosts >= 50) confidence = 'high';
      else if (totalPosts >= 20) confidence = 'medium';

      return {
        subreddit,
        peakHours: sortedHours.length > 0 ? sortedHours : [19, 20, 21, 22], // Default to evenings
        hourlyScores,
        confidence,
        sampleSize: totalPosts
      };
    },
    CACHE_TTL.SIX_HOURS
  );
}

/**
 * Get comprehensive performance analytics for user
 */
export async function getPerformanceAnalytics(
  userId: number,
  subreddit: string
): Promise<PerformanceAnalytics> {
  const [userMetrics, globalMetrics, peakHours] = await Promise.all([
    getUserSubredditMetrics(userId, subreddit),
    getGlobalSubredditMetrics(subreddit),
    detectPeakHours(subreddit, userId)
  ]);

  // Calculate user's percentile rank
  let percentile = 50; // Default to median
  let betterThan = '50% of users';
  
  if (globalMetrics.avgUpvotes > 0 && userMetrics.avgUpvotes >= globalMetrics.avgUpvotes) {
    percentile = Math.min(95, Math.round(50 + (userMetrics.avgUpvotes / globalMetrics.avgUpvotes - 1) * 50));
    betterThan = `${percentile}% of users`;
  }

  userMetrics.vsGlobal = {
    percentile,
    betterThan
  };

  userMetrics.bestHours = peakHours.peakHours;

  // Generate recommendations
  const recommendations: string[] = [];

  if (userMetrics.successRate < 0.7) {
    recommendations.push('Review subreddit rules - your success rate is below 70%');
  }

  if (userMetrics.trending === 'down') {
    recommendations.push(`Engagement trending down ${userMetrics.trendPercent}% - consider changing content strategy`);
  }

  if (userMetrics.avgUpvotes < globalMetrics.avgUpvotes * 0.5) {
    recommendations.push('Your posts are performing below average - try posting at peak hours');
  }

  if (peakHours.confidence === 'low') {
    recommendations.push('Need more post history for accurate peak hour recommendations');
  } else {
    recommendations.push(`Best times to post: ${peakHours.peakHours.map(h => `${h}:00`).join(', ')}`);
  }

  if (userMetrics.trending === 'up') {
    recommendations.push(`Great job! Engagement up ${userMetrics.trendPercent}% - keep it up!`);
  }

  // Get last 30 days summary
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const summaryQuery = await db
    .select({
      totalPosts: sql<number>`COUNT(*)`,
      totalUpvotes: sql<number>`COALESCE(SUM(${postMetrics.score}), 0)`,
      totalComments: sql<number>`COALESCE(SUM(${postMetrics.comments}), 0)`
    })
    .from(postMetrics)
    .where(
      and(
        eq(postMetrics.userId, userId),
        eq(postMetrics.subreddit, subreddit),
        gte(postMetrics.postedAt, thirtyDaysAgo)
      )
    );

  const summary = summaryQuery[0];
  const last30Days = {
    posts: Number(summary?.totalPosts || 0),
    totalUpvotes: Number(summary?.totalUpvotes || 0),
    totalComments: Number(summary?.totalComments || 0),
    growth: userMetrics.trendPercent ? `${userMetrics.trendPercent > 0 ? '+' : ''}${userMetrics.trendPercent}%` : '0%'
  };

  return {
    user: userMetrics,
    global: globalMetrics,
    recommendations,
    last30Days
  };
}

/**
 * Get best day of week for posting
 */
export async function getBestDayOfWeek(
  userId: number,
  subreddit: string
): Promise<string> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dayQuery = await db
    .select({
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${postMetrics.postedAt})`,
      avgScore: sql<number>`AVG(${postMetrics.score})`
    })
    .from(postMetrics)
    .where(
      and(
        eq(postMetrics.userId, userId),
        eq(postMetrics.subreddit, subreddit),
        gte(postMetrics.postedAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`EXTRACT(DOW FROM ${postMetrics.postedAt})`)
    .orderBy(desc(sql`AVG(${postMetrics.score})`))
    .limit(1);

  if (dayQuery.length === 0) {
    return 'Friday'; // Default
  }

  const dayIndex = Number(dayQuery[0].dayOfWeek);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayIndex] || 'Friday';
}
