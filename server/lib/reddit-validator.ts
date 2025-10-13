/**
 * Reddit Post Validator
 * Validates posts before submission to prevent failures and shadow bans
 */

import { logger } from '../bootstrap/logger.js';
import { db } from '../database.js';
import { redditCommunities, redditPostOutcomes } from '@shared/schema';
import { and, eq, gte } from 'drizzle-orm';

// Extended interface for community with optional fields
interface ExtendedCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: string;
  verificationRequired: boolean;
  promotionAllowed: string;
  postingLimits: unknown;
  rules: unknown;
  bestPostingTimes: string[] | null;
  averageUpvotes: number | null;
  successProbability: number | null;
  growthTrend: string | null;
  modActivity: string | null;
  description: string | null;
  tags: string[] | null;
  competitionLevel: string | null;
  over18: boolean;
  subscribers: number;
  allowImages?: boolean;
  postFlairRequired?: boolean;
  postFlairs?: string[] | unknown;
  minAccountAge?: number;
  minKarma?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

interface PostData {
  subreddit: string;
  title: string;
  content?: string;
  imageUrl?: string;
  nsfw: boolean;
  flairText?: string;
}

export class RedditValidator {
  /**
   * Validate a post before submission
   */
  static async validatePost(post: PostData): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Title validation
    if (!post.title || post.title.trim().length === 0) {
      result.errors.push('Title is required');
      result.valid = false;
    } else if (post.title.length > 300) {
      result.errors.push('Title must be 300 characters or less');
      result.valid = false;
    } else if (post.title.length < 3) {
      result.errors.push('Title must be at least 3 characters');
      result.valid = false;
    }

    // Check for banned words in title
    const bannedTitleWords = ['selling', 'meetup', 'meet up', 'cashapp', 'venmo', 'paypal'];
    const titleLower = post.title.toLowerCase();
    for (const word of bannedTitleWords) {
      if (titleLower.includes(word)) {
        result.warnings.push(`Title contains potentially problematic word: "${word}"`);
      }
    }

    // Content validation
    if (post.content && post.content.length > 40000) {
      result.errors.push('Content must be 40,000 characters or less');
      result.valid = false;
    }

    // Image validation
    if (post.imageUrl) {
      if (!post.imageUrl.startsWith('https://i.imgur.com/')) {
        result.errors.push('Images must be hosted on Imgur');
        result.valid = false;
      }
    }

    // Subreddit-specific validation
    const subredditValidation = await this.validateSubredditRules(post);
    result.errors.push(...subredditValidation.errors);
    result.warnings.push(...subredditValidation.warnings);
    result.suggestions.push(...subredditValidation.suggestions);
    
    if (subredditValidation.errors.length > 0) {
      result.valid = false;
    }

    return result;
  }

  /**
   * Validate against specific subreddit rules
   */
  static async validateSubredditRules(post: PostData): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Get subreddit rules from database
      const [community] = await db
        .select()
        .from(redditCommunities)
        .where(eq(redditCommunities.name, post.subreddit))
        .limit(1);

      if (community) {
        const extCommunity = community as ExtendedCommunity;
        // Check NSFW requirements
        if (extCommunity.over18 && !post.nsfw) {
          result.errors.push(`r/${post.subreddit} requires posts to be marked NSFW`);
        }

        if (!extCommunity.over18 && post.nsfw) {
          result.warnings.push(`r/${post.subreddit} is not an NSFW subreddit`);
        }

        // Check if images are allowed
        if (!extCommunity.allowImages && post.imageUrl) {
          result.errors.push(`r/${post.subreddit} does not allow image posts`);
        }

        // Check flair requirements
        if (extCommunity.postFlairRequired && !post.flairText) {
          result.errors.push(`r/${post.subreddit} requires post flair`);
        }

        if (post.flairText && extCommunity.postFlairs) {
          const flairs = extCommunity.postFlairs;
          if (flairs && Array.isArray(flairs)) {
            if (!flairs.includes(post.flairText)) {
              result.errors.push(`Invalid flair: "${post.flairText}"`);
            }
            result.suggestions.push(`Available flairs: ${flairs.slice(0, 5).join(', ')}`);
          }
        }

        // Check title requirements
        const titleRules = extCommunity.rules;
        if (titleRules && typeof titleRules === 'object' && 'titleFormat' in titleRules) {
          const format = (titleRules as {titleFormat: unknown}).titleFormat;
          
          // Common title format checks
          if (typeof format === 'string') {
            if (format.includes('[F]') && !post.title.includes('[F]')) {
              result.warnings.push(`r/${post.subreddit} usually requires [F] tag in title`);
            }
            
            if (format.includes('[OC]') && !post.title.includes('[OC]')) {
              result.suggestions.push('Consider adding [OC] tag for original content');
            }
            
            if (format.includes('[verification]') && post.title.toLowerCase().includes('verif')) {
              result.suggestions.push('Use [verification] tag for verification posts');
            }
          }
        }

        // Minimum karma/age requirements
        if (extCommunity.minAccountAge || extCommunity.minKarma) {
          result.warnings.push(`r/${post.subreddit} has account requirements - ensure your account meets them`);
        }
      } else {
        result.warnings.push(`No cached rules for r/${post.subreddit} - post at your own risk`);
      }

    } catch (error) {
      logger.error('Failed to validate subreddit rules', { error, subreddit: post.subreddit });
      result.warnings.push('Could not validate subreddit rules');
    }

    return result;
  }

  /**
   * Check if user is shadow banned
   */
  static async checkShadowBan(username: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.reddit.com/user/${username}/about.json`);
      
      if (response.status === 404) {
        // User page not found - likely shadow banned
        return true;
      }
      
      const data = await response.json();
      
      // Additional checks
      if (data.data?.is_suspended) {
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to check shadow ban status', { error, username });
      return false;
    }
  }

  /**
   * Validate posting rate limits
   */
  static async validateRateLimits(userId: string, subreddit: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    try {
      // Check recent posts to this subreddit
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentPosts = await db
        .select()
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, Number(userId)),
            eq(redditPostOutcomes.subreddit, subreddit),
            gte(redditPostOutcomes.occurredAt, oneDayAgo)
          )
        );

      // Most subreddits have a limit of 1-5 posts per day
      if (recentPosts.length >= 5) {
        result.errors.push(`You've reached the daily post limit for r/${subreddit}`);
        result.valid = false;
      } else if (recentPosts.length >= 3) {
        result.warnings.push(`You're approaching the daily post limit for r/${subreddit}`);
      }

      // Check if last post was too recent (spam prevention)
      if (recentPosts.length > 0) {
        const lastPost = recentPosts[recentPosts.length - 1];
        const minutesSinceLastPost = (Date.now() - lastPost.occurredAt.getTime()) / 60000;
        
        if (minutesSinceLastPost < 10) {
          result.errors.push('Please wait at least 10 minutes between posts to the same subreddit');
          result.valid = false;
        } else if (minutesSinceLastPost < 30) {
          result.warnings.push('Posting too frequently may trigger spam filters');
        }
      }

    } catch (error) {
      logger.error('Failed to validate rate limits', { error });
      result.warnings.push('Could not validate posting rate limits');
    }

    return result;
  }

  /**
   * Perform all validations
   */
  static async validateAll(post: PostData, userId: string): Promise<ValidationResult> {
    const results: ValidationResult[] = [];

    // Run all validations in parallel
    const [basicValidation, rateLimitValidation] = await Promise.all([
      this.validatePost(post),
      this.validateRateLimits(userId, post.subreddit)
    ]);

    results.push(basicValidation, rateLimitValidation);

    // Combine results
    const combined: ValidationResult = {
      valid: results.every(r => r.valid),
      errors: results.flatMap(r => r.errors),
      warnings: results.flatMap(r => r.warnings),
      suggestions: results.flatMap(r => r.suggestions)
    };

    // Add risk score
    const riskScore = this.calculateRiskScore(combined);
    if (riskScore > 70) {
      combined.warnings.push(`High risk score (${riskScore}/100) - This post may be rejected`);
    }

    return combined;
  }

  /**
   * Calculate risk score for a post
   */
  private static calculateRiskScore(validation: ValidationResult): number {
    let score = 0;
    
    // Each error adds 30 points
    score += validation.errors.length * 30;
    
    // Each warning adds 10 points
    score += validation.warnings.length * 10;
    
    // Cap at 100
    return Math.min(score, 100);
  }
}
