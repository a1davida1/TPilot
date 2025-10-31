/**
 * Rule Validator Service (QW-3)
 * 
 * Enhanced rule validation with personalized warnings based on user's removal history
 */

import { db } from '../db.js';
import { redditCommunities, redditPostOutcomes } from '@shared/schema';
import { eq, and, isNotNull, gte } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';

export interface ValidationResult {
  isValid: boolean;
  severity: 'pass' | 'warning' | 'error';
  violations: Violation[];
  personalizedWarnings: string[];
  recommendations: string[];
}

export interface Violation {
  rule: string;
  severity: 'warning' | 'error';
  message: string;
  field: 'title' | 'content' | 'flair' | 'timing' | 'general';
}

export class RuleValidatorService {
  /**
   * Validate a post against subreddit rules with personalized warnings
   */
  async validatePost(
    userId: number,
    subreddit: string,
    title: string,
    content?: string,
    flair?: string
  ): Promise<ValidationResult> {
    try {
      logger.info('Validating post', { userId, subreddit, titleLength: title.length });

      // Get subreddit rules
      const [community] = await db
        .select()
        .from(redditCommunities)
        .where(eq(redditCommunities.id, subreddit.toLowerCase()))
        .limit(1);

      if (!community) {
        return {
          isValid: true,
          severity: 'warning',
          violations: [],
          personalizedWarnings: ['Subreddit not found in database - unable to validate rules'],
          recommendations: [],
        };
      }

      const violations: Violation[] = [];

      // Validate title
      this.validateTitle(title, community, violations);

      // Validate content
      if (content) {
        this.validateContent(content, community, violations);
      }

      // Validate flair
      if (community.flairRequired && !flair) {
        violations.push({
          rule: 'Flair Required',
          severity: 'error',
          message: 'This subreddit requires post flair',
          field: 'flair',
        });
      }

      // Validate verification
      if (community.verificationRequired) {
        violations.push({
          rule: 'Verification Required',
          severity: 'warning',
          message: 'This subreddit requires account verification',
          field: 'general',
        });
      }

      // Get personalized warnings based on user's removal history
      const personalizedWarnings = await this.getPersonalizedWarnings(
        userId,
        subreddit
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        violations,
        community
      );

      // Determine overall severity
      const hasErrors = violations.some((v) => v.severity === 'error');
      const hasWarnings = violations.length > 0 || personalizedWarnings.length > 0;

      return {
        isValid: !hasErrors,
        severity: hasErrors ? 'error' : hasWarnings ? 'warning' : 'pass',
        violations,
        personalizedWarnings,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to validate post', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        subreddit,
      });

      return {
        isValid: true,
        severity: 'warning',
        violations: [],
        personalizedWarnings: ['Unable to validate rules - please review manually'],
        recommendations: [],
      };
    }
  }

  /**
   * Validate title against subreddit rules
   */
  private validateTitle(
    title: string,
    community: typeof redditCommunities.$inferSelect,
    violations: Violation[]
  ): void {
    const rules = community.rules as any;

    // Check title length
    if (rules?.title?.minLength && title.length < rules.title.minLength) {
      violations.push({
        rule: 'Title Too Short',
        severity: 'error',
        message: `Title must be at least ${rules.title.minLength} characters`,
        field: 'title',
      });
    }

    if (rules?.title?.maxLength && title.length > rules.title.maxLength) {
      violations.push({
        rule: 'Title Too Long',
        severity: 'error',
        message: `Title must be no more than ${rules.title.maxLength} characters`,
        field: 'title',
      });
    }

    // Check for banned words
    if (rules?.title?.bannedWords && Array.isArray(rules.title.bannedWords)) {
      const bannedWords = rules.title.bannedWords as string[];
      const lowerTitle = title.toLowerCase();
      const foundBanned = bannedWords.filter((word) =>
        lowerTitle.includes(word.toLowerCase())
      );

      if (foundBanned.length > 0) {
        violations.push({
          rule: 'Banned Words',
          severity: 'error',
          message: `Title contains banned words: ${foundBanned.join(', ')}`,
          field: 'title',
        });
      }
    }

    // Check for required words
    if (rules?.title?.requiredWords && Array.isArray(rules.title.requiredWords)) {
      const requiredWords = rules.title.requiredWords as string[];
      const lowerTitle = title.toLowerCase();
      const missingRequired = requiredWords.filter(
        (word) => !lowerTitle.includes(word.toLowerCase())
      );

      if (missingRequired.length > 0) {
        violations.push({
          rule: 'Missing Required Words',
          severity: 'error',
          message: `Title must include: ${missingRequired.join(', ')}`,
          field: 'title',
        });
      }
    }

    // Check for all caps
    if (title === title.toUpperCase() && title.length > 5) {
      violations.push({
        rule: 'All Caps',
        severity: 'warning',
        message: 'Avoid using all caps in titles',
        field: 'title',
      });
    }

    // Check for excessive punctuation
    const punctuationCount = (title.match(/[!?]{2,}/g) || []).length;
    if (punctuationCount > 0) {
      violations.push({
        rule: 'Excessive Punctuation',
        severity: 'warning',
        message: 'Avoid excessive punctuation (!!!, ???)',
        field: 'title',
      });
    }
  }

  /**
   * Validate content against subreddit rules
   */
  private validateContent(
    content: string,
    community: typeof redditCommunities.$inferSelect,
    violations: Violation[]
  ): void {
    const rules = community.rules as any;

    // Check content length
    if (rules?.content?.minLength && content.length < rules.content.minLength) {
      violations.push({
        rule: 'Content Too Short',
        severity: 'warning',
        message: `Content should be at least ${rules.content.minLength} characters`,
        field: 'content',
      });
    }

    // Check for self-promotion
    if (community.promotionAllowed === 'no') {
      const promotionKeywords = [
        'onlyfans',
        'fansly',
        'patreon',
        'subscribe',
        'link in bio',
        'dm me',
        'check my profile',
      ];
      const lowerContent = content.toLowerCase();
      const foundPromotion = promotionKeywords.filter((keyword) =>
        lowerContent.includes(keyword)
      );

      if (foundPromotion.length > 0) {
        violations.push({
          rule: 'No Self-Promotion',
          severity: 'error',
          message: 'This subreddit does not allow self-promotion',
          field: 'content',
        });
      }
    } else if (community.promotionAllowed === 'limited') {
      violations.push({
        rule: 'Limited Promotion',
        severity: 'warning',
        message: 'Self-promotion is limited in this subreddit - be subtle',
        field: 'content',
      });
    }
  }

  /**
   * Get personalized warnings based on user's removal history
   */
  private async getPersonalizedWarnings(
    userId: number,
    subreddit: string
  ): Promise<string[]> {
    try {
      const warnings: string[] = [];

      // Get user's removal history for this subreddit
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const removals = await db
        .select({
          removalReason: redditPostOutcomes.removalReason,
          removalType: redditPostOutcomes.removalType,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            eq(redditPostOutcomes.subreddit, subreddit.toLowerCase()),
            isNotNull(redditPostOutcomes.removalType),
            gte(redditPostOutcomes.occurredAt, thirtyDaysAgo)
          )
        )
        .limit(5);

      if (removals.length === 0) {
        return warnings;
      }

      // Warn about recent removals
      warnings.push(
        `⚠️ You've had ${removals.length} post(s) removed from r/${subreddit} in the last 30 days`
      );

      // Analyze common removal reasons
      const reasonCounts = new Map<string, number>();
      removals.forEach((r) => {
        if (r.removalReason) {
          const count = reasonCounts.get(r.removalReason) || 0;
          reasonCounts.set(r.removalReason, count + 1);
        }
      });

      // Add specific warnings for common reasons
      reasonCounts.forEach((count, reason) => {
        if (count >= 2) {
          warnings.push(
            `⚠️ Common removal reason: "${reason}" - review this rule carefully`
          );
        }
      });

      return warnings;
    } catch (error) {
      logger.warn('Failed to get personalized warnings', { error });
      return [];
    }
  }

  /**
   * Generate recommendations based on violations
   */
  private generateRecommendations(
    violations: Violation[],
    community: typeof redditCommunities.$inferSelect
  ): string[] {
    const recommendations: string[] = [];

    // Title recommendations
    const titleViolations = violations.filter((v) => v.field === 'title');
    if (titleViolations.length > 0) {
      recommendations.push('Review title formatting rules before posting');
    }

    // Promotion recommendations
    if (community.promotionAllowed === 'no') {
      recommendations.push(
        'Remove all promotional content and links from your post'
      );
    } else if (community.promotionAllowed === 'limited') {
      recommendations.push(
        'Keep promotional content subtle and follow the 10:1 rule (10 regular posts per 1 promotional)'
      );
    }

    // Verification recommendations
    if (community.verificationRequired) {
      recommendations.push(
        'Complete the verification process before posting to avoid removal'
      );
    }

    // Flair recommendations
    if (community.flairRequired) {
      recommendations.push('Select an appropriate post flair before submitting');
    }

    // General recommendations
    if (violations.length === 0) {
      recommendations.push('Your post looks good! Review once more before posting.');
    }

    return recommendations;
  }

  /**
   * Quick validation check (returns boolean only)
   */
  async quickValidate(
    userId: number,
    subreddit: string,
    title: string
  ): Promise<boolean> {
    const result = await this.validatePost(userId, subreddit, title);
    return result.isValid;
  }
}

// Export singleton instance
export const ruleValidatorService = new RuleValidatorService();
