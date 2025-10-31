/**
 * Recommendation Service (QW-8)
 * 
 * Smart subreddit recommendations based on:
 * - User's successful subreddits
 * - Similar subreddits (category, size, rules)
 * - Compatibility scoring
 * - Competition level
 */

import { db } from '../db.js';
import { redditPostOutcomes, redditCommunities } from '@shared/schema';
import { eq, and, gte, sql, inArray, ne } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface SubredditRecommendation {
  subreddit: string;
  displayName: string;
  compatibilityScore: number; // 0-100
  reason: string;
  estimatedSuccessRate: number; // 0-100
  memberCount: number;
  competitionLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  category?: string;
  over18: boolean;
}

export class RecommendationService {
  /**
   * Generate personalized subreddit recommendations
   */
  async generateRecommendations(
    userId: number,
    limit: number = 10
  ): Promise<SubredditRecommendation[]> {
    try {
      logger.info('Generating subreddit recommendations', { userId, limit });

      // Get user's successful subreddits
      const successfulSubreddits = await this.getUserSuccessfulSubreddits(userId);

      if (successfulSubreddits.length === 0) {
        logger.info('No successful subreddits found, returning popular recommendations');
        return this.getPopularRecommendations(limit);
      }

      // Find similar subreddits
      const similarSubreddits = await this.findSimilarSubreddits(
        successfulSubreddits,
        userId
      );

      // Score and rank recommendations
      const recommendations = await Promise.all(
        similarSubreddits.map(async (subreddit) =>
          this.scoreRecommendation(userId, subreddit, successfulSubreddits)
        )
      );

      // Filter and sort
      return recommendations
        .filter((rec) => rec.compatibilityScore >= 50) // Only show decent matches
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to generate recommendations', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Get user's successful subreddits (success rate > 60%)
   */
  private async getUserSuccessfulSubreddits(
    userId: number
  ): Promise<string[]> {
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const results = await db
        .select({
          subreddit: redditPostOutcomes.subreddit,
          totalPosts: sql<number>`COUNT(*)::int`,
          successfulPosts: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.success} = true THEN 1 END)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, ninetyDaysAgo)
          )
        )
        .groupBy(redditPostOutcomes.subreddit);

      return results
        .filter((r) => {
          const successRate = r.successfulPosts / r.totalPosts;
          return successRate >= 0.6 && r.totalPosts >= 3; // At least 60% success with 3+ posts
        })
        .map((r) => r.subreddit.toLowerCase());
    } catch (error) {
      logger.warn('Failed to get user successful subreddits', { error });
      return [];
    }
  }

  /**
   * Find similar subreddits based on category, size, and rules
   */
  private async findSimilarSubreddits(
    successfulSubreddits: string[],
    userId: number
  ): Promise<typeof redditCommunities.$inferSelect[]> {
    try {
      // Get details of successful subreddits
      const successfulDetails = await db
        .select()
        .from(redditCommunities)
        .where(
          inArray(
            redditCommunities.id,
            successfulSubreddits.map((s) => s.toLowerCase())
          )
        );

      if (successfulDetails.length === 0) {
        return [];
      }

      // Extract common characteristics
      const categories = Array.from(
        new Set(successfulDetails.map((s) => s.category).filter(Boolean))
      );
      const avgMembers =
        successfulDetails.reduce((sum, s) => sum + (s.members || 0), 0) /
        successfulDetails.length;
      const over18 = successfulDetails.some((s) => s.over18);

      // Get user's existing subreddits to exclude
      const existingSubreddits = await db
        .selectDistinct({ subreddit: redditPostOutcomes.subreddit })
        .from(redditPostOutcomes)
        .where(eq(redditPostOutcomes.userId, userId));

      const existingSet = new Set(
        existingSubreddits.map((s) => s.subreddit.toLowerCase())
      );

      // Build query conditions
      const conditions: any[] = [];

      // Filter by category if available
      if (categories.length > 0) {
        conditions.push(
          inArray(
            redditCommunities.category,
            categories.filter((c): c is string => c !== null)
          )
        );
      }

      // Filter by NSFW if user posts NSFW content
      if (over18) {
        conditions.push(eq(redditCommunities.over18, true));
      }

      // Find similar subreddits
      const query = db
        .select()
        .from(redditCommunities)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(50);

      const candidates = await query;

      // Filter out subreddits user has already posted to
      return candidates.filter(
        (c) => !existingSet.has(c.id.toLowerCase())
      );
    } catch (error) {
      logger.warn('Failed to find similar subreddits', { error });
      return [];
    }
  }

  /**
   * Score a recommendation based on compatibility
   */
  private async scoreRecommendation(
    userId: number,
    subreddit: typeof redditCommunities.$inferSelect,
    successfulSubreddits: string[]
  ): Promise<SubredditRecommendation> {
    let score = 50; // Start neutral

    // Category match (+20 points)
    const successfulDetails = await db
      .select()
      .from(redditCommunities)
      .where(
        inArray(
          redditCommunities.id,
          successfulSubreddits.map((s) => s.toLowerCase())
        )
      );

    const successfulCategories = new Set(
      successfulDetails.map((s) => s.category).filter(Boolean)
    );

    if (subreddit.category && successfulCategories.has(subreddit.category)) {
      score += 20;
    }

    // Size similarity (+15 points)
    const avgSuccessfulMembers =
      successfulDetails.reduce((sum, s) => sum + (s.members || 0), 0) /
      successfulDetails.length;

    const memberRatio = (subreddit.members || 0) / avgSuccessfulMembers;
    if (memberRatio >= 0.5 && memberRatio <= 2.0) {
      score += 15; // Similar size
    } else if (memberRatio >= 0.3 && memberRatio <= 3.0) {
      score += 8; // Somewhat similar
    }

    // Competition level (+10 points for low competition)
    const competitionLevel = this.calculateCompetitionLevel(subreddit.members || 0);
    if (competitionLevel === 'low') {
      score += 10;
    } else if (competitionLevel === 'high') {
      score -= 5;
    }

    // Rules similarity (+10 points)
    // Check if subreddit allows flexible content types via rules
    if (subreddit.rules?.content) {
      score += 10; // Has content rules defined
    }

    // Verification not required (+5 points)
    if (!subreddit.verificationRequired) {
      score += 5;
    }

    // Promotion allowed (+5 points)
    if (subreddit.promotionAllowed === 'yes') {
      score += 5;
    } else if (subreddit.promotionAllowed === 'no') {
      score -= 10;
    }

    // Generate reason
    const reason = this.generateReason(
      subreddit,
      successfulSubreddits,
      successfulCategories
    );

    // Estimate success rate based on score
    const estimatedSuccessRate = Math.max(30, Math.min(90, score));

    // Generate warnings
    const warnings = this.generateWarnings(subreddit);

    return {
      subreddit: subreddit.id,
      displayName: subreddit.displayName || subreddit.name,
      compatibilityScore: Math.max(0, Math.min(100, score)),
      reason,
      estimatedSuccessRate,
      memberCount: subreddit.members || 0,
      competitionLevel,
      warnings,
      category: subreddit.category || undefined,
      over18: subreddit.over18 || false,
    };
  }

  /**
   * Calculate competition level based on member count
   */
  private calculateCompetitionLevel(
    members: number
  ): 'low' | 'medium' | 'high' {
    if (members < 50000) return 'low';
    if (members < 500000) return 'medium';
    return 'high';
  }

  /**
   * Generate reason for recommendation
   */
  private generateReason(
    subreddit: typeof redditCommunities.$inferSelect,
    _successfulSubreddits: string[],
    successfulCategories: Set<string | null>
  ): string {
    const reasons: string[] = [];

    if (subreddit.category && successfulCategories.has(subreddit.category)) {
      reasons.push(`Similar to your successful ${subreddit.category} posts`);
    }

    const competitionLevel = this.calculateCompetitionLevel(subreddit.members || 0);
    if (competitionLevel === 'low') {
      reasons.push('Low competition');
    }

    if (subreddit.promotionAllowed === 'yes') {
      reasons.push('Promotion allowed');
    }

    if (!subreddit.verificationRequired) {
      reasons.push('No verification required');
    }

    if (reasons.length === 0) {
      reasons.push('Good match for your content style');
    }

    return reasons.join(' • ');
  }

  /**
   * Generate warnings for recommendation
   */
  private generateWarnings(
    subreddit: typeof redditCommunities.$inferSelect
  ): string[] {
    const warnings: string[] = [];

    if (subreddit.verificationRequired) {
      warnings.push('Verification required');
    }

    if (subreddit.promotionAllowed === 'no') {
      warnings.push('Promotion not allowed');
    } else if (subreddit.promotionAllowed === 'limited') {
      warnings.push('Limited promotion allowed');
    }

    const competitionLevel = this.calculateCompetitionLevel(subreddit.members || 0);
    if (competitionLevel === 'high') {
      warnings.push('High competition');
    }

    if (subreddit.rules?.posting?.cooldownHours && subreddit.rules.posting.cooldownHours >= 24) {
      warnings.push(`${subreddit.rules.posting.cooldownHours}h cooldown between posts`);
    }

    return warnings;
  }

  /**
   * Get popular recommendations when no user data available
   */
  private async getPopularRecommendations(
    limit: number
  ): Promise<SubredditRecommendation[]> {
    try {
      const popular = await db
        .select()
        .from(redditCommunities)
        .where(
          and(
            eq(redditCommunities.over18, true), // Adult content platform
            sql`${redditCommunities.members} > 50000` // Decent size
          )
        )
        .orderBy(sql`${redditCommunities.members} DESC`)
        .limit(limit);

      return popular.map((subreddit) => ({
        subreddit: subreddit.id,
        displayName: subreddit.displayName || subreddit.name,
        compatibilityScore: 60, // Neutral score
        reason: 'Popular subreddit for adult content creators',
        estimatedSuccessRate: 60,
        memberCount: subreddit.members || 0,
        competitionLevel: this.calculateCompetitionLevel(subreddit.members || 0),
        warnings: this.generateWarnings(subreddit),
        category: subreddit.category || undefined,
        over18: subreddit.over18 || false,
      }));
    } catch (error) {
      logger.warn('Failed to get popular recommendations', { error });
      return [];
    }
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService();
