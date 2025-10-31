/**
 * Prediction Service (QW-7)
 * 
 * Rule-based performance prediction for Reddit posts.
 * Predicts post performance based on:
 * - Title length and quality
 * - Posting time
 * - Subreddit health
 * - User's historical success rate
 */

import { db } from '../db.js';
import { redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface PerformancePrediction {
  level: 'low' | 'medium' | 'high' | 'viral';
  score: number; // 0-100
  confidence: 'low' | 'medium' | 'high';
  suggestions: string[];
  factors: {
    titleScore: number;
    timingScore: number;
    subredditHealthScore: number;
    userSuccessScore: number;
  };
}

export interface PredictionInput {
  userId: number;
  subreddit: string;
  title: string;
  scheduledTime: Date;
}

export class PredictionService {
  /**
   * Predict post performance
   */
  async predictPerformance(input: PredictionInput): Promise<PerformancePrediction> {
    try {
      logger.info('Predicting post performance', {
        userId: input.userId,
        subreddit: input.subreddit,
      });

      // Calculate individual factor scores
      const titleScore = this.calculateTitleScore(input.title);
      const timingScore = await this.calculateTimingScore(
        input.userId,
        input.subreddit,
        input.scheduledTime
      );
      const subredditHealthScore = await this.calculateSubredditHealthScore(
        input.userId,
        input.subreddit
      );
      const userSuccessScore = await this.calculateUserSuccessScore(
        input.userId,
        input.subreddit
      );

      // Weighted average (title: 15%, timing: 20%, health: 35%, user: 30%)
      const score = Math.round(
        titleScore * 0.15 +
        timingScore * 0.20 +
        subredditHealthScore * 0.35 +
        userSuccessScore * 0.30
      );

      // Classify performance level
      const level = this.classifyLevel(score);

      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(
        input.userId,
        input.subreddit,
        userSuccessScore
      );

      // Generate suggestions
      const suggestions = this.generateSuggestions(
        input,
        {
          titleScore,
          timingScore,
          subredditHealthScore,
          userSuccessScore,
        }
      );

      return {
        level,
        score,
        confidence,
        suggestions,
        factors: {
          titleScore,
          timingScore,
          subredditHealthScore,
          userSuccessScore,
        },
      };
    } catch (error) {
      logger.error('Failed to predict performance', {
        error: error instanceof Error ? error.message : String(error),
        input,
      });

      // Return neutral prediction on error
      return {
        level: 'medium',
        score: 50,
        confidence: 'low',
        suggestions: ['Unable to generate prediction. Try again later.'],
        factors: {
          titleScore: 50,
          timingScore: 50,
          subredditHealthScore: 50,
          userSuccessScore: 50,
        },
      };
    }
  }

  /**
   * Calculate title quality score (0-100)
   */
  private calculateTitleScore(title: string): number {
    let score = 50; // Start neutral

    const length = title.length;

    // Optimal length: 40-80 characters (+15 points)
    if (length >= 40 && length <= 80) {
      score += 30;
    } else if (length >= 20 && length < 40) {
      score += 15; // Decent length
    } else if (length > 80 && length <= 120) {
      score += 10; // Acceptable but long
    } else if (length < 20) {
      score -= 20; // Too short
    } else {
      score -= 15; // Too long
    }

    // Has question mark (+10 points)
    if (title.includes('?')) {
      score += 10;
    }

    // Has emojis (+5 points, max 2)
    const emojiCount = (title.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
    score += Math.min(emojiCount * 5, 10);

    // All caps penalty (-15 points)
    if (title === title.toUpperCase() && title.length > 5) {
      score -= 15;
    }

    // Excessive punctuation penalty (-10 points)
    const punctuationCount = (title.match(/[!?]{2,}/g) || []).length;
    if (punctuationCount > 0) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate timing score based on historical performance (0-100)
   */
  private async calculateTimingScore(
    userId: number,
    subreddit: string,
    scheduledTime: Date
  ): Promise<number> {
    try {
      const hour = scheduledTime.getHours();
      const dayOfWeek = scheduledTime.getDay();

      // Get historical performance for this time slot
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await db
        .select({
          avgUpvotes: sql<number>`AVG(${redditPostOutcomes.upvotes})::int`,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, thirtyDaysAgo),
            sql`EXTRACT(HOUR FROM ${redditPostOutcomes.occurredAt}) = ${hour}`,
            sql`EXTRACT(DOW FROM ${redditPostOutcomes.occurredAt}) = ${dayOfWeek}`
          )
        );

      const result = results[0];

      if (!result || result.count === 0) {
        // No historical data for this time slot
        // Use general heuristics
        return this.getDefaultTimingScore(hour, dayOfWeek);
      }

      const avgUpvotes = result.avgUpvotes || 0;

      // Get overall average for comparison
      const overallResults = await db
        .select({
          avgUpvotes: sql<number>`AVG(${redditPostOutcomes.upvotes})::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
          )
        );

      const overallAvg = overallResults[0]?.avgUpvotes || avgUpvotes;

      // Score based on performance vs average
      if (avgUpvotes >= overallAvg * 1.3) {
        return 90; // Excellent time
      } else if (avgUpvotes >= overallAvg * 1.1) {
        return 75; // Good time
      } else if (avgUpvotes >= overallAvg * 0.9) {
        return 60; // Average time
      } else {
        return 40; // Below average time
      }
    } catch (error) {
      logger.warn('Failed to calculate timing score', { error });
      return this.getDefaultTimingScore(
        scheduledTime.getHours(),
        scheduledTime.getDay()
      );
    }
  }

  /**
   * Default timing score based on general Reddit patterns
   */
  private getDefaultTimingScore(hour: number, dayOfWeek: number): number {
    let score = 50;

    // Best hours: 7-9 PM (19-21)
    if (hour >= 19 && hour <= 21) {
      score += 25;
    } else if (hour >= 17 && hour <= 23) {
      score += 15; // Evening hours
    } else if (hour >= 6 && hour <= 9) {
      score += 10; // Morning hours
    } else if (hour >= 2 && hour <= 5) {
      score -= 20; // Late night/early morning
    }

    // Best days: Thursday-Saturday (4-6)
    if (dayOfWeek >= 4 && dayOfWeek <= 6) {
      score += 10;
    } else if (dayOfWeek === 0 || dayOfWeek === 1) {
      score -= 5; // Sunday/Monday slightly worse
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate subreddit health score (0-100)
   */
  private async calculateSubredditHealthScore(
    userId: number,
    subreddit: string
  ): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await db
        .select({
          totalPosts: sql<number>`COUNT(*)::int`,
          successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
          avgUpvotes: sql<number>`AVG(${redditPostOutcomes.upvotes})::int`,
          removedPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.status} = 'removed' THEN 1 END)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
          )
        );

      const result = results[0];

      if (!result || result.totalPosts === 0) {
        // No historical data - return neutral score
        return 50;
      }

      const successRate = result.successfulPosts / result.totalPosts;
      const removalRate = result.removedPosts / result.totalPosts;
      const avgUpvotes = result.avgUpvotes || 0;

      // Health score formula:
      // - Success rate: 40%
      // - Engagement (upvotes): 30%
      // - Removal rate (inverted): 30%
      const score = Math.round(
        successRate * 40 +
        Math.min(avgUpvotes / 200, 1) * 30 +
        (1 - removalRate) * 30
      );

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      logger.warn('Failed to calculate subreddit health score', { error });
      return 50; // Neutral score on error
    }
  }

  /**
   * Calculate user's success score in this subreddit (0-100)
   */
  private async calculateUserSuccessScore(
    userId: number,
    subreddit: string
  ): Promise<number> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const results = await db
        .select({
          totalPosts: sql<number>`COUNT(*)::int`,
          successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
          avgUpvotes: sql<number>`AVG(${redditPostOutcomes.upvotes})::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            gte(redditPostOutcomes.occurredAt, ninetyDaysAgo)
          )
        );

      const result = results[0];

      if (!result || result.totalPosts === 0) {
        // No historical data - return neutral score
        return 50;
      }

      const successRate = result.successfulPosts / result.totalPosts;
      const avgUpvotes = result.avgUpvotes || 0;

      // User success score:
      // - Success rate: 60%
      // - Average engagement: 40%
      const score = Math.round(
        successRate * 60 +
        Math.min(avgUpvotes / 200, 1) * 40
      );

      return Math.max(0, Math.min(100, score));
    } catch (error) {
      logger.warn('Failed to calculate user success score', { error });
      return 50; // Neutral score on error
    }
  }

  /**
   * Classify performance level based on score
   */
  private classifyLevel(score: number): 'low' | 'medium' | 'high' | 'viral' {
    if (score >= 80) return 'viral';
    if (score >= 65) return 'high';
    if (score >= 45) return 'medium';
    return 'low';
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(
    _userId: number,
    _subreddit: string,
    userSuccessScore: number
  ): 'low' | 'medium' | 'high' {
    // High confidence if user has good historical data
    if (userSuccessScore >= 70 || userSuccessScore <= 30) {
      return 'high';
    }
    if (userSuccessScore >= 55 || userSuccessScore <= 45) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Generate actionable suggestions
   */
  private generateSuggestions(
    input: PredictionInput,
    factors: PerformancePrediction['factors']
  ): string[] {
    const suggestions: string[] = [];

    // Title suggestions
    if (factors.titleScore < 60) {
      const length = input.title.length;
      if (length < 40) {
        suggestions.push('Make your title longer (aim for 40-80 characters)');
      } else if (length > 80) {
        suggestions.push('Shorten your title (aim for 40-80 characters)');
      }

      if (!input.title.includes('?')) {
        suggestions.push('Consider asking a question to boost engagement');
      }
    }

    // Timing suggestions
    if (factors.timingScore < 60) {
      const hour = input.scheduledTime.getHours();
      if (hour < 17 || hour > 23) {
        suggestions.push('Consider posting during peak hours (7-9 PM)');
      }
    }

    // Subreddit health suggestions
    if (factors.subredditHealthScore < 50) {
      suggestions.push(
        `This subreddit has shown lower performance recently. Consider trying a different subreddit.`
      );
    }

    // User success suggestions
    if (factors.userSuccessScore < 50) {
      suggestions.push(
        `Your recent posts in r/${input.subreddit} haven't performed well. Review successful posts for patterns.`
      );
    }

    // If no specific suggestions, provide general advice
    if (suggestions.length === 0) {
      suggestions.push('Your post looks good! Consider adding an engaging image.');
    }

    return suggestions.slice(0, 5); // Max 5 suggestions
  }
}

// Export singleton instance
export const predictionService = new PredictionService();
