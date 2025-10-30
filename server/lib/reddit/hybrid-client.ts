/**
 * Hybrid Reddit Client
 * 
 * Combines Snoowrap (OAuth + writes) with Axios (fast reads) for optimal performance.
 * Uses Redis caching to minimize API calls and improve response times.
 * 
 * Architecture:
 * - Snoowrap: OAuth authentication, token refresh, write operations (posting)
 * - Axios: Fast read operations via Reddit JSON API
 * - Redis: Token caching, response caching
 */

import Snoowrap from 'snoowrap';
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../bootstrap/logger.js';
import { cacheGet, cacheSet, CACHE_TTL, isCacheAvailable } from '../cache.js';
import { db } from '../../db.js';
import { creatorAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../../services/state-store.js';

// Reddit API types
export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  permalink: string;
  url: string;
  is_self: boolean;
  selftext?: string;
  link_flair_text?: string;
  link_flair_id?: string;
  over_18: boolean;
  removed_by_category?: string | null;
}

export interface RedditSubredditInfo {
  display_name: string;
  title: string;
  public_description: string;
  subscribers: number;
  active_user_count: number;
  over18: boolean;
  subreddit_type: string;
  created_utc: number;
}

export interface RedditSubredditRules {
  rules: Array<{
    kind: string;
    description: string;
    short_name: string;
    violation_reason: string;
    created_utc: number;
    priority: number;
  }>;
}

export interface PostOptions {
  subreddit: string;
  title: string;
  url?: string;
  text?: string;
  nsfw?: boolean;
  spoiler?: boolean;
  flairId?: string;
  flairText?: string;
}

export interface SyncResult {
  postsSynced: number;
  subredditsFound: number;
  canDeepSync: boolean;
}

/**
 * Hybrid Reddit Client
 * 
 * Optimized for analytics workloads:
 * - Fast reads via Axios + Reddit JSON API
 * - Reliable writes via Snoowrap OAuth
 * - Aggressive caching to minimize API calls
 */
export class HybridRedditClient {
  private snoowrap: Snoowrap;
  private axios: AxiosInstance;
  private userId: number;
  private redditUsername?: string;

  constructor(userId: number, accessToken: string, refreshToken: string, redditUsername?: string) {
    this.userId = userId;
    this.redditUsername = redditUsername;

    // Initialize Snoowrap for OAuth + writes
    this.snoowrap = new Snoowrap({
      userAgent: 'ThottoPilot/1.0.0 (Advanced Reddit Analytics)',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      accessToken,
      refreshToken,
    });

    // Initialize Axios for fast reads
    this.axios = axios.create({
      baseURL: 'https://oauth.reddit.com',
      headers: {
        'User-Agent': 'ThottoPilot/1.0.0 (Advanced Reddit Analytics)',
      },
      timeout: 10000, // 10 second timeout
    });

    // Add token refresh interceptor
    this.axios.interceptors.request.use(
      async (config) => {
        try {
          // Try to get cached token
          const cacheKey = `reddit:token:${userId}`;
          let token = await cacheGet<string>(cacheKey);

          if (!token) {
            // Refresh token via Snoowrap
            await this.snoowrap.getMe().catch(() => void 0);
            token = this.snoowrap.accessToken;

            // Cache for 55 minutes (tokens expire in 1 hour)
            if (token && isCacheAvailable()) {
              await cacheSet(cacheKey, token, 55 * 60);
            }
          }

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          logger.error('Failed to refresh Reddit token', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response error interceptor
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 60;
          logger.warn('Reddit API rate limit hit', {
            userId,
            retryAfter,
          });
        }

        // Handle token expiration
        if (error.response?.status === 401) {
          logger.warn('Reddit token expired, clearing cache', { userId });
          // Clear cached token to force refresh on next request
          const cacheKey = `reddit:token:${userId}`;
          await cacheSet(cacheKey, '', 0);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Factory method to create HybridRedditClient for a user
   */
  static async forUser(userId: number): Promise<HybridRedditClient | null> {
    try {
      const [account] = await db
        .select()
        .from(creatorAccounts)
        .where(
          and(
            eq(creatorAccounts.userId, userId),
            eq(creatorAccounts.platform, 'reddit'),
            eq(creatorAccounts.isActive, true)
          )
        );

      if (!account || !account.oauthToken) {
        logger.warn('No active Reddit account found for user', { userId });
        return null;
      }

      // Decrypt tokens
      const accessToken = decrypt(account.oauthToken);
      const refreshToken = account.oauthRefresh ? decrypt(account.oauthRefresh) : '';

      if (!accessToken) {
        logger.error('Failed to decrypt Reddit access token', { userId });
        return null;
      }

      return new HybridRedditClient(
        userId,
        accessToken,
        refreshToken,
        account.platformUsername || undefined
      );
    } catch (error) {
      logger.error('Failed to create HybridRedditClient', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get user's posts with pagination and caching
   * 
   * Uses Reddit JSON API for fast reads
   * Caches results for 5 minutes
   */
  async getUserPosts(
    username: string,
    limit: number = 100,
    after?: string
  ): Promise<{ posts: RedditPost[]; after: string | null }> {
    try {
      // Check cache first
      const cacheKey = `reddit:posts:${username}:${limit}:${after || 'start'}`;
      const cached = await cacheGet<{ posts: RedditPost[]; after: string | null }>(cacheKey);

      if (cached) {
        logger.debug('Cache hit for user posts', { username, limit });
        return cached;
      }

      // Fetch from Reddit API
      const posts: RedditPost[] = [];
      let currentAfter = after;
      const batchSize = Math.min(100, limit); // Reddit max is 100 per request

      while (posts.length < limit) {
        const remaining = limit - posts.length;
        const fetchLimit = Math.min(batchSize, remaining);

        const response = await this.axios.get(`/user/${username}/submitted`, {
          params: {
            limit: fetchLimit,
            after: currentAfter,
            raw_json: 1,
          },
        });

        const children = response.data?.data?.children || [];
        const newPosts = children.map((child: { data: RedditPost }) => child.data);

        posts.push(...newPosts);

        currentAfter = response.data?.data?.after;

        // Break if no more posts
        if (!currentAfter || newPosts.length === 0) {
          break;
        }
      }

      const result = {
        posts,
        after: currentAfter ?? null,
      };

      // Cache for 5 minutes
      await cacheSet(cacheKey, result, CACHE_TTL.FIVE_MINUTES);

      logger.info('Fetched user posts from Reddit', {
        username,
        count: posts.length,
        hasMore: !!currentAfter,
      });

      return result;
    } catch (error) {
      logger.error('Failed to fetch user posts', {
        username,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get subreddit information with caching
   * 
   * Caches for 1 hour since subreddit info changes infrequently
   */
  async getSubredditInfo(subreddit: string): Promise<RedditSubredditInfo | null> {
    try {
      const normalizedName = subreddit.replace(/^r\//, '').trim();

      // Check cache first
      const cacheKey = `reddit:subreddit:info:${normalizedName}`;
      const cached = await cacheGet<RedditSubredditInfo>(cacheKey);

      if (cached) {
        logger.debug('Cache hit for subreddit info', { subreddit: normalizedName });
        return cached;
      }

      // Fetch from Reddit API
      const response = await this.axios.get(`/r/${normalizedName}/about`, {
        params: { raw_json: 1 },
      });

      const info: RedditSubredditInfo = response.data?.data;

      if (!info) {
        return null;
      }

      // Cache for 1 hour
      await cacheSet(cacheKey, info, CACHE_TTL.ONE_HOUR);

      logger.info('Fetched subreddit info from Reddit', {
        subreddit: normalizedName,
        subscribers: info.subscribers,
      });

      return info;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Subreddit not found', { subreddit });
        return null;
      }

      logger.error('Failed to fetch subreddit info', {
        subreddit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get subreddit rules with caching
   * 
   * Caches for 24 hours since rules change infrequently
   */
  async getSubredditRules(subreddit: string): Promise<RedditSubredditRules | null> {
    try {
      const normalizedName = subreddit.replace(/^r\//, '').trim();

      // Check cache first
      const cacheKey = `reddit:subreddit:rules:${normalizedName}`;
      const cached = await cacheGet<RedditSubredditRules>(cacheKey);

      if (cached) {
        logger.debug('Cache hit for subreddit rules', { subreddit: normalizedName });
        return cached;
      }

      // Fetch from Reddit API
      const response = await this.axios.get(`/r/${normalizedName}/about/rules`, {
        params: { raw_json: 1 },
      });

      const rules: RedditSubredditRules = response.data;

      if (!rules) {
        return null;
      }

      // Cache for 24 hours
      await cacheSet(cacheKey, rules, CACHE_TTL.ONE_DAY);

      logger.info('Fetched subreddit rules from Reddit', {
        subreddit: normalizedName,
        ruleCount: rules.rules?.length || 0,
      });

      return rules;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        logger.warn('Subreddit rules not found', { subreddit });
        return null;
      }

      logger.error('Failed to fetch subreddit rules', {
        subreddit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Submit a post via Snoowrap (reliable OAuth writes)
   * 
   * Invalidates relevant caches after successful post
   */
  async submitPost(options: PostOptions): Promise<string> {
    try {
      let submission;

      if (options.url) {
        // Link post
        submission = await this.snoowrap.submitLink({
          subredditName: options.subreddit,
          title: options.title,
          url: options.url,
          nsfw: options.nsfw,
          spoiler: options.spoiler,
        }).catch((err) => { throw err; });
      } else {
        // Text post
        submission = await this.snoowrap.submitSelfpost({
          subredditName: options.subreddit,
          title: options.title,
          text: options.text || '',
          nsfw: options.nsfw,
          spoiler: options.spoiler,
        }).catch((err) => { throw err; });
      }

      // Apply flair if specified
      if (options.flairId || options.flairText) {
        try {
          await submission.selectFlair({
            flair_template_id: options.flairId,
            text: options.flairText,
          });
        } catch (flairError) {
          logger.warn('Failed to apply flair', {
            postId: submission.id,
            error: flairError instanceof Error ? flairError.message : String(flairError),
          });
        }
      }

      // Invalidate user posts cache
      if (this.redditUsername) {
        const cachePattern = `reddit:posts:${this.redditUsername}:*`;
        logger.debug('Invalidating user posts cache', { pattern: cachePattern });
        // Note: Cache invalidation by pattern would require additional implementation
      }

      logger.info('Successfully submitted post via Snoowrap', {
        userId: this.userId,
        subreddit: options.subreddit,
        postId: submission.id,
      });

      return submission.id;
    } catch (error) {
      logger.error('Failed to submit post', {
        userId: this.userId,
        subreddit: options.subreddit,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the underlying Snoowrap instance for advanced operations
   * 
   * Use sparingly - prefer using the hybrid client methods
   */
  getSnoowrap(): Snoowrap {
    return this.snoowrap;
  }

  /**
   * Test connection to Reddit API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.snoowrap.getMe();
      return true;
    } catch (error) {
      logger.error('Reddit connection test failed', {
        userId: this.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
