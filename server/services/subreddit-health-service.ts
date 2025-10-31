/**
 * Subreddit Health Service (QW-6)
 * 
 * Calculates health scores for subreddits based on:
 * - Success rate (40%)
 * - Engagement score (30%)
 * - Removal rate inverted (30%)
 */

import { db } from '../db.js';
import { redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface SubredditHealth {
  subreddit: string;
  healthScore: number; // 0-100
  status: 'excellent' | 'healthy' | 'watch' | 'risky';
  breakdown: {
    successRate: number; // 0-100
    successScore: number; // Weighted score (0-40)
    engagementRate: number; // 0-100
    engagementScore: number; // Weighted score (0-30)
    removalRate: number; // 0-100
    removalScore: number; // Weighted score (0-30)
  };
  metrics: {
    totalPosts: number;
    successfulPosts: number;
    removedPosts: number;
    avgUpvotes: number;
    avgViews: number;
  };
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export class SubredditHealthService {
  /**
   * Calculate health score for a specific subreddit
   */
  async calculateHealth(
    userId: number,
    subreddit: string,
    daysBack: number = 30
  ): Promise<SubredditHealth> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get metrics for the period
      const results = await db
        .select({
          totalPosts: sql<number>`COUNT(*)::int`,
          successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
          removedPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.removalType} IS NOT NULL THEN 1 END)::int`,
          avgUpvotes: sql<number>`COALESCE(AVG(${redditPostOutcomes.upvotes}), 0)::int`,
          avgViews: sql<number>`COALESCE(AVG(${redditPostOutcomes.views}), 0)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        );

      const metrics = results[0];

      if (!metrics || metrics.totalPosts === 0) {
        // No data - return neutral score
        return {
          subreddit,
          healthScore: 50,
          status: 'watch',
          breakdown: {
            successRate: 0,
            successScore: 0,
            engagementRate: 0,
            engagementScore: 0,
            removalRate: 0,
            removalScore: 0,
          },
          metrics: {
            totalPosts: 0,
            successfulPosts: 0,
            removedPosts: 0,
            avgUpvotes: 0,
            avgViews: 0,
          },
          trend: 'unknown',
        };
      }

      // Calculate rates
      const successRate = (metrics.successfulPosts / metrics.totalPosts) * 100;
      const removalRate = (metrics.removedPosts / metrics.totalPosts) * 100;

      // Calculate engagement rate (normalized to 0-100)
      // Assume 200 upvotes is "excellent" engagement
      const engagementRate = Math.min(
        ((metrics.avgUpvotes + metrics.avgViews / 10) / 200) * 100,
        100
      );

      // Calculate weighted scores
      const successScore = (successRate / 100) * 40; // 40% weight
      const engagementScore = (engagementRate / 100) * 30; // 30% weight
      const removalScore = ((100 - removalRate) / 100) * 30; // 30% weight (inverted)

      // Total health score
      const healthScore = Math.round(successScore + engagementScore + removalScore);

      // Determine status
      const status = this.determineStatus(healthScore);

      // Calculate trend
      const trend = await this.calculateTrend(userId, subreddit, daysBack);

      return {
        subreddit,
        healthScore,
        status,
        breakdown: {
          successRate: Math.round(successRate),
          successScore: Math.round(successScore * 10) / 10,
          engagementRate: Math.round(engagementRate),
          engagementScore: Math.round(engagementScore * 10) / 10,
          removalRate: Math.round(removalRate),
          removalScore: Math.round(removalScore * 10) / 10,
        },
        metrics: {
          totalPosts: metrics.totalPosts,
          successfulPosts: metrics.successfulPosts,
          removedPosts: metrics.removedPosts,
          avgUpvotes: metrics.avgUpvotes,
          avgViews: metrics.avgViews,
        },
        trend,
      };
    } catch (error) {
      logger.error('Failed to calculate subreddit health', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        subreddit,
      });

      // Return neutral score on error
      return {
        subreddit,
        healthScore: 50,
        status: 'watch',
        breakdown: {
          successRate: 0,
          successScore: 0,
          engagementRate: 0,
          engagementScore: 0,
          removalRate: 0,
          removalScore: 0,
        },
        metrics: {
          totalPosts: 0,
          successfulPosts: 0,
          removedPosts: 0,
          avgUpvotes: 0,
          avgViews: 0,
        },
        trend: 'unknown',
      };
    }
  }

  /**
   * Calculate health scores for all user's subreddits
   */
  async calculateAllHealth(
    userId: number,
    daysBack: number = 30
  ): Promise<SubredditHealth[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get all subreddits user has posted to
      const subreddits = await db
        .selectDistinct({ subreddit: redditPostOutcomes.subreddit })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        );

      // Calculate health for each subreddit
      const healthScores = await Promise.all(
        subreddits.map((sub) =>
          this.calculateHealth(userId, sub.subreddit, daysBack)
        )
      );

      // Sort by health score descending
      return healthScores.sort((a, b) => b.healthScore - a.healthScore);
    } catch (error) {
      logger.error('Failed to calculate all subreddit health scores', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Determine status based on health score
   */
  private determineStatus(
    healthScore: number
  ): 'excellent' | 'healthy' | 'watch' | 'risky' {
    if (healthScore >= 85) return 'excellent';
    if (healthScore >= 70) return 'healthy';
    if (healthScore >= 50) return 'watch';
    return 'risky';
  }

  /**
   * Calculate trend by comparing recent vs previous period
   */
  private async calculateTrend(
    userId: number,
    subreddit: string,
    daysBack: number
  ): Promise<'improving' | 'stable' | 'declining' | 'unknown'> {
    try {
      const halfPeriod = Math.floor(daysBack / 2);

      // Recent period
      const recentStart = new Date();
      recentStart.setDate(recentStart.getDate() - halfPeriod);

      const recentResults = await db
        .select({
          successRate: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, recentStart)
          )
        );

      // Previous period
      const previousStart = new Date();
      previousStart.setDate(previousStart.getDate() - daysBack);
      const previousEnd = new Date();
      previousEnd.setDate(previousEnd.getDate() - halfPeriod);

      const previousResults = await db
        .select({
          successRate: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::float / NULLIF(COUNT(*), 0)`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, previousStart),
            sql`${redditPostOutcomes.occurredAt} < ${previousEnd}`
          )
        );

      const recentRate = recentResults[0]?.successRate || 0;
      const previousRate = previousResults[0]?.successRate || 0;

      if (previousRate === 0) return 'unknown';

      const change = ((recentRate - previousRate) / previousRate) * 100;

      if (change > 10) return 'improving';
      if (change < -10) return 'declining';
      return 'stable';
    } catch (error) {
      logger.warn('Failed to calculate trend', { error });
      return 'unknown';
    }
  }
}

// Export singleton instance
export const subredditHealthService = new SubredditHealthService();
