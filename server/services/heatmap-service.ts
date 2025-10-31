/**
 * Heatmap Service (QW-9)
 * 
 * Generates engagement heatmap data for optimal posting times
 */

import { db } from '../db.js';
import { redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface HeatmapCell {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  engagement: number; // Average engagement score
  postCount: number; // Number of posts in this slot
  avgUpvotes: number;
  avgComments: number;
  classification: 'best' | 'good' | 'average' | 'avoid';
}

export class HeatmapService {
  /**
   * Generate engagement heatmap data
   */
  async generateHeatmap(
    userId: number,
    subreddit?: string,
    daysBack: number = 90
  ): Promise<HeatmapCell[]> {
    try {
      logger.info('Generating engagement heatmap', { userId, subreddit, daysBack });

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Build query conditions
      const conditions = [
        eq(redditPostOutcomes.userId, userId),
        gte(redditPostOutcomes.occurredAt, startDate),
      ];

      if (subreddit) {
        conditions.push(eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()));
      }

      // Query engagement by day of week and hour
      const results = await db
        .select({
          day: sql<number>`EXTRACT(DOW FROM ${redditPostOutcomes.occurredAt})::int`,
          hour: sql<number>`EXTRACT(HOUR FROM ${redditPostOutcomes.occurredAt})::int`,
          postCount: sql<number>`COUNT(*)::int`,
          avgUpvotes: sql<number>`COALESCE(AVG(${redditPostOutcomes.upvotes}), 0)::int`,
          avgComments: sql<number>`COALESCE(AVG(${redditPostOutcomes.commentCount}), 0)::int`,
        })
        .from(redditPostOutcomes)
        .where(and(...conditions))
        .groupBy(sql`EXTRACT(DOW FROM ${redditPostOutcomes.occurredAt})`, sql`EXTRACT(HOUR FROM ${redditPostOutcomes.occurredAt})`);

      // Calculate engagement score and classify
      const cells: HeatmapCell[] = results.map((result) => {
        // Engagement score = upvotes + (comments * 2)
        const engagement = result.avgUpvotes + (result.avgComments * 2);

        return {
          day: result.day,
          hour: result.hour,
          engagement,
          postCount: result.postCount,
          avgUpvotes: result.avgUpvotes,
          avgComments: result.avgComments,
          classification: 'average', // Will be classified after we have all data
        };
      });

      // Classify cells based on engagement distribution
      if (cells.length > 0) {
        const engagements = cells.map((c) => c.engagement).sort((a, b) => a - b);
        const p75 = engagements[Math.floor(engagements.length * 0.75)];
        const p50 = engagements[Math.floor(engagements.length * 0.50)];
        const p25 = engagements[Math.floor(engagements.length * 0.25)];

        cells.forEach((cell) => {
          if (cell.engagement >= p75) {
            cell.classification = 'best';
          } else if (cell.engagement >= p50) {
            cell.classification = 'good';
          } else if (cell.engagement >= p25) {
            cell.classification = 'average';
          } else {
            cell.classification = 'avoid';
          }
        });
      }

      // Fill in missing cells with zero data
      const fullGrid: HeatmapCell[] = [];
      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          const existing = cells.find((c) => c.day === day && c.hour === hour);
          if (existing) {
            fullGrid.push(existing);
          } else {
            fullGrid.push({
              day,
              hour,
              engagement: 0,
              postCount: 0,
              avgUpvotes: 0,
              avgComments: 0,
              classification: 'average',
            });
          }
        }
      }

      logger.info('Generated heatmap', {
        userId,
        subreddit,
        cellsWithData: cells.length,
        totalCells: fullGrid.length,
      });

      return fullGrid;
    } catch (error) {
      logger.error('Failed to generate heatmap', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        subreddit,
      });
      return [];
    }
  }

  /**
   * Get best posting times (top 5)
   */
  async getBestTimes(
    userId: number,
    subreddit?: string,
    daysBack: number = 90
  ): Promise<Array<{ day: number; hour: number; engagement: number }>> {
    try {
      const heatmap = await this.generateHeatmap(userId, subreddit, daysBack);

      return heatmap
        .filter((cell) => cell.postCount > 0) // Only cells with data
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 5);
    } catch (error) {
      logger.warn('Failed to get best times', { error });
      return [];
    }
  }
}

// Export singleton instance
export const heatmapService = new HeatmapService();
