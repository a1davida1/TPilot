import snoowrap from "snoowrap";
import { env } from "./config.js";
import { db } from "../db.js";
import { creatorAccounts, postJobs, eventLogs } from "@shared/schema.js";
import { eq, and } from "drizzle-orm";

export interface RedditPostOptions {
  subreddit: string;
  title: string;
  body?: string;
  url?: string;
  mediaKey?: string;
  flair?: string;
  nsfw?: boolean;
}

export interface RedditPostResult {
  success: boolean;
  postId?: string;
  url?: string;
  error?: string;
  warnings?: string[];
}

export class RedditManager {
  private client: snoowrap;
  private account: any;

  constructor(account: any) {
    this.account = account;
    this.client = new snoowrap({
      userAgent: 'ThottoPilot/1.0.0',
      clientId: env.REDDIT_CLIENT_ID,
      clientSecret: env.REDDIT_CLIENT_SECRET,
      refreshToken: account.oauthRefresh,
      accessToken: account.oauthToken,
    });
  }

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
        )
        .limit(1);

      if (!account) {
        return null;
      }

      return new RedditManager(account);
    } catch (error) {
      console.error('Failed to load Reddit account:', error);
      return null;
    }
  }

  async submitPost(options: RedditPostOptions): Promise<RedditPostResult> {
    try {
      // Validate subreddit exists and is accessible
      const subreddit = await this.client.getSubreddit(options.subreddit);
      
      // Check if we're banned or restricted
      try {
        await subreddit.getNew({ limit: 1 });
      } catch (error: any) {
        if (error.statusCode === 403) {
          return {
            success: false,
            error: `Banned or restricted from r/${options.subreddit}`,
          };
        }
      }

      // Submit the post
      let submission: any;
      if (options.url) {
        // Link post
        submission = await subreddit.submitLink({
          title: options.title,
          url: options.url,
          nsfw: options.nsfw || false,
        });
      } else {
        // Text post
        submission = await subreddit.submitSelfpost({
          title: options.title,
          text: options.body || '',
          nsfw: options.nsfw || false,
        });
      }

      // Apply flair if specified
      if (options.flair && submission.link_flair_template_id) {
        try {
          await submission.selectFlair({ flair_template_id: options.flair });
        } catch (flairError) {
          console.warn('Failed to set flair:', flairError);
        }
      }

      const result: RedditPostResult = {
        success: true,
        postId: submission.id,
        url: `https://reddit.com${submission.permalink}`,
      };

      // Log successful post
      await this.logEvent(this.account.userId, 'post.sent', {
        postId: submission.id,
        subreddit: options.subreddit,
        title: options.title,
        url: result.url,
        timestamp: new Date().toISOString(),
      });

      return result;

    } catch (error: any) {
      console.error('Reddit post failed:', error);

      // Handle specific Reddit API errors
      let errorMessage = 'Unknown error occurred';
      const warnings: string[] = [];

      if (error.statusCode === 429) {
        errorMessage = 'Rate limited - try again later';
      } else if (error.statusCode === 403) {
        errorMessage = 'Account restricted or banned';
        await this.updateAccountStatus('limited');
      } else if (error.message?.includes('SUBREDDIT_NOTALLOWED')) {
        errorMessage = 'Not allowed to post in this subreddit';
      } else if (error.message?.includes('TITLE_TOO_LONG')) {
        errorMessage = 'Title too long';
      } else if (error.message?.includes('ALREADY_SUB')) {
        errorMessage = 'This link was already posted';
      } else if (error.message?.includes('DOMAIN_BANNED')) {
        errorMessage = 'Domain is banned in this subreddit';
      }

      // Log failed post attempt
      await this.logEvent(this.account.userId, 'post.failed', {
        subreddit: options.subreddit,
        title: options.title,
        error: errorMessage,
        statusCode: error.statusCode,
        timestamp: new Date().toISOString(),
      });

      return {
        success: false,
        error: errorMessage,
        warnings,
      };
    }
  }

  async getAccountInfo() {
    try {
      const me: any = await this.client.getMe();
      return {
        username: me.name,
        commentKarma: me.comment_karma,
        linkKarma: me.link_karma,
        accountAge: Math.floor((Date.now() - me.created_utc * 1000) / (1000 * 60 * 60 * 24)),
        verified: me.verified,
        hasGold: me.is_gold,
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      return null;
    }
  }

  async getSubredditInfo(subredditName: string) {
    try {
      const subreddit = await this.client.getSubreddit(subredditName);
      const info: any = await subreddit.fetch();

      return {
        name: info.display_name,
        title: info.title,
        description: info.description,
        subscribers: info.subscribers,
        nsfw: info.over18,
        restricted: info.subreddit_type === 'restricted',
        private: info.subreddit_type === 'private',
        rules: await this.getSubredditRules(subreddit),
      };
    } catch (error) {
      console.error('Failed to get subreddit info:', error);
      return null;
    }
  }

  private async getSubredditRules(subreddit: any) {
    try {
      const rules = await subreddit.getRules();
      return rules.map((rule: any) => ({
        title: rule.short_name,
        description: rule.description,
        kind: rule.kind, // 'link', 'comment', or 'all'
      }));
    } catch (error) {
      console.error('Failed to get subreddit rules:', error);
      return [];
    }
  }

  private async updateAccountStatus(status: 'ok' | 'limited' | 'banned') {
    try {
      await db
        .update(creatorAccounts)
        .set({ 
          status, 
          updatedAt: new Date() 
        })
        .where(eq(creatorAccounts.id, this.account.id));
    } catch (error) {
      console.error('Failed to update account status:', error);
    }
  }

  private async logEvent(userId: number, type: string, meta: any) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }

  // Get posting history for analysis
  static async getPostingHistory(userId: number, days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return db
      .select()
      .from(eventLogs)
      .where(
        and(
          eq(eventLogs.userId, userId),
          eq(eventLogs.type, 'post.sent'),
          // Add date filter here when needed
        )
      )
      .orderBy(eventLogs.createdAt);
  }

  // Check if user can post to subreddit (rate limiting)
  static async canPostToSubreddit(userId: number, subreddit: string): Promise<{
    canPost: boolean;
    reason?: string;
    nextAvailable?: Date;
  }> {
    const recentPosts = await db
      .select()
      .from(eventLogs)
      .where(
        and(
          eq(eventLogs.userId, userId),
          eq(eventLogs.type, 'post.sent')
        )
      )
      .orderBy(eventLogs.createdAt)
      .limit(10);

    // Check for posts to same subreddit in last 24 hours
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentToSubreddit = recentPosts.filter(post => {
      const postMeta = post.meta as any;
      return postMeta.subreddit === subreddit && 
             new Date(post.createdAt).getTime() > dayAgo;
    });

    if (recentToSubreddit.length >= 1) {
      const lastPost = recentToSubreddit[0];
      const nextAvailable = new Date(
        new Date(lastPost.createdAt).getTime() + 24 * 60 * 60 * 1000
      );

      return {
        canPost: false,
        reason: 'Already posted to this subreddit in the last 24 hours',
        nextAvailable,
      };
    }

    // Check overall posting rate (max 5 posts per hour)
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const recentPosts1Hour = recentPosts.filter(post => 
      new Date(post.createdAt).getTime() > hourAgo
    );

    if (recentPosts1Hour.length >= 5) {
      return {
        canPost: false,
        reason: 'Posting rate limit exceeded (5 posts per hour)',
        nextAvailable: new Date(hourAgo + 60 * 60 * 1000),
      };
    }

    return { canPost: true };
  }
}