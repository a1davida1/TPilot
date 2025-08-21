import snoowrap from 'snoowrap';
import { db } from '../db.js';
import { users, creatorAccounts } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';

export interface RedditPostOptions {
  subreddit: string;
  title: string;
  body?: string;
  url?: string;
  nsfw?: boolean;
  spoiler?: boolean;
}

export interface RedditPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
}

export interface PostingPermission {
  canPost: boolean;
  reason?: string;
  nextAllowedPost?: Date;
}

export class RedditManager {
  private reddit: snoowrap;
  private userId: number;

  constructor(accessToken: string, refreshToken: string, userId: number) {
    this.userId = userId;
    this.reddit = new snoowrap({
      userAgent: 'ThottoPilot/1.0 (Content scheduling bot)',
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
      accessToken,
      refreshToken,
    });
  }

  /**
   * Get Reddit manager for a specific user
   */
  static async forUser(userId: number): Promise<RedditManager | null> {
    try {
      const [account] = await db
        .select()
        .from(creatorAccounts)
        .where(
          and(
            eq(creatorAccounts.userId, userId),
            eq(creatorAccounts.platform, 'reddit'),
            eq(creatorAccounts.status, 'ok')
          )
        );

      if (!account || !account.oauthToken || !account.oauthRefresh) {
        return null;
      }

      return new RedditManager(account.oauthToken, account.oauthRefresh, userId);
    } catch (error) {
      console.error('Failed to create Reddit manager for user:', error);
      return null;
    }
  }

  /**
   * Submit a post to Reddit
   */
  async submitPost(options: RedditPostOptions): Promise<RedditPostResult> {
    try {
      console.log(`Submitting post to r/${options.subreddit}: "${options.title}"`);

      // Check if we can post to this subreddit
      const permission = await RedditManager.canPostToSubreddit(this.userId, options.subreddit);
      if (!permission.canPost) {
        return {
          success: false,
          error: permission.reason || 'Cannot post to this subreddit'
        };
      }

      let submission;

      if (options.url) {
        // Link post
        submission = (this.reddit as any)
          .getSubreddit(options.subreddit)
          .submitLink({
            subredditName: options.subreddit,
            title: options.title,
            url: options.url,
            nsfw: options.nsfw || false,
            spoiler: options.spoiler || false,
          });
      } else {
        // Text post
        submission = (this.reddit as any)
          .getSubreddit(options.subreddit)
          .submitSelfpost({
            subredditName: options.subreddit,
            title: options.title,
            text: options.body || '',
            nsfw: options.nsfw || false,
            spoiler: options.spoiler || false,
          });
      }

      // Update rate limiting
      await this.updateRateLimit(options.subreddit);

      return {
        success: true,
        postId: submission.id,
        url: `https://www.reddit.com${submission.permalink}`,
      };

    } catch (error: any) {
      console.error('Reddit submission failed:', error);
      
      let errorMessage = 'Failed to submit post';
      
      // Parse common Reddit API errors
      if (error.message?.includes('RATELIMIT')) {
        errorMessage = 'Rate limited by Reddit. Please try again later.';
      } else if (error.message?.includes('SUBREDDIT_NOTALLOWED')) {
        errorMessage = 'Not allowed to post in this subreddit';
      } else if (error.message?.includes('NO_TEXT')) {
        errorMessage = 'Post content cannot be empty';
      } else if (error.message?.includes('TOO_LONG')) {
        errorMessage = 'Post title or content is too long';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Check if user can post to a specific subreddit (rate limiting)
   */
  static async canPostToSubreddit(userId: number, subreddit: string): Promise<PostingPermission> {
    try {
      // Check if user has exceeded posting limits for this subreddit
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // For demo purposes, allow posting (in production, implement proper rate limiting)
      // In a real implementation, you'd check:
      // - Subreddit-specific post limits
      // - User's posting history
      // - Account age and karma requirements
      // - Subreddit ban status

      return {
        canPost: true
      };

    } catch (error) {
      console.error('Error checking posting permission:', error);
      return {
        canPost: false,
        reason: 'Unable to verify posting permissions'
      };
    }
  }

  /**
   * Update rate limiting after successful post
   */
  private async updateRateLimit(subreddit: string): Promise<void> {
    try {
      // In production, update rate limiting tables
      console.log(`Updated rate limit for user ${this.userId} in r/${subreddit}`);
      
      // This would insert/update records in post_rate_limits table
      // await db.insert(postRateLimits).values({...})
      
    } catch (error) {
      console.error('Failed to update rate limit:', error);
    }
  }

  /**
   * Get user's Reddit profile info
   */
  async getProfile(): Promise<any> {
    try {
      const user = await (this.reddit as any).getMe();
      return {
        username: user.name,
        karma: user.link_karma + user.comment_karma,
        created: user.created_utc,
        verified: user.verified,
        goldStatus: user.is_gold,
        hasMail: user.has_mail,
      };
    } catch (error) {
      console.error('Failed to get Reddit profile:', error);
      return null;
    }
  }

  /**
   * Test Reddit connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await (this.reddit as any).getMe();
      return true;
    } catch (error) {
      console.error('Reddit connection test failed:', error);
      return false;
    }
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(): Promise<void> {
    try {
      // snoowrap handles token refresh automatically
      await (this.reddit as any).getMe();
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }
}

/**
 * Initialize Reddit OAuth flow
 */
export function getRedditAuthUrl(state: string): string {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_REDIRECT_URI) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  const baseUrl = 'https://www.reddit.com/api/v1/authorize';
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID,
    response_type: 'code',
    state,
    redirect_uri: process.env.REDDIT_REDIRECT_URI,
    duration: 'permanent', // Request permanent access
    scope: 'identity submit edit read vote save history mysubreddits',
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeRedditCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET || !process.env.REDDIT_REDIRECT_URI) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ThottoPilot/1.0',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.REDDIT_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    throw new Error(`Reddit token exchange failed: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}