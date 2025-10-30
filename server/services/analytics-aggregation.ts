/**
 * Analytics Aggregation Service
 *
 * Aggregates raw data into daily analytics tables for dashboard performance
 */

import { db } from '../db.js';
import {
  analyticsContentPerformanceDaily,
  redditPostOutcomes,
  captionVariants,
  contentGenerations,
} from '@shared/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

/**
 * Aggregate content performance metrics for a specific day
 */
export async function aggregateContentPerformanceForDay(targetDate: Date): Promise<void> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  logger.info('📊 Aggregating content performance', {
    date: startOfDay.toISOString().split('T')[0]
  });

  try {
    // Get all successful Reddit posts for the day, grouped by user and subreddit
    const results = await db
      .select({
        userId: redditPostOutcomes.userId,
        subreddit: redditPostOutcomes.subreddit,
        title: redditPostOutcomes.title,
        totalPosts: sql<number>`count(*)`,
        totalUpvotes: sql<number>`sum(${redditPostOutcomes.upvotes})`,
        totalViews: sql<number>`sum(${redditPostOutcomes.views})`,
        avgUpvotes: sql<number>`avg(${redditPostOutcomes.upvotes})`,
        avgViews: sql<number>`avg(${redditPostOutcomes.views})`,
      })
      .from(redditPostOutcomes)
      .where(
        and(
          eq(redditPostOutcomes.success, true),
          gte(redditPostOutcomes.occurredAt, startOfDay),
          lte(redditPostOutcomes.occurredAt, endOfDay)
        )
      )
      .groupBy(
        redditPostOutcomes.userId,
        redditPostOutcomes.subreddit,
        redditPostOutcomes.title
      );

    logger.info(`📈 Found ${results.length} content performance records to aggregate`);

    // Insert/Update analytics records
    for (const result of results) {
      const engagementRate = result.totalViews > 0
        ? (result.totalUpvotes / result.totalViews) * 100
        : 0;

      // Check if record exists
      const existing = await db
        .select()
        .from(analyticsContentPerformanceDaily)
        .where(
          and(
            eq(analyticsContentPerformanceDaily.userId, result.userId),
            eq(analyticsContentPerformanceDaily.subreddit, result.subreddit || ''),
            eq(analyticsContentPerformanceDaily.day, startOfDay.toISOString().split('T')[0])
          )
        )
        .limit(1);

      const data = {
        userId: result.userId,
        contentId: 0, // We don't have a specific content ID, use 0 for aggregated
        platform: 'reddit' as const,
        subreddit: result.subreddit || '',
        primaryTitle: result.title || '',
        day: startOfDay.toISOString().split('T')[0],
        totalViews: result.totalViews,
        uniqueViewers: result.totalViews, // Approximate - Reddit doesn't give us unique viewers
        avgTimeSpent: 0, // Not available from Reddit API
        totalTimeSpent: 0,
        socialViews: result.totalViews,
        likes: result.totalUpvotes,
        comments: 0, // Would need separate API call
        shares: 0, // Not available from Reddit API
        engagementRate: Math.round(engagementRate * 100) / 100,
      };

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(analyticsContentPerformanceDaily)
          .set(data)
          .where(eq(analyticsContentPerformanceDaily.userId, result.userId));
      } else {
        // Insert new record
        await db.insert(analyticsContentPerformanceDaily).values(data);
      }
    }

    logger.info('✅ Content performance aggregation complete', {
      recordsProcessed: results.length
    });

  } catch (error) {
    logger.error('❌ Failed to aggregate content performance', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      date: startOfDay.toISOString().split('T')[0]
    });
    throw error;
  }
}

/**
 * Aggregate AI usage metrics for a specific day
 */
export async function aggregateAiUsageForDay(targetDate: Date): Promise<void> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  logger.info('🤖 Aggregating AI usage', {
    date: startOfDay.toISOString().split('T')[0]
  });

  try {
    // Get caption generations for the day
    const captionResults = await db
      .select({
        userId: captionVariants.userId,
        count: sql<number>`count(*)`,
      })
      .from(captionVariants)
      .where(
        and(
          gte(captionVariants.createdAt, startOfDay),
          lte(captionVariants.createdAt, endOfDay)
        )
      )
      .groupBy(captionVariants.userId);

    // Get content generations for the day
    const contentGenResults = await db
      .select({
        userId: contentGenerations.userId,
        count: sql<number>`count(*)`,
      })
      .from(contentGenerations)
      .where(
        and(
          gte(contentGenerations.createdAt, startOfDay),
          lte(contentGenerations.createdAt, endOfDay)
        )
      )
      .groupBy(contentGenerations.userId);

    // Combine results by userId
    const userGenerations = new Map<number, number>();

    for (const result of captionResults) {
      if (result.userId) {
        userGenerations.set(result.userId, (userGenerations.get(result.userId) || 0) + result.count);
      }
    }

    for (const result of contentGenResults) {
      if (result.userId) {
        userGenerations.set(result.userId, (userGenerations.get(result.userId) || 0) + result.count);
      }
    }

    logger.info(`🤖 Found ${userGenerations.size} users with AI usage to aggregate`);

    // Refresh the materialized view (analytics_ai_usage_daily is a view, not a table)
    // The view automatically aggregates data from ai_generations table
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_ai_usage_daily`);

    logger.info('✅ AI usage aggregation complete - materialized view refreshed', {
      usersProcessed: userGenerations.size,
      totalGenerations: Array.from(userGenerations.values()).reduce((a, b) => a + b, 0)
    });

  } catch (error) {
    logger.error('❌ Failed to aggregate AI usage', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      date: startOfDay.toISOString().split('T')[0]
    });
    throw error;
  }
}

/**
 * Aggregate all analytics for yesterday
 * Called daily by cron job
 */
export async function aggregateYesterday(): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  logger.info('🔄 Starting daily analytics aggregation', {
    date: yesterday.toISOString().split('T')[0]
  });

  try {
    await aggregateContentPerformanceForDay(yesterday);
    await aggregateAiUsageForDay(yesterday);

    logger.info('✅ Daily analytics aggregation complete', {
      date: yesterday.toISOString().split('T')[0]
    });
  } catch (error) {
    logger.error('❌ Daily analytics aggregation failed', {
      error: error instanceof Error ? error.message : String(error),
      date: yesterday.toISOString().split('T')[0]
    });
    throw error;
  }
}

/**
 * Backfill analytics for a date range
 * Useful for initial setup or fixing gaps
 */
export async function backfillAnalytics(startDate: Date, endDate: Date): Promise<void> {
  logger.info('🔄 Starting analytics backfill', {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  });

  const currentDate = new Date(startDate);
  let daysProcessed = 0;

  while (currentDate <= endDate) {
    try {
      await aggregateContentPerformanceForDay(new Date(currentDate));
      await aggregateAiUsageForDay(new Date(currentDate));
      daysProcessed++;
    } catch (error) {
      logger.error('❌ Failed to backfill day', {
        date: currentDate.toISOString().split('T')[0],
        error: error instanceof Error ? error.message : String(error)
      });
      // Continue with next day even if one fails
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  logger.info('✅ Analytics backfill complete', {
    daysProcessed,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  });
}

/**
 * Update real-time analytics metrics (hourly)
 * This updates running totals for the current day
 */
export async function updateCurrentDayMetrics(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  logger.info('🔄 Updating current day metrics', {
    date: today.toISOString().split('T')[0]
  });

  try {
    // Aggregate today's data so far
    await aggregateContentPerformanceForDay(today);
    await aggregateAiUsageForDay(today);

    logger.info('✅ Current day metrics updated');
  } catch (error) {
    logger.error('❌ Failed to update current day metrics', {
      error: error instanceof Error ? error.message : String(error)
    });
    // Don't throw - this is non-critical
  }
}
