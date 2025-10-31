/**
 * Comment Engagement Service (MISSING-1)
 * 
 * Tracks comment engagement on user's posts
 * Provides insights into conversation quality and response opportunities
 */

import { db } from '../db.js';
import { redditPostOutcomes } from '@shared/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { HybridRedditClient } from '../lib/reddit/hybrid-client.js';

export interface CommentEngagementMetrics {
  postId: number;
  redditPostId: string | null;
  subreddit: string;
  title: string;
  commentCount: number;
  avgCommentLength: number | null;
  userReplied: boolean;
  upvotes: number;
  commentToUpvoteRatio: number;
  engagementQuality: 'excellent' | 'good' | 'average' | 'low';
  needsResponse: boolean;
  occurredAt: Date;
}

export interface CommentEngagementStats {
  totalComments: number;
  avgCommentsPerPost: number;
  avgCommentToUpvoteRatio: number;
  responseRate: number; // Percentage of posts where user replied
  postsNeedingResponse: CommentEngagementMetrics[];
  topEngagingPosts: CommentEngagementMetrics[];
  engagementTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export class CommentEngagementService {
  /**
   * Get comment engagement metrics for user's posts
   */
  async getEngagementMetrics(
    userId: number,
    daysBack: number = 30,
    limit: number = 50
  ): Promise<CommentEngagementMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const posts = await db
        .select({
          id: redditPostOutcomes.id,
          redditPostId: redditPostOutcomes.redditPostId,
          subreddit: redditPostOutcomes.subreddit,
          title: redditPostOutcomes.title,
          commentCount: redditPostOutcomes.commentCount,
          avgCommentLength: redditPostOutcomes.avgCommentLength,
          userReplied: redditPostOutcomes.userReplied,
          upvotes: redditPostOutcomes.upvotes,
          occurredAt: redditPostOutcomes.occurredAt,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        )
        .orderBy(desc(redditPostOutcomes.occurredAt))
        .limit(limit);

      return posts.map((post) => {
        const commentCount = post.commentCount || 0;
        const upvotes = post.upvotes || 0;
        const commentToUpvoteRatio =
          upvotes > 0 ? (commentCount / upvotes) * 100 : 0;

        // Determine engagement quality
        let engagementQuality: 'excellent' | 'good' | 'average' | 'low' = 'low';
        if (commentToUpvoteRatio >= 15) {
          engagementQuality = 'excellent';
        } else if (commentToUpvoteRatio >= 10) {
          engagementQuality = 'good';
        } else if (commentToUpvoteRatio >= 5) {
          engagementQuality = 'average';
        }

        // Check if needs response (has comments but user hasn't replied)
        const needsResponse = commentCount > 0 && !post.userReplied;

        return {
          postId: post.id,
          redditPostId: post.redditPostId,
          subreddit: post.subreddit,
          title: post.title || 'Untitled',
          commentCount,
          avgCommentLength: post.avgCommentLength,
          userReplied: post.userReplied || false,
          upvotes,
          commentToUpvoteRatio: Math.round(commentToUpvoteRatio * 10) / 10,
          engagementQuality,
          needsResponse,
          occurredAt: post.occurredAt,
        };
      });
    } catch (error) {
      logger.error('Failed to get comment engagement metrics', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Get comprehensive comment engagement statistics
   */
  async getEngagementStats(
    userId: number,
    daysBack: number = 30
  ): Promise<CommentEngagementStats> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get aggregate stats
      const stats = await db
        .select({
          totalPosts: sql<number>`COUNT(*)::int`,
          totalComments: sql<number>`COALESCE(SUM(${redditPostOutcomes.commentCount}), 0)::int`,
          totalUpvotes: sql<number>`COALESCE(SUM(${redditPostOutcomes.upvotes}), 0)::int`,
          postsWithReplies: sql<number>`COUNT(CASE WHEN ${redditPostOutcomes.userReplied} = true THEN 1 END)::int`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate)
          )
        );

      const {
        totalPosts,
        totalComments,
        totalUpvotes,
        postsWithReplies,
      } = stats[0] || {
        totalPosts: 0,
        totalComments: 0,
        totalUpvotes: 0,
        postsWithReplies: 0,
      };

      const avgCommentsPerPost =
        totalPosts > 0 ? Math.round((totalComments / totalPosts) * 10) / 10 : 0;
      const avgCommentToUpvoteRatio =
        totalUpvotes > 0
          ? Math.round((totalComments / totalUpvotes) * 100 * 10) / 10
          : 0;
      const responseRate =
        totalPosts > 0
          ? Math.round((postsWithReplies / totalPosts) * 100 * 10) / 10
          : 0;

      // Get posts needing response
      const postsNeedingResponse = await this.getPostsNeedingResponse(
        userId,
        daysBack
      );

      // Get top engaging posts
      const topEngagingPosts = await this.getTopEngagingPosts(userId, daysBack);

      // Calculate trend
      const engagementTrend = await this.calculateEngagementTrend(
        userId,
        daysBack
      );

      return {
        totalComments,
        avgCommentsPerPost,
        avgCommentToUpvoteRatio,
        responseRate,
        postsNeedingResponse,
        topEngagingPosts,
        engagementTrend,
      };
    } catch (error) {
      logger.error('Failed to get comment engagement stats', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });

      return {
        totalComments: 0,
        avgCommentsPerPost: 0,
        avgCommentToUpvoteRatio: 0,
        responseRate: 0,
        postsNeedingResponse: [],
        topEngagingPosts: [],
        engagementTrend: 'unknown',
      };
    }
  }

  /**
   * Get posts that need user response
   */
  private async getPostsNeedingResponse(
    userId: number,
    daysBack: number
  ): Promise<CommentEngagementMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const posts = await db
        .select({
          id: redditPostOutcomes.id,
          redditPostId: redditPostOutcomes.redditPostId,
          subreddit: redditPostOutcomes.subreddit,
          title: redditPostOutcomes.title,
          commentCount: redditPostOutcomes.commentCount,
          avgCommentLength: redditPostOutcomes.avgCommentLength,
          userReplied: redditPostOutcomes.userReplied,
          upvotes: redditPostOutcomes.upvotes,
          occurredAt: redditPostOutcomes.occurredAt,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate),
            sql`${redditPostOutcomes.commentCount} > 0`,
            eq(redditPostOutcomes.userReplied, false)
          )
        )
        .orderBy(desc(redditPostOutcomes.commentCount))
        .limit(10);

      return posts.map((post) => ({
        postId: post.id,
        redditPostId: post.redditPostId,
        subreddit: post.subreddit,
        title: post.title || 'Untitled',
        commentCount: post.commentCount || 0,
        avgCommentLength: post.avgCommentLength,
        userReplied: false,
        upvotes: post.upvotes || 0,
        commentToUpvoteRatio:
          post.upvotes && post.upvotes > 0
            ? Math.round(((post.commentCount || 0) / post.upvotes) * 100 * 10) / 10
            : 0,
        engagementQuality: 'average',
        needsResponse: true,
        occurredAt: post.occurredAt,
      }));
    } catch (error) {
      logger.warn('Failed to get posts needing response', { error });
      return [];
    }
  }

  /**
   * Get top engaging posts (highest comment-to-upvote ratio)
   */
  private async getTopEngagingPosts(
    userId: number,
    daysBack: number
  ): Promise<CommentEngagementMetrics[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const posts = await db
        .select({
          id: redditPostOutcomes.id,
          redditPostId: redditPostOutcomes.redditPostId,
          subreddit: redditPostOutcomes.subreddit,
          title: redditPostOutcomes.title,
          commentCount: redditPostOutcomes.commentCount,
          avgCommentLength: redditPostOutcomes.avgCommentLength,
          userReplied: redditPostOutcomes.userReplied,
          upvotes: redditPostOutcomes.upvotes,
          occurredAt: redditPostOutcomes.occurredAt,
          ratio: sql<number>`CASE WHEN ${redditPostOutcomes.upvotes} > 0 THEN (${redditPostOutcomes.commentCount}::float / ${redditPostOutcomes.upvotes}) * 100 ELSE 0 END`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, startDate),
            sql`${redditPostOutcomes.commentCount} > 0`
          )
        )
        .orderBy(desc(sql`CASE WHEN ${redditPostOutcomes.upvotes} > 0 THEN (${redditPostOutcomes.commentCount}::float / ${redditPostOutcomes.upvotes}) * 100 ELSE 0 END`))
        .limit(10);

      return posts.map((post) => {
        const commentToUpvoteRatio = post.ratio || 0;
        let engagementQuality: 'excellent' | 'good' | 'average' | 'low' = 'low';
        if (commentToUpvoteRatio >= 15) {
          engagementQuality = 'excellent';
        } else if (commentToUpvoteRatio >= 10) {
          engagementQuality = 'good';
        } else if (commentToUpvoteRatio >= 5) {
          engagementQuality = 'average';
        }

        return {
          postId: post.id,
          redditPostId: post.redditPostId,
          subreddit: post.subreddit,
          title: post.title || 'Untitled',
          commentCount: post.commentCount || 0,
          avgCommentLength: post.avgCommentLength,
          userReplied: post.userReplied || false,
          upvotes: post.upvotes || 0,
          commentToUpvoteRatio: Math.round(commentToUpvoteRatio * 10) / 10,
          engagementQuality,
          needsResponse: (post.commentCount || 0) > 0 && !post.userReplied,
          occurredAt: post.occurredAt,
        };
      });
    } catch (error) {
      logger.warn('Failed to get top engaging posts', { error });
      return [];
    }
  }

  /**
   * Calculate engagement trend
   */
  private async calculateEngagementTrend(
    userId: number,
    daysBack: number
  ): Promise<'improving' | 'stable' | 'declining' | 'unknown'> {
    try {
      const halfPeriod = Math.floor(daysBack / 2);

      // Recent period
      const recentStart = new Date();
      recentStart.setDate(recentStart.getDate() - halfPeriod);

      const recentStats = await db
        .select({
          avgRatio: sql<number>`AVG(CASE WHEN ${redditPostOutcomes.upvotes} > 0 THEN (${redditPostOutcomes.commentCount}::float / ${redditPostOutcomes.upvotes}) * 100 ELSE 0 END)`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, recentStart)
          )
        );

      // Previous period
      const previousStart = new Date();
      previousStart.setDate(previousStart.getDate() - daysBack);
      const previousEnd = new Date();
      previousEnd.setDate(previousEnd.getDate() - halfPeriod);

      const previousStats = await db
        .select({
          avgRatio: sql<number>`AVG(CASE WHEN ${redditPostOutcomes.upvotes} > 0 THEN (${redditPostOutcomes.commentCount}::float / ${redditPostOutcomes.upvotes}) * 100 ELSE 0 END)`,
        })
        .from(redditPostOutcomes)
        .where(
          and(
            eq(redditPostOutcomes.userId, userId),
            gte(redditPostOutcomes.occurredAt, previousStart),
            sql`${redditPostOutcomes.occurredAt} < ${previousEnd}`
          )
        );

      const recentRatio = recentStats[0]?.avgRatio || 0;
      const previousRatio = previousStats[0]?.avgRatio || 0;

      if (previousRatio === 0) return 'unknown';

      const change = ((recentRatio - previousRatio) / previousRatio) * 100;

      if (change > 10) return 'improving';
      if (change < -10) return 'declining';
      return 'stable';
    } catch (error) {
      logger.warn('Failed to calculate engagement trend', { error });
      return 'unknown';
    }
  }

  /**
   * Update comment data for a specific post
   */
  async updatePostComments(
    userId: number,
    redditPostId: string
  ): Promise<boolean> {
    try {
      const reddit = await HybridRedditClient.forUser(userId);
      if (!reddit) {
        logger.warn('No Reddit client available', { userId });
        return false;
      }

      // Fetch post with comments
      const post = await reddit.getPost(redditPostId);
      if (!post) {
        logger.warn('Post not found', { redditPostId });
        return false;
      }

      // Update database
      await db
        .update(redditPostOutcomes)
        .set({
          commentCount: post.num_comments || 0,
          // Note: avgCommentLength and userReplied would require fetching actual comments
          // which is more expensive - can be done in a separate worker if needed
        })
        .where(eq(redditPostOutcomes.redditPostId, redditPostId));

      logger.info('Updated post comment data', {
        redditPostId,
        commentCount: post.num_comments,
      });

      return true;
    } catch (error) {
      logger.error('Failed to update post comments', {
        error: error instanceof Error ? error.message : String(error),
        redditPostId,
      });
      return false;
    }
  }
}

// Export singleton instance
export const commentEngagementService = new CommentEngagementService();
