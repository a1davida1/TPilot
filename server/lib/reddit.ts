import snoowrap from 'snoowrap';
import { db } from '../db.js';
import { users, creatorAccounts } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '../services/state-store.js';

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

interface RedditSubmission {
  id: string;
  permalink: string;
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
            eq(creatorAccounts.isActive, true)
          )
        );

      if (!account || !account.oauthToken) {
        return null;
      }

      // Decrypt tokens
      const accessToken = decrypt(account.oauthToken);
      const refreshToken = account.oauthRefresh ? decrypt(account.oauthRefresh) : '';
      
      if (!accessToken) {
        console.error('Failed to decrypt access token for user:', userId);
        return null;
      }

      return new RedditManager(accessToken, refreshToken, userId);
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

      let submission: RedditSubmission;

      if (options.url) {
        // Link post
        const subreddit = (this.reddit as unknown as {
          getSubreddit(name: string): {
            submitLink(input: {
              subredditName: string;
              title: string;
              url: string;
              nsfw: boolean;
              spoiler: boolean;
            }): Promise<RedditSubmission>;
          };
        }).getSubreddit(options.subreddit);
        submission = await subreddit.submitLink({
          subredditName: options.subreddit,
          title: options.title,
          url: options.url,
          nsfw: options.nsfw ?? false,
          spoiler: options.spoiler ?? false,
        });
      } else {
        // Text post
        const subreddit = (this.reddit as unknown as {
          getSubreddit(name: string): {
            submitSelfpost(input: {
              subredditName: string;
              title: string;
              text: string;
              nsfw: boolean;
              spoiler: boolean;
            }): Promise<RedditSubmission>;
          };
        }).getSubreddit(options.subreddit);
        submission = await subreddit.submitSelfpost({
          subredditName: options.subreddit,
          title: options.title,
          text: options.body ?? '',
          nsfw: options.nsfw ?? false,
          spoiler: options.spoiler ?? false,
        });
      }

      // Update rate limiting
      await this.updateRateLimit(options.subreddit);

      console.log('Reddit submission succeeded:', {
        userId: this.userId,
        subreddit: options.subreddit,
        postId: submission.id,
      });

      return {
        success: true,
        postId: submission.id,
        url: `https://www.reddit.com${submission.permalink}`,
      };

    } catch (error: unknown) {
      console.error('Reddit submission failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      let errorMessage = 'Failed to submit post';
      
      // Parse common Reddit API errors
      if ((error as any).message?.includes('RATELIMIT')) {
        errorMessage = 'Rate limited by Reddit. Please try again later.';
      } else if ((error as any).message?.includes('SUBREDDIT_NOTALLOWED')) {
        errorMessage = 'Not allowed to post in this subreddit';
      } else if ((error as any).message?.includes('NO_TEXT')) {
        errorMessage = 'Post content cannot be empty';
      } else if ((error as any).message?.includes('TOO_LONG')) {
        errorMessage = 'Post title or content is too long';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Submit image post with direct upload to Reddit
   */
  async submitImagePost(options: {
    subreddit: string;
    title: string;
    imageUrl?: string;
    imageBuffer?: Buffer;
    imagePath?: string;
    nsfw?: boolean;
    spoiler?: boolean;
  }): Promise<RedditPostResult> {
    try {
      const reddit = await this.initReddit();
      
      // If we have a URL, download it to buffer
      if (options.imageUrl && !options.imageBuffer) {
        const response = await fetch(options.imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        options.imageBuffer = Buffer.from(arrayBuffer);
      }

      // Direct image upload to Reddit
      if (options.imageBuffer || options.imagePath) {
        console.log('Uploading image directly to Reddit (i.redd.it)...');
        
        const subreddit = (reddit as any).getSubreddit(options.subreddit);
        
        try {
          // Try direct image upload first
          const submission = await subreddit.submitImage({
            title: options.title,
            imageFile: options.imageBuffer || options.imagePath,
            nsfw: options.nsfw || false,
            spoiler: options.spoiler || false,
            sendReplies: true,
          });

          return {
            success: true,
            postId: submission.name || submission.id,
            url: `https://www.reddit.com${submission.permalink}`,
          };
        } catch (imgError: unknown) {
          console.error('Direct image upload failed, falling back to link post:', (imgError as any).message);
          // Fallback to link post if image upload fails
          if (options.imageUrl) {
            return this.submitPost({
              subreddit: options.subreddit,
              title: options.title,
              url: options.imageUrl,
              nsfw: options.nsfw,
              spoiler: options.spoiler
            });
          }
          throw imgError;
        }
      }

      // No image provided
      return {
        success: false,
        error: 'No image provided for upload'
      };

    } catch (error: unknown) {
      console.error('Image submission failed:', error);
      return {
        success: false,
        error: (error as any).message || 'Failed to upload image'
      };
    }
  }

  /**
   * Submit gallery post with multiple images
   */
  async submitGalleryPost(options: {
    subreddit: string;
    title: string;
    images: Array<{
      url?: string;
      buffer?: Buffer;
      caption?: string;
    }>;
    nsfw?: boolean;
  }): Promise<RedditPostResult> {
    try {
      const reddit = await this.initReddit();
      const subreddit = (reddit as any).getSubreddit(options.subreddit);
      
      // Prepare images for gallery
      const galleryImages = await Promise.all(
        options.images.slice(0, 20).map(async (img) => { // Max 20 images
          let imageBuffer = img.buffer;
          
          if (!imageBuffer && img.url) {
            const response = await fetch(img.url);
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          }
          
          return {
            imageFile: imageBuffer,
            caption: img.caption || ''
          };
        })
      );

      // Submit gallery
      const submission = await subreddit.submitGallery({
        title: options.title,
        images: galleryImages,
        nsfw: options.nsfw || false,
        sendReplies: true
      });

      return {
        success: true,
        postId: submission.name || submission.id,
        url: `https://www.reddit.com${submission.permalink}`
      };

    } catch (error: unknown) {
      // Not all subreddits support galleries
      if ((error as any).message?.includes('INVALID_OPTION') || (error as any).message?.includes('gallery')) {
        console.log('Gallery not supported, falling back to single image');
        return this.submitImagePost({
          subreddit: options.subreddit,
          title: options.title,
          imageBuffer: options.images[0]?.buffer,
          imageUrl: options.images[0]?.url,
          nsfw: options.nsfw
        });
      }
      
      return {
        success: false,
        error: (error as any).message || 'Failed to submit gallery'
      };
    }
  }

  /**
   * Check if subreddit allows image posts
   */
  async checkSubredditCapabilities(subredditName: string): Promise<{
    allowsImages: boolean;
    allowsGalleries: boolean;
    allowsVideos: boolean;
    isNsfw: boolean;
  }> {
    try {
      const reddit = await this.initReddit();
      const subreddit = await (reddit as any).getSubreddit(subredditName).fetch();
      
      return {
        allowsImages: subreddit.allow_images !== false,
        allowsGalleries: subreddit.allow_galleries === true,
        allowsVideos: subreddit.allow_videos !== false,
        isNsfw: subreddit.over18 || false
      };
    } catch (error) {
      console.error('Failed to check subreddit capabilities:', error);
      return {
        allowsImages: true,
        allowsGalleries: false,
        allowsVideos: false,
        isNsfw: false
      };
    }
  }

  /**
   * Initialize Reddit instance (helper for new methods)
   */
  private async initReddit(): Promise<unknown> {
    await this.refreshTokenIfNeeded();
    return this.reddit;
  }

  /**
   * Check if user can post to a specific subreddit (rate limiting)
   */
  static async canPostToSubreddit(userId: number, subreddit: string): Promise<PostingPermission> {
    try {
      // Check if user has exceeded posting limits for this subreddit
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
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
  async getProfile(): Promise<unknown> {
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
  if (!process.env.REDDIT_CLIENT_ID) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  // Always use a consistent redirect URI
  let redirectUri = process.env.REDDIT_REDIRECT_URI;
  
  if (!redirectUri) {
    // Use the primary domain from REPLIT_DOMAINS for consistency
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'thottopilot.com';
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    redirectUri = `${protocol}://${domain}/api/reddit/callback`;
  }
  
  console.log('Reddit OAuth redirect URI (auth):', redirectUri);

  const baseUrl = 'https://www.reddit.com/api/v1/authorize';
  const params = new URLSearchParams({
    client_id: process.env.REDDIT_CLIENT_ID,
    response_type: 'code',
    state,
    redirect_uri: redirectUri,
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
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit OAuth credentials not configured');
  }

  // Always use a consistent redirect URI (must match exactly)
  let redirectUri = process.env.REDDIT_REDIRECT_URI;
  
  if (!redirectUri) {
    // Use the primary domain from REPLIT_DOMAINS for consistency
    const domain = process.env.REPLIT_DOMAINS?.split(',')[0] || 'thottopilot.com';
    const protocol = domain.includes('localhost') ? 'http' : 'https';
    redirectUri = `${protocol}://${domain}/api/reddit/callback`;
  }
  
  console.log('Reddit OAuth redirect URI (exchange):', redirectUri);

  try {
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
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Reddit token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        body,
      });
      throw new Error(`Reddit token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.refresh_token) {
      console.warn('No refresh token returned from Reddit');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('Reddit code exchange error:', error);
    throw error;
  }
}