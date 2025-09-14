/**
 * Phase 5: Advanced Safety Systems
 * Rate limiting, duplicate detection, and content safety
 */

import { db } from '../db';
import { postRateLimits, postDuplicates, users } from '@shared/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';
import { env } from './config';
import { createHash } from 'crypto';

export interface RateLimitCheck {
  canPost: boolean;
  reason?: string;
  postsInWindow: number;
  windowResetTime: Date;
  nextAvailableTime?: Date;
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  reason?: string;
  lastPostedAt?: Date;
  subreddit?: string;
}

export interface SafetyCheckResult {
  canPost: boolean;
  issues: string[];
  warnings: string[];
  rateLimit: RateLimitCheck;
  duplicateCheck: DuplicateCheck;
}

export class SafetyManager {
  /**
   * Comprehensive safety check before posting
   */
  static async performSafetyCheck(
    userId: string,
    subreddit: string,
    title: string,
    body: string
  ): Promise<SafetyCheckResult> {
    const [rateLimitCheck, duplicateCheck] = await Promise.all([
      this.checkRateLimit(userId, subreddit),
      this.checkDuplicate(userId, subreddit, title, body),
    ]);

    const issues: string[] = [];
    const warnings: string[] = [];

    // Collect blocking issues
    if (!rateLimitCheck.canPost) {
      issues.push(rateLimitCheck.reason || 'Rate limit exceeded');
    }

    if (duplicateCheck.isDuplicate) {
      issues.push(duplicateCheck.reason || 'Duplicate content detected');
    }

    // Add warnings for potential issues
    if (rateLimitCheck.postsInWindow >= env.MAX_POSTS_PER_SUBREDDIT_24H - 1) {
      warnings.push('Approaching rate limit for this subreddit');
    }

    return {
      canPost: issues.length === 0,
      issues,
      warnings,
      rateLimit: rateLimitCheck,
      duplicateCheck,
    };
  }

  /**
   * Check rate limiting for user posting to a subreddit
   */
  static async checkRateLimit(userId: string, subreddit: string): Promise<RateLimitCheck> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    const windowResetTime = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

    // Get current rate limit record
    const [currentLimit] = await db
      .select()
      .from(postRateLimits)
      .where(
        and(
          eq(postRateLimits.userId, parseInt(userId)),
          eq(postRateLimits.subreddit, subreddit),
          gte(postRateLimits.lastPostAt, windowStart)
        )
      )
      .orderBy(sql`${postRateLimits.lastPostAt} DESC`)
      .limit(1);

    const postsInWindow = currentLimit?.postCount24h || 0;
    const maxPosts = env.MAX_POSTS_PER_SUBREDDIT_24H;

    if (postsInWindow >= maxPosts) {
      const nextAvailableTime = new Date(
        (currentLimit?.lastPostAt?.getTime() || now.getTime()) + 24 * 60 * 60 * 1000
      );

      return {
        canPost: false,
        reason: `Rate limit exceeded: ${postsInWindow}/${maxPosts} posts in 24h window`,
        postsInWindow,
        windowResetTime,
        nextAvailableTime,
      };
    }

    return {
      canPost: true,
      postsInWindow,
      windowResetTime,
    };
  }

  /**
   * Record a post for rate limiting
   */
  static async recordPost(userId: string, subreddit: string): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Try to update existing record
    const updated = await db
      .update(postRateLimits)
      .set({
        postCount24h: sql`${postRateLimits.postCount24h} + 1`,
        lastPostAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(postRateLimits.userId, parseInt(userId)),
          eq(postRateLimits.subreddit, subreddit),
          gte(postRateLimits.lastPostAt, windowStart)
        )
      );

    // If no existing record, create new one
    if (!updated) {
      await db.insert(postRateLimits).values({
        userId: parseInt(userId),
        subreddit,
        postCount24h: 1,
        lastPostAt: now,
      });
    }
  }

  /**
   * Check for duplicate content
   */
  static async checkDuplicate(
    userId: string,
    subreddit: string,
    title: string,
    body: string
  ): Promise<DuplicateCheck> {
    const contentHash = this.generateContentHash(title, body);

    // Check for recent duplicates (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [duplicate] = await db
      .select()
      .from(postDuplicates)
      .where(
        and(
          eq(postDuplicates.userId, parseInt(userId)),
          eq(postDuplicates.contentHash, contentHash),
          gte(postDuplicates.createdAt, thirtyDaysAgo)
        )
      )
      .orderBy(sql`${postDuplicates.createdAt} DESC`)
      .limit(1);

    if (duplicate) {
      // Check if it's the same subreddit (more strict) or different (warning)
      const isSameSubreddit = duplicate.subreddit === subreddit;
      
      if (isSameSubreddit) {
        return {
          isDuplicate: true,
          reason: `Identical content posted to r/${subreddit} on ${duplicate.createdAt?.toLocaleDateString()}`,
          lastPostedAt: duplicate.createdAt || undefined,
          subreddit: duplicate.subreddit,
        };
      } else {
        // Different subreddit - allow but warn
        return {
          isDuplicate: false,
          reason: `Similar content previously posted to r/${duplicate.subreddit}`,
          lastPostedAt: duplicate.createdAt || undefined,
          subreddit: duplicate.subreddit,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Record post for duplicate detection
   */
  static async recordPostForDuplicateDetection(
    userId: string,
    subreddit: string,
    title: string,
    body: string
  ): Promise<void> {
    const contentHash = this.generateContentHash(title, body);

    await db.insert(postDuplicates).values({
      userId: parseInt(userId),
      contentHash,
      subreddit,
      title,
      body: body || '',
    });
  }

  /**
   * Clean up old rate limit and duplicate records
   */
  static async cleanupOldRecords(): Promise<{ rateLimitsDeleted: number; duplicatesDeleted: number }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Clean up old rate limits (keep 7 days)
    const rateLimitsDeleted = await db
      .delete(postRateLimits)
      .where(sql`${postRateLimits.lastPostAt} < ${sevenDaysAgo}`)
      .returning();

    // Clean up old duplicates (keep 30 days)
    const duplicatesDeleted = await db
      .delete(postDuplicates)
      .where(sql`${postDuplicates.createdAt} < ${thirtyDaysAgo}`)
      .returning();

    return {
      rateLimitsDeleted: rateLimitsDeleted?.length || 0,
      duplicatesDeleted: duplicatesDeleted?.length || 0,
    };
  }

  /**
   * Get user's posting history for analysis
   */
  static async getUserPostingStats(userId: string): Promise<{
    totalPosts: number;
    postsLast24h: number;
    postsLast7d: number;
    topSubreddits: Array<{ subreddit: string; count: number }>;
    avgPostsPerDay: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get total posts
    const [totalPosts] = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(postDuplicates)
      .where(eq(postDuplicates.userId, parseInt(userId)));

    // Get posts in last 24h
    const [postsLast24h] = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(postDuplicates)
      .where(
        and(
          eq(postDuplicates.userId, parseInt(userId)),
          gte(postDuplicates.createdAt, oneDayAgo)
        )
      );

    // Get posts in last 7d
    const [postsLast7d] = await db
      .select({
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(postDuplicates)
      .where(
        and(
          eq(postDuplicates.userId, parseInt(userId)),
          gte(postDuplicates.createdAt, sevenDaysAgo)
        )
      );

    // Get top subreddits
    const topSubreddits = await db
      .select({
        subreddit: postDuplicates.subreddit,
        count: sql<number>`COUNT(*)`.as('count'),
      })
      .from(postDuplicates)
      .where(eq(postDuplicates.userId, parseInt(userId)))
      .groupBy(postDuplicates.subreddit)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(5);

    const total = Number(totalPosts?.count || 0);
    const avgPostsPerDay = total > 0 ? total / 30 : 0; // Average over 30 days

    return {
      totalPosts: total,
      postsLast24h: Number(postsLast24h?.count || 0),
      postsLast7d: Number(postsLast7d?.count || 0),
      topSubreddits: topSubreddits.map(s => ({
        subreddit: s.subreddit,
        count: Number(s.count),
      })),
      avgPostsPerDay,
    };
  }

  /**
   * Generate content hash for duplicate detection
   */
  private static generateContentHash(title: string, body: string): string {
    // Normalize content for consistent hashing
    const normalizedContent = (title + '\n' + body)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    return createHash('sha256')
      .update(normalizedContent, 'utf8')
      .digest('hex');
  }

  /**
   * Check if user has any safety violations
   */
  static async getUserSafetyStatus(userId: string): Promise<{
    isInGoodStanding: boolean;
    violations: string[];
    restrictions: string[];
  }> {
    // In a full implementation, this would check:
    // - Recent failed posts
    // - Community reports
    // - Rate limit violations
    // - Account age and verification status

    const violations: string[] = [];
    const restrictions: string[] = [];

    // Simple check for now
    const stats = await this.getUserPostingStats(userId);
    
    if (stats.postsLast24h > env.MAX_POSTS_PER_SUBREDDIT_24H * 3) {
      violations.push('Excessive posting detected');
      restrictions.push('Reduced posting frequency');
    }

    return {
      isInGoodStanding: violations.length === 0,
      violations,
      restrictions,
    };
  }
}