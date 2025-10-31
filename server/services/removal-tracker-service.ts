/**
 * Removal Tracker Service (QW-2)
 * 
 * Tracks post removals and provides insights to prevent future removals
 */

import { db } from '../db.js';
import { redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, isNotNull, sql, desc } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface RemovalInsight {
  id: number;
  subreddit: string;
  title: string;
  removalReason: string | null;
  removalType: string | null;
  occurredAt: Date;
  detectedAt: Date | null;
  timeUntilRemovalMinutes: number | null;
  redditPostId: string | null;
}

export interface RemovalPattern {
  subreddit: string;
  totalRemovals: number;
  removalRate: number; // percentage
  commonReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  avgTimeUntilRemoval: number | null; // minutes
  recommendations: string[];
}

export interface RemovalStats {
  totalRemovals: number;
  removalRate: number;
  recentRemovals: RemovalInsight[];
  patternsBySubreddit: RemovalPattern[];
  topReasons: Array<{
    reason: string;
    count: number;
    subreddits: string[];
  }>;
}

export class RemovalTrackerService {
  /**
   * Get removal history for a user
   */
  async getRemovalHistory(
    userId: number,
    limit: number = 50,
    daysBack: number = 90
  ): Promise<RemovalInsight[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const removals = await db
        .select({
          id: redditPostOutcomes.id,
          subreddit: redditPostOutcomes.subreddit,
          title: redditPostOutcomes.title,
          removalReason: redditPostOutcomes.removalReason,
          removalType: redditPostOutcomes.removalType,
          occurredAt: redditPostOutcomes.occurredAt,
          detectedAt: redditPostOutcomes.detectedAt,
          timeUntilRemovalMinutes: redditPostOutcomes.timeUntilRemovalMinutes,
          redditPostId: redditPostOutcomes.redditPostId,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            isNotNull(redditPostOutcomes.removalType),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        )
        .orderBy(desc(redditPostOutcomes.occurredAt))
        .limit(limit);

      return removals.map((r) => ({
        id: r.id,
        subreddit: r.subreddit,
        title: r.title || 'Untitled',
        removalReason: r.removalReason,
        removalType: r.removalType,
        occurredAt: r.occurredAt,
        detectedAt: r.detectedAt,
        timeUntilRemovalMinutes: r.timeUntilRemovalMinutes,
        redditPostId: r.redditPostId,
      }));
    } catch (error) {
      logger.error('Failed to get removal history', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Get comprehensive removal statistics
   */
  async getRemovalStats(
    userId: number,
    daysBack: number = 90
  ): Promise<RemovalStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get total posts and removals
      const totals = await db
        .select({
          totalPosts: sql<number>`COUNT(*)::int`,
          totalRemovals: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.removalType} IS NOT NULL THEN 1 END)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        );

      const { totalPosts, totalRemovals } = totals[0] || {
        totalPosts: 0,
        totalRemovals: 0,
      };
      const removalRate =
        totalPosts > 0 ? (totalRemovals / totalPosts) * 100 : 0;

      // Get recent removals
      const recentRemovals = await this.getRemovalHistory(userId, 10, daysBack);

      // Get patterns by subreddit
      const patternsBySubreddit = await this.getRemovalPatterns(
        userId,
        daysBack
      );

      // Get top reasons across all subreddits
      const topReasons = await this.getTopRemovalReasons(userId, daysBack);

      return {
        totalRemovals,
        removalRate: Math.round(removalRate * 10) / 10,
        recentRemovals,
        patternsBySubreddit,
        topReasons,
      };
    } catch (error) {
      logger.error('Failed to get removal stats', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });

      return {
        totalRemovals: 0,
        removalRate: 0,
        recentRemovals: [],
        patternsBySubreddit: [],
        topReasons: [],
      };
    }
  }

  /**
   * Get removal patterns by subreddit
   */
  private async getRemovalPatterns(
    userId: number,
    daysBack: number
  ): Promise<RemovalPattern[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get subreddits with removals
      const subreddits = await db
        .selectDistinct({ subreddit: redditPostOutcomes.subreddit })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            isNotNull(redditPostOutcomes.removalType),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        );

      const patterns = await Promise.all(
        subreddits.map(async (sub) => {
          // Get stats for this subreddit
          const stats = await db
            .select({
              totalPosts: sql<number>`COUNT(*)::int`,
              totalRemovals: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.removalType} IS NOT NULL THEN 1 END)::int`,
              avgTimeUntilRemoval: sql<number>`AVG(${redditPostOutcomes.timeUntilRemovalMinutes})::int`,
            })
            .from(redditPostOutcomes)
            .where(
              and(
                eq(redditPostOutcomes.userId, userId),
                eq(redditPostOutcomes.subreddit, sub.subreddit),
                gte(redditPostOutcomes.occurredAt, startDate)
              )
            );

          const { totalPosts, totalRemovals, avgTimeUntilRemoval } =
            stats[0] || {
              totalPosts: 0,
              totalRemovals: 0,
              avgTimeUntilRemoval: null,
            };

          // Get common reasons
          const reasons = await db
            .select({
              reason: redditPostOutcomes.removalReason,
              count: sql<number>`COUNT(*)::int`,
            })
            .from(redditPostOutcomes)
            .where(
              and(
                eq(redditPostOutcomes.userId, userId),
                eq(redditPostOutcomes.subreddit, sub.subreddit),
                isNotNull(redditPostOutcomes.removalType),
                gte(redditPostOutcomes.occurredAt, startDate)
              )
            )
            .groupBy(redditPostOutcomes.removalReason)
            .orderBy(desc(sql`COUNT(*)`))
            .limit(5);

          const commonReasons = reasons.map((r) => ({
            reason: r.reason || 'Unknown',
            count: r.count,
            percentage:
              totalRemovals > 0
                ? Math.round((r.count / totalRemovals) * 100)
                : 0,
          }));

          // Generate recommendations
          const recommendations = this.generateRecommendations(
            sub.subreddit,
            commonReasons,
            totalRemovals,
            totalPosts
          );

          return {
            subreddit: sub.subreddit,
            totalRemovals,
            removalRate:
              totalPosts > 0
                ? Math.round((totalRemovals / totalPosts) * 100 * 10) / 10
                : 0,
            commonReasons,
            avgTimeUntilRemoval,
            recommendations,
          };
        })
      );

      // Sort by removal count descending
      return patterns.sort((a, b) => b.totalRemovals - a.totalRemovals);
    } catch (error) {
      logger.warn('Failed to get removal patterns', { error });
      return [];
    }
  }

  /**
   * Get top removal reasons across all subreddits
   */
  private async getTopRemovalReasons(
    userId: number,
    daysBack: number
  ): Promise<Array<{ reason: string; count: number; subreddits: string[] }>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const reasons = await db
        .select({
          reason: redditPostOutcomes.removalReason,
          count: sql<number>`COUNT(*)::int`,
          subreddits: sql<string[]>`ARRAY_AGG(DISTINCT ${redditPostOutcomes.subreddit})`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            isNotNull(redditPostOutcomes.removalType),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        )
        .groupBy(redditPostOutcomes.removalReason)
        .orderBy(desc(sql`COUNT(*)`))
        .limit(10);

      return reasons.map((r) => ({
        reason: r.reason || 'Unknown',
        count: r.count,
        subreddits: r.subreddits || [],
      }));
    } catch (error) {
      logger.warn('Failed to get top removal reasons', { error });
      return [];
    }
  }

  /**
   * Generate recommendations based on removal patterns
   */
  private generateRecommendations(
    subreddit: string,
    commonReasons: Array<{ reason: string; count: number }>,
    totalRemovals: number,
    totalPosts: number
  ): string[] {
    const recommendations: string[] = [];
    const removalRate = totalPosts > 0 ? (totalRemovals / totalPosts) * 100 : 0;

    // High removal rate
    if (removalRate > 30) {
      recommendations.push(
        `High removal rate (${Math.round(removalRate)}%) in r/${subreddit} - review subreddit rules carefully`
      );
    }

    // Common reasons
    if (commonReasons.length > 0) {
      const topReason = commonReasons[0];
      if (topReason.reason.toLowerCase().includes('title')) {
        recommendations.push('Review title formatting rules for this subreddit');
      } else if (topReason.reason.toLowerCase().includes('verification')) {
        recommendations.push('Complete verification process for this subreddit');
      } else if (topReason.reason.toLowerCase().includes('spam')) {
        recommendations.push(
          'Reduce posting frequency or vary your content'
        );
      } else if (topReason.reason.toLowerCase().includes('rule')) {
        recommendations.push(
          `Common violation: ${topReason.reason} - review subreddit rules`
        );
      }
    }

    // Multiple removals
    if (totalRemovals >= 3) {
      recommendations.push(
        'Consider reaching out to moderators for clarification'
      );
    }

    return recommendations;
  }
}

// Export singleton instance
export const removalTrackerService = new RemovalTrackerService();
