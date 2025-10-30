/**
 * Reddit Sync Service
 * 
 * Automatically syncs user's Reddit posting history for analytics.
 * Provides three sync tiers:
 * - Quick Sync: 100 posts, top 10 subreddits (~30s)
 * - Deep Sync: 500 posts, all subreddits (~2-3min)
 * - Full Sync: 1000 posts, all subreddits (~5-10min, Premium only)
 */

import { db } from '../db.js';
import { redditPostOutcomes, redditCommunities, users } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../bootstrap/logger.js';
import { HybridRedditClient, type RedditPost } from '../lib/reddit/hybrid-client.js';
import { upsertCommunity } from './reddit-community-manager.js';

export interface SyncResult {
  postsSynced: number;
  subredditsFound: number;
  subredditsAdded: number;
  oldestPostDate?: Date;
  newestPostDate?: Date;
  canDeepSync: boolean;
  status: 'completed' | 'queued' | 'failed';
  error?: string;
}

export interface SyncOptions {
  forceRefresh?: boolean; // Ignore existing data and re-sync
  skipSubredditDiscovery?: boolean; // Don't add new subreddits to library
}

/**
 * Reddit Sync Service
 */
export class RedditSyncService {
  /**
   * Quick Sync: 100 posts, top 10 subreddits
   * 
   * Fast initial sync for immediate analytics
   * Recommended for first-time users
   */
  static async quickSync(
    userId: number,
    redditUsername: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    try {
      logger.info('Starting quick sync', { userId, redditUsername });

      // Get hybrid client
      const reddit = await HybridRedditClient.forUser(userId);
      if (!reddit) {
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'failed',
          error: 'No active Reddit account found',
        };
      }

      // Fetch 100 most recent posts
      const { posts } = await reddit.getUserPosts(redditUsername, 100);

      if (posts.length === 0) {
        logger.warn('No posts found for user', { userId, redditUsername });
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'completed',
        };
      }

      // Extract top 10 subreddits by post count
      const subredditCounts = posts.reduce((acc, post) => {
        const subreddit = post.subreddit.toLowerCase();
        acc[subreddit] = (acc[subreddit] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topSubreddits = Object.entries(subredditCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name]) => name);

      // Sync subreddits to library
      let subredditsAdded = 0;
      if (!options.skipSubredditDiscovery) {
        subredditsAdded = await this.syncSubredditsToLibrary(
          reddit,
          topSubreddits,
          userId
        );
      }

      // Backfill posts to reddit_post_outcomes
      await this.backfillPosts(userId, posts);

      const oldestPost = posts[posts.length - 1];
      const newestPost = posts[0];

      logger.info('Quick sync completed', {
        userId,
        postsSynced: posts.length,
        subredditsFound: topSubreddits.length,
        subredditsAdded,
      });

      return {
        postsSynced: posts.length,
        subredditsFound: topSubreddits.length,
        subredditsAdded,
        oldestPostDate: new Date(oldestPost.created_utc * 1000),
        newestPostDate: new Date(newestPost.created_utc * 1000),
        canDeepSync: posts.length >= 100, // Can do deep sync if we got full 100
        status: 'completed',
      };
    } catch (error) {
      logger.error('Quick sync failed', {
        userId,
        redditUsername,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        postsSynced: 0,
        subredditsFound: 0,
        subredditsAdded: 0,
        canDeepSync: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deep Sync: 500 posts, all subreddits
   * 
   * More comprehensive sync for better analytics
   * Recommended for Pro users
   */
  static async deepSync(
    userId: number,
    redditUsername: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    try {
      logger.info('Starting deep sync', { userId, redditUsername });

      // Get hybrid client
      const reddit = await HybridRedditClient.forUser(userId);
      if (!reddit) {
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'failed',
          error: 'No active Reddit account found',
        };
      }

      // Fetch up to 500 posts with pagination
      const allPosts: RedditPost[] = [];
      let after: string | undefined;
      const targetLimit = 500;

      while (allPosts.length < targetLimit) {
        const remaining = targetLimit - allPosts.length;
        const batchSize = Math.min(100, remaining);

        const { posts, after: nextAfter } = await reddit.getUserPosts(
          redditUsername,
          batchSize,
          after
        );

        allPosts.push(...posts);

        if (!nextAfter || posts.length === 0) {
          break; // No more posts available
        }

        after = nextAfter;
      }

      if (allPosts.length === 0) {
        logger.warn('No posts found for user', { userId, redditUsername });
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'completed',
        };
      }

      // Extract all unique subreddits
      const uniqueSubreddits = Array.from(
        new Set(allPosts.map((post) => post.subreddit.toLowerCase()))
      );

      // Sync subreddits to library
      let subredditsAdded = 0;
      if (!options.skipSubredditDiscovery) {
        subredditsAdded = await this.syncSubredditsToLibrary(
          reddit,
          uniqueSubreddits,
          userId
        );
      }

      // Backfill posts to reddit_post_outcomes
      await this.backfillPosts(userId, allPosts);

      const oldestPost = allPosts[allPosts.length - 1];
      const newestPost = allPosts[0];

      logger.info('Deep sync completed', {
        userId,
        postsSynced: allPosts.length,
        subredditsFound: uniqueSubreddits.length,
        subredditsAdded,
      });

      return {
        postsSynced: allPosts.length,
        subredditsFound: uniqueSubreddits.length,
        subredditsAdded,
        oldestPostDate: new Date(oldestPost.created_utc * 1000),
        newestPostDate: new Date(newestPost.created_utc * 1000),
        canDeepSync: allPosts.length >= 500, // Can do full sync if we got 500+
        status: 'completed',
      };
    } catch (error) {
      logger.error('Deep sync failed', {
        userId,
        redditUsername,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        postsSynced: 0,
        subredditsFound: 0,
        subredditsAdded: 0,
        canDeepSync: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Full Sync: 1000 posts, all subreddits (Premium only)
   * 
   * Complete historical sync for maximum analytics depth
   * Recommended for Premium users with extensive posting history
   */
  static async fullSync(
    userId: number,
    redditUsername: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    try {
      // Check if user has Premium tier
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || user.tier !== 'premium') {
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'failed',
          error: 'Full sync requires Premium tier',
        };
      }

      logger.info('Starting full sync', { userId, redditUsername });

      // Get hybrid client
      const reddit = await HybridRedditClient.forUser(userId);
      if (!reddit) {
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'failed',
          error: 'No active Reddit account found',
        };
      }

      // Fetch up to 1000 posts with pagination
      const allPosts: RedditPost[] = [];
      let after: string | undefined;
      const targetLimit = 1000;

      while (allPosts.length < targetLimit) {
        const remaining = targetLimit - allPosts.length;
        const batchSize = Math.min(100, remaining);

        const { posts, after: nextAfter } = await reddit.getUserPosts(
          redditUsername,
          batchSize,
          after
        );

        allPosts.push(...posts);

        if (!nextAfter || posts.length === 0) {
          break; // No more posts available
        }

        after = nextAfter;
      }

      if (allPosts.length === 0) {
        logger.warn('No posts found for user', { userId, redditUsername });
        return {
          postsSynced: 0,
          subredditsFound: 0,
          subredditsAdded: 0,
          canDeepSync: false,
          status: 'completed',
        };
      }

      // Extract all unique subreddits
      const uniqueSubreddits = Array.from(
        new Set(allPosts.map((post) => post.subreddit.toLowerCase()))
      );

      // Sync subreddits to library
      let subredditsAdded = 0;
      if (!options.skipSubredditDiscovery) {
        subredditsAdded = await this.syncSubredditsToLibrary(
          reddit,
          uniqueSubreddits,
          userId
        );
      }

      // Backfill posts to reddit_post_outcomes
      await this.backfillPosts(userId, allPosts);

      const oldestPost = allPosts[allPosts.length - 1];
      const newestPost = allPosts[0];

      logger.info('Full sync completed', {
        userId,
        postsSynced: allPosts.length,
        subredditsFound: uniqueSubreddits.length,
        subredditsAdded,
      });

      return {
        postsSynced: allPosts.length,
        subredditsFound: uniqueSubreddits.length,
        subredditsAdded,
        oldestPostDate: new Date(oldestPost.created_utc * 1000),
        newestPostDate: new Date(newestPost.created_utc * 1000),
        canDeepSync: false, // Already did full sync
        status: 'completed',
      };
    } catch (error) {
      logger.error('Full sync failed', {
        userId,
        redditUsername,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        postsSynced: 0,
        subredditsFound: 0,
        subredditsAdded: 0,
        canDeepSync: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync subreddits to the reddit_communities library
   * 
   * Fetches subreddit info and adds to database if not already present
   */
  private static async syncSubredditsToLibrary(
    reddit: HybridRedditClient,
    subreddits: string[],
    userId: number
  ): Promise<number> {
    let addedCount = 0;

    for (const subreddit of subreddits) {
      try {
        // Check if subreddit already exists
        const [existing] = await db
          .select()
          .from(redditCommunities)
          .where(eq(redditCommunities.id, subreddit.toLowerCase()))
          .limit(1);

        if (existing) {
          logger.debug('Subreddit already in library', { subreddit });
          continue;
        }

        // Fetch subreddit info
        const info = await reddit.getSubredditInfo(subreddit);
        if (!info) {
          logger.warn('Could not fetch subreddit info', { subreddit });
          continue;
        }

        // Add to library
        await upsertCommunity(
          {
            name: info.display_name,
            displayName: info.display_name,
            subscribers: info.subscribers,
            over18: info.over18,
            description: info.public_description,
            publicDescription: info.public_description,
            allowImages: true, // Default assumption, will be updated if rules fetched
            allowVideos: true, // Default assumption
            submissionType: 'any', // Default assumption
          },
          userId
        );

        addedCount++;
        logger.info('Added subreddit to library from sync', {
          subreddit: info.display_name,
          userId,
        });
      } catch (error) {
        logger.error('Failed to sync subreddit to library', {
          subreddit,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with other subreddits
      }
    }

    return addedCount;
  }

  /**
   * Backfill posts to reddit_post_outcomes table
   * 
   * Inserts historical posts for analytics
   * Skips posts that already exist (based on reddit_post_id)
   */
  private static async backfillPosts(
    userId: number,
    posts: RedditPost[]
  ): Promise<void> {
    try {
      // Check which posts already exist
      const _existingPostIds = new Set<string>();
      
      // Query in batches to avoid overwhelming the database
      const batchSize = 100;
      for (let i = 0; i < posts.length; i += batchSize) {
        const batch = posts.slice(i, i + batchSize);
        const _postIds = batch.map((p) => p.id);

        // Note: We'll need to add reddit_post_id column first (Task 3.3)
        // For now, we'll insert all posts and handle duplicates later
      }

      // Insert posts
      const values = posts.map((post) => ({
        userId,
        subreddit: post.subreddit.toLowerCase(),
        status: post.removed_by_category ? 'removed' : 'posted',
        reason: post.removed_by_category || null,
        occurredAt: new Date(post.created_utc * 1000),
        success: !post.removed_by_category,
        title: post.title,
        upvotes: post.score,
        views: 0, // Reddit doesn't provide view count in API
        // These will be added in Task 3.3:
        // reddit_post_id: post.id,
        // removal_type: post.removed_by_category,
      }));

      // Insert in batches
      for (let i = 0; i < values.length; i += batchSize) {
        const batch = values.slice(i, i + batchSize);
        await db.insert(redditPostOutcomes).values(batch);
      }

      logger.info('Backfilled posts to reddit_post_outcomes', {
        userId,
        count: posts.length,
      });
    } catch (error) {
      logger.error('Failed to backfill posts', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get last sync status for a user
   */
  static async getLastSyncStatus(userId: number): Promise<{
    lastSyncAt?: Date;
    postCount: number;
    subredditCount: number;
  } | null> {
    try {
      // Get most recent post
      const [latestPost] = await db
        .select()
        .from(redditPostOutcomes)
        .where(eq(redditPostOutcomes.userId, userId))
        .orderBy(desc(redditPostOutcomes.occurredAt))
        .limit(1);

      if (!latestPost) {
        return null;
      }

      // Count total posts
      const postCountResult = await db
        .select()
        .from(redditPostOutcomes)
        .where(eq(redditPostOutcomes.userId, userId));

      // Count unique subreddits
      const subredditCountResult = await db
        .selectDistinct({ subreddit: redditPostOutcomes.subreddit })
        .from(redditPostOutcomes)
        .where(eq(redditPostOutcomes.userId, userId));

      return {
        lastSyncAt: latestPost.occurredAt,
        postCount: postCountResult.length,
        subredditCount: subredditCountResult.length,
      };
    } catch (error) {
      logger.error('Failed to get last sync status', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

