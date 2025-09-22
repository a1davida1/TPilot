import snoowrap from 'snoowrap';
import { db } from '../db.js';
import { creatorAccounts, subredditRules, postRateLimits, redditCommunities, users } from '@shared/schema';
import { eq, and, gt, or } from 'drizzle-orm';
import { decrypt } from '../services/state-store.js';
import { SafetyManager } from './safety-systems.js';
import { getEligibleCommunitiesForUser, type CommunityEligibilityCriteria } from '../reddit-communities.js';
import type { RedditCommunity, ShadowbanStatusType, ShadowbanSubmissionSummary, ShadowbanEvidenceResponse, ShadowbanCheckApiResponse } from '@shared/schema';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface NormalizedSubredditRules {
  linkPolicy?: 'no-link' | 'one-link' | 'ok';
  cooldownMinutes?: number;
  cooldownHours?: number;
  postingCadence?: {
    cooldownMinutes?: number;
  };
  postingLimits?: {
    perDay?: number;
    per24h?: number;
    daily?: number;
    cooldownMinutes?: number;
    cooldownHours?: number;
  };
}

export interface PostCheckContext {
  hasLink?: boolean;
  intendedAt?: Date;
  title?: string;
  body?: string;
}

function getEnvOrDefault(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.warn(`Warning: Missing environment variable: ${name}`);
    return '';
  }
  return value || defaultValue || '';
}

// These will be validated when actually needed, not at startup
const REDDIT_CLIENT_ID = getEnvOrDefault('REDDIT_CLIENT_ID');
const REDDIT_CLIENT_SECRET = getEnvOrDefault('REDDIT_CLIENT_SECRET');
const REDDIT_USER_AGENT = getEnvOrDefault('REDDIT_USER_AGENT', 'ThottoPilot/1.0 (Content scheduling bot)');

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
  decision?: PostingPermission;
}

export interface PostingPermission {
  canPost: boolean;
  reason?: string;
  reasons: string[];
  warnings: string[];
  nextAllowedPost?: Date;
  evaluatedAt: Date;
  postsInLast24h: number;
  maxPostsPer24h: number;
  ruleSummary?: {
    linkPolicy?: NormalizedSubredditRules['linkPolicy'];
    cooldownMinutes?: number;
    dailyLimit?: number;
  };
}

export interface RedditProfileData {
  username: string;
  karma: number;
  createdUtc: number;
  verified: boolean;
  goldStatus: boolean;
  hasMail: boolean;
}

export interface RedditCommunityEligibility {
  karma: number | null;
  accountAgeDays: number | null;
  verified: boolean;
  communities: RedditCommunity[];
  profileLoaded: boolean;
}

function normalizeSubredditName(subreddit: string): string {
  return subreddit.replace(/^r\//i, '').trim().toLowerCase();
}

function toDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function deriveCooldownMinutes(rules?: NormalizedSubredditRules): number | null {
  if (!rules) {
    return null;
  }

  const values: Array<number | undefined> = [
    rules.cooldownMinutes,
    rules.cooldownHours ? rules.cooldownHours * 60 : undefined,
    rules.postingCadence?.cooldownMinutes,
    rules.postingLimits?.cooldownMinutes,
    rules.postingLimits?.cooldownHours ? rules.postingLimits.cooldownHours * 60 : undefined,
  ];

  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function deriveDailyLimit(rules?: NormalizedSubredditRules): number | null {
  if (!rules?.postingLimits) {
    return null;
  }

  const { postingLimits } = rules;
  const candidates: Array<number | undefined> = [
    postingLimits.perDay,
    postingLimits.per24h,
    postingLimits.daily,
  ];

  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

interface RedditSubmission {
  id: string;
  permalink: string;
}

function normalizeSubredditNameForComparison(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^r\//i, '').toLowerCase();
}

function extractVerifiedFromMetadata(metadata: unknown): boolean | undefined {
  if (typeof metadata !== 'object' || metadata === null) {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  const value = record.verified;

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}

function calculateAccountAgeDays(createdUtc: number | null | undefined): number | null {
  if (typeof createdUtc !== 'number' || !Number.isFinite(createdUtc) || createdUtc <= 0) {
    return null;
  }

  const createdMs = createdUtc * 1000;
  const now = Date.now();

  if (!Number.isFinite(createdMs) || createdMs <= 0 || createdMs > now) {
    return null;
  }

  const diffMs = now - createdMs;
  const age = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return age >= 0 ? age : 0;
}

export class RedditManager {
  private reddit: snoowrap;
  private userId: number;

  constructor(accessToken: string, refreshToken: string, userId: number) {
    this.userId = userId;
    this.reddit = new snoowrap({
      userAgent: REDDIT_USER_AGENT,
      clientId: REDDIT_CLIENT_ID,
      clientSecret: REDDIT_CLIENT_SECRET,
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
    let permission: PostingPermission | undefined;
    try {
      console.log(`Submitting post to r/${options.subreddit}: "${options.title}"`);

      // Check if we can post to this subreddit
      permission = await RedditManager.canPostToSubreddit(this.userId, options.subreddit, {
        hasLink: Boolean(options.url),
        intendedAt: new Date(),
        title: options.title,
        body: options.body || options.url || '',
      });

      if (!permission.canPost) {
        return {
          success: false,
          error: permission.reason || 'Cannot post to this subreddit',
          decision: permission,
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
      await this.updateRateLimit({
        subreddit: options.subreddit,
        postId: submission.id,
        title: options.title,
        body: options.body || options.url || '',
      });

      console.log('Reddit submission succeeded:', {
        userId: this.userId,
        subreddit: options.subreddit,
        postId: submission.id,
      });

      return {
        success: true,
        postId: submission.id,
        url: `https://www.reddit.com${submission.permalink}`,
        decision: permission,
      };

    } catch (error: unknown) {
      console.error('Reddit submission failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      let errorMessage = 'Failed to submit post';
      
      // Parse common Reddit API errors
      const errorObj = error as { message?: string };
      if (errorObj.message?.includes('RATELIMIT')) {
        errorMessage = 'Rate limited by Reddit. Please try again later.';
      } else if (errorObj.message?.includes('SUBREDDIT_NOTALLOWED')) {
        errorMessage = 'Not allowed to post in this subreddit';
      } else if (errorObj.message?.includes('NO_TEXT')) {
        errorMessage = 'Post content cannot be empty';
      } else if (errorObj.message?.includes('TOO_LONG')) {
        errorMessage = 'Post title or content is too long';
      }

      return {
        success: false,
        error: errorMessage,
        decision: permission,
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
    let permission: PostingPermission | undefined;
    try {
      // Check posting permission (image uploads are not link posts unless falling back to URL)
      permission = await RedditManager.canPostToSubreddit(this.userId, options.subreddit, {
        hasLink: false, // Direct image uploads are not link posts
        intendedAt: new Date(),
        title: options.title,
        body: options.imageUrl || '',
      });

      if (!permission.canPost) {
        return {
          success: false,
          error: permission.reason || 'Cannot post to this subreddit',
          decision: permission,
        };
      }

      const reddit = await this.initReddit();
      
      // Security: Validate imageUrl to prevent SSRF
      if (options.imageUrl) {
        try {
          const url = new URL(options.imageUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid URL protocol');
          }
          // Additional validation could include hostname allowlisting
        } catch (urlError) {
          return {
            success: false,
            error: 'Invalid image URL provided',
            decision: permission,
          };
        }
      }
      
      // If we have a URL, download it to buffer
      if (options.imageUrl && !options.imageBuffer) {
        const response = await fetch(options.imageUrl);
        const arrayBuffer = await response.arrayBuffer();
        options.imageBuffer = Buffer.from(arrayBuffer);
      }

      // Direct image upload to Reddit
      if (options.imageBuffer || options.imagePath) {
        console.log('Uploading image directly to Reddit (i.redd.it)...');
        
        const subreddit = (reddit as unknown as {
          getSubreddit(name: string): {
            submitImage(input: {
              title: string;
              imageFile: Buffer | string;
              nsfw: boolean;
              spoiler: boolean;
              sendReplies: boolean;
            }): Promise<{ name?: string; id: string; permalink: string }>;
          };
        }).getSubreddit(options.subreddit);
        
        try {
          // Try direct image upload first
          const imageFile = options.imageBuffer ?? options.imagePath;
          if (!imageFile) {
            throw new Error('No image file or path provided');
          }
          
          const submission = await subreddit.submitImage({
            title: options.title,
            imageFile,
            nsfw: options.nsfw ?? false,
            spoiler: options.spoiler ?? false,
            sendReplies: true,
          });

          // Update rate limiting after successful submission
          await this.updateRateLimit({
            subreddit: options.subreddit,
            postId: submission.name || submission.id,
            title: options.title,
            body: options.imageUrl || '',
          });

          return {
            success: true,
            postId: submission.name || submission.id,
            url: `https://www.reddit.com${submission.permalink}`,
            decision: permission,
          };
        } catch (imgError: unknown) {
          console.error('Direct image upload failed, falling back to link post:', (imgError as { message?: string }).message);
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
        error: 'No image provided for upload',
        decision: permission,
      };

    } catch (error: unknown) {
      console.error('Image submission failed:', error);
      return {
        success: false,
        error: (error as { message?: string }).message ?? 'Failed to upload image',
        decision: permission,
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
    let permission: PostingPermission | undefined;
    try {
      // Check posting permission (gallery uploads are not link posts)
      const gallerySummary = (options.images || [])
        .map((img) => img.caption || img.url || '')
        .filter(Boolean)
        .join('\n');

      permission = await RedditManager.canPostToSubreddit(this.userId, options.subreddit, {
        hasLink: false, // Gallery uploads are not link posts
        intendedAt: new Date(),
        title: options.title,
        body: gallerySummary,
      });

      if (!permission.canPost) {
        return {
          success: false,
          error: permission.reason || 'Cannot post to this subreddit',
          decision: permission,
        };
      }

      const reddit = await this.initReddit();
      const subreddit = (reddit as unknown as {
        getSubreddit(name: string): {
          submitGallery(input: {
            title: string;
            images: Array<{ imageFile: Buffer; caption: string }>;
            nsfw: boolean;
            sendReplies: boolean;
          }): Promise<{ name?: string; id: string; permalink: string }>;
        };
      }).getSubreddit(options.subreddit);
      
      // Prepare images for gallery
      const galleryImages = await Promise.all(
        options.images.slice(0, 20).map(async (img) => { // Max 20 images
          let imageBuffer = img.buffer;
          
          if (!imageBuffer && img.url) {
            // Security: Validate URL to prevent SSRF
            try {
              const url = new URL(img.url);
              if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('Invalid URL protocol');
              }
              // Additional validation could include hostname allowlisting
            } catch (urlError) {
              throw new Error('Invalid image URL provided in gallery');
            }
            
            const response = await fetch(img.url);
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
          }
          
          if (!imageBuffer) {
            throw new Error('No image buffer or URL provided for gallery image');
          }
          
          return {
            imageFile: imageBuffer,
            caption: img.caption ?? ''
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

      // Update rate limiting after successful submission
      await this.updateRateLimit({
        subreddit: options.subreddit,
        postId: submission.name || submission.id,
        title: options.title,
        body: gallerySummary,
      });

      return {
        success: true,
        postId: submission.name || submission.id,
        url: `https://www.reddit.com${submission.permalink}`,
        decision: permission,
      };

    } catch (error: unknown) {
      // Not all subreddits support galleries
      const errorObj = error as { message?: string };
      if (errorObj.message?.includes('INVALID_OPTION') || errorObj.message?.includes('gallery')) {
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
        error: (error as { message?: string }).message ?? 'Failed to submit gallery',
        decision: permission,
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
      const subreddit = await (reddit as unknown as {
        getSubreddit(name: string): {
          fetch(): Promise<{
            allow_images: boolean;
            allow_galleries: boolean;
            allow_videos: boolean;
            over18: boolean;
          }>;
        };
      }).getSubreddit(subredditName).fetch();
      
      return {
        allowsImages: subreddit.allow_images !== false,
        allowsGalleries: subreddit.allow_galleries === true,
        allowsVideos: subreddit.allow_videos !== false,
        isNsfw: subreddit.over18 ?? false
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
   * Check if we can post to a subreddit based on rules, community metadata, and safety checks
   */
  static async canPostToSubreddit(
    userId: number,
    subreddit: string,
    context: PostCheckContext = {}
  ): Promise<PostingPermission> {
    const now = context.intendedAt || new Date();
    const normalizedSubreddit = normalizeSubredditName(subreddit);
    
    try {
      // First check eligibility requirements
      const eligibilityCheck = await RedditManager.checkSubredditEligibility(userId, subreddit);
      if (!eligibilityCheck.canPost) {
        return {
          canPost: false,
          reason: eligibilityCheck.reason || 'Eligibility requirements not met',
          reasons: [eligibilityCheck.reason || 'Eligibility requirements not met'],
          warnings: [],
          nextAllowedPost: undefined,
          evaluatedAt: now,
          postsInLast24h: 0,
          maxPostsPer24h: 3,
        };
      }
      // Load community metadata from redditCommunities table
      const [communityData] = await db
        .select()
        .from(redditCommunities)
        .where(eq(redditCommunities.name, normalizedSubreddit))
        .limit(1);

      // Load normalized subreddit rules from database
      const rulesResult = await db
        .select()
        .from(subredditRules)
        .where(eq(subredditRules.subreddit, normalizedSubreddit))
        .limit(1);

      // Get user data for account stats
      const [userData] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const rules: NormalizedSubredditRules | undefined = rulesResult[0]?.rulesJson as NormalizedSubredditRules;
      const reasons: string[] = [];
      const warnings: string[] = [];

      // Perform safety checks (rate limits, duplicates) with SafetyManager
      if (context.title && context.body) {
        const safetyCheck = await SafetyManager.performSafetyCheck(
          userId.toString(),
          normalizedSubreddit,
          context.title,
          context.body
        );

        if (!safetyCheck.canPost) {
          reasons.push(...safetyCheck.issues);
        }
        warnings.push(...safetyCheck.warnings);
      }

      // Check community-specific requirements
      if (communityData) {
        // Verification requirement check
        if (communityData.verificationRequired && (!userData?.emailVerified)) {
          reasons.push('Account verification required for this community');
        }

        // Check promotion policy
        if (context.hasLink) {
          if (communityData.promotionAllowed === 'no') {
            reasons.push('Promotional content not allowed in this community');
          } else if (communityData.promotionAllowed === 'verified-only' && !userData?.emailVerified) {
            reasons.push('Only verified users can post promotional content');
          }
        }

        // Use community-specific posting limits if available
        if (communityData.postingLimits) {
          const communityLimits = communityData.postingLimits as any;
          const dailyLimit = communityLimits?.daily || communityLimits?.perDay || communityLimits?.per24h;
          if (dailyLimit && typeof dailyLimit === 'number') {
            // Get current posting stats for this community
            const oneDayAgo = new Date(now.getTime() - DAY_IN_MS);
            const recentPosts = await db
              .select()
              .from(postRateLimits)
              .where(
                and(
                  eq(postRateLimits.userId, userId),
                  eq(postRateLimits.subreddit, normalizedSubreddit),
                  gt(postRateLimits.lastPostAt, oneDayAgo)
                )
              );

            const postsInLast24h = recentPosts.length;
            if (postsInLast24h >= dailyLimit) {
              reasons.push(`Community posting limit reached (${dailyLimit} posts per 24 hours)`);
            } else if (postsInLast24h >= dailyLimit - 1) {
              warnings.push(`Approaching community limit: ${postsInLast24h + 1}/${dailyLimit} posts`);
            }
          }
        }
      }

      // Apply legacy rule checks if no community data or as fallback
      if (!communityData || reasons.length === 0) {
        // Determine query window - max of 24h and cooldown period for long cooldowns
        const cooldownMinutes = deriveCooldownMinutes(rules);
        const queryWindow = Math.max(DAY_IN_MS, (cooldownMinutes || 0) * 60 * 1000);
        const queryStartTime = new Date(now.getTime() - queryWindow);
        
        // Get post history for rate limiting
        const recentPosts = await db
          .select()
          .from(postRateLimits)
          .where(
            and(
              eq(postRateLimits.userId, userId),
              eq(postRateLimits.subreddit, normalizedSubreddit),
              gt(postRateLimits.lastPostAt, queryStartTime)
            )
          );

        // For daily limits, only count posts in last 24h
        const oneDayAgo = new Date(now.getTime() - DAY_IN_MS);
        const postsInLast24h = recentPosts.filter(post => {
          const postDate = toDate(post.lastPostAt);
          return postDate && postDate > oneDayAgo;
        }).length;

        // Check link policy
        if (context.hasLink && rules?.linkPolicy === 'no-link') {
          reasons.push('This subreddit does not allow links');
        } else if (context.hasLink && rules?.linkPolicy === 'one-link') {
          if (postsInLast24h > 0) {
            reasons.push('This subreddit only allows one link per 24 hours');
          }
        }

        // Check cooldown period
        let nextAllowedPost: Date | undefined;
        if (cooldownMinutes && recentPosts.length > 0) {
          const mostRecentPost = recentPosts.reduce((latest, post) => {
            const postDate = toDate(post.lastPostAt);
            const latestDate = toDate(latest.lastPostAt);
            return postDate && latestDate && postDate > latestDate ? post : latest;
          });

          const mostRecentPostTime = toDate(mostRecentPost.lastPostAt);
          if (mostRecentPostTime) {
            const cooldownEnd = new Date(mostRecentPostTime.getTime() + cooldownMinutes * 60 * 1000);
            if (now < cooldownEnd) {
              nextAllowedPost = cooldownEnd;
              const remainingMinutes = Math.ceil((cooldownEnd.getTime() - now.getTime()) / (60 * 1000));
              reasons.push(`Must wait ${remainingMinutes} minutes before posting again (cooldown period)`);
            }
          }
        }

        // Check daily limit
        const dailyLimit = deriveDailyLimit(rules);
        const maxPostsPer24h = dailyLimit || 3; // Conservative default to prevent shadowbans

        if (postsInLast24h >= maxPostsPer24h) {
          reasons.push(`Daily posting limit reached (${maxPostsPer24h} posts per 24 hours)`);
          
          // Calculate when daily limit resets (oldest post + 24h)
          const postsInLast24hSorted = recentPosts
            .filter(post => {
              const postDate = toDate(post.lastPostAt);
              return postDate && postDate > oneDayAgo;
            })
            .map(post => toDate(post.lastPostAt))
            .filter((date): date is Date => !!date)
            .sort((a, b) => a.getTime() - b.getTime());
          
          if (postsInLast24hSorted.length > 0) {
            const oldestPostIn24h = postsInLast24hSorted[0];
            const dailyLimitReset = new Date(oldestPostIn24h.getTime() + DAY_IN_MS);
            
            // nextAllowedPost is the earliest of cooldown end or daily limit reset
            if (!nextAllowedPost || dailyLimitReset < nextAllowedPost) {
              nextAllowedPost = dailyLimitReset;
            }
          }
        } else if (postsInLast24h >= maxPostsPer24h - 1) {
          warnings.push(`Approaching daily limit: ${postsInLast24h + 1}/${maxPostsPer24h} posts`);
        }

        return {
          canPost: reasons.length === 0,
          reason: reasons.length > 0 ? reasons[0] : undefined,
          reasons,
          warnings,
          nextAllowedPost,
          evaluatedAt: now,
          postsInLast24h,
          maxPostsPer24h,
          ruleSummary: rules ? {
            linkPolicy: rules.linkPolicy,
            cooldownMinutes: cooldownMinutes ?? undefined,
            dailyLimit: dailyLimit ?? undefined,
          } : undefined,
        };
      }

      const canPost = reasons.length === 0;
      const primaryReason = reasons.length > 0 ? reasons[0] : undefined;

      return {
        canPost,
        reason: primaryReason,
        reasons,
        warnings,
        nextAllowedPost: undefined,
        evaluatedAt: now,
        postsInLast24h: 0,
        maxPostsPer24h: communityData?.postingLimits ? 
          (communityData.postingLimits as any)?.daily || 
          (communityData.postingLimits as any)?.perDay || 
          (communityData.postingLimits as any)?.per24h || 3 : 3,
        ruleSummary: rules ? {
          linkPolicy: rules.linkPolicy,
          cooldownMinutes: deriveCooldownMinutes(rules) ?? undefined,
          dailyLimit: deriveDailyLimit(rules) ?? undefined,
        } : undefined,
      };
    } catch (error) {
      console.error('Error checking posting permission:', error);
      return {
        canPost: false,
        reason: 'Error checking posting permission - please try again',
        reasons: ['Error checking posting permission'],
        warnings: [],
        nextAllowedPost: undefined,
        evaluatedAt: now,
        postsInLast24h: 0,
        maxPostsPer24h: 3,
      };
    }
  }

  /**
   * Check if user can post to specific subreddit based on eligibility requirements
   */
  static async checkSubredditEligibility(userId: number, subreddit: string): Promise<{ canPost: boolean; reason?: string }> {
    try {
      const eligibility = await getUserRedditCommunityEligibility(userId);

      if (!eligibility) {
        return {
          canPost: false,
          reason: 'No active Reddit account found for user'
        };
      }

      if (!eligibility.profileLoaded) {
        return {
          canPost: false,
          reason: 'Unable to verify Reddit profile information'
        };
      }

      if (eligibility.karma === null || eligibility.accountAgeDays === null) {
        return {
          canPost: false,
          reason: 'Missing Reddit profile data required for eligibility checks'
        };
      }

      const normalizedTarget = normalizeSubredditNameForComparison(subreddit);
      if (!normalizedTarget) {
        return {
          canPost: false,
          reason: 'Invalid subreddit name'
        };
      }

      const canPost = eligibility.communities.some((community) => {
        const possibleMatches = [
          normalizeSubredditNameForComparison(community.name),
          normalizeSubredditNameForComparison(community.id)
        ].filter((value): value is string => value !== null);

        return possibleMatches.includes(normalizedTarget);
      });

      if (canPost) {
        return { canPost: true };
      }

      return {
        canPost: false,
        reason: 'Subreddit requirements not met for current Reddit account'
      };

    } catch (error) {
      console.error('Error checking subreddit eligibility:', error);
      return {
        canPost: false,
        reason: 'Unable to verify posting permissions'
      };
    }
  }

  /**
   * Update rate limiting after successful post
   */
  private async updateRateLimit(options: { 
    subreddit: string; 
    postId: string;
    title: string;
    body: string;
  }): Promise<void> {
    try {
      const normalizedSubreddit = normalizeSubredditName(options.subreddit);
      
      // Record post using SafetyManager for comprehensive tracking
      await SafetyManager.recordPost(this.userId.toString(), normalizedSubreddit);
      
      // Record duplicate detection data
      await SafetyManager.recordPostForDuplicateDetection(
        this.userId.toString(),
        normalizedSubreddit,
        options.title,
        options.body
      );
      
      console.log(`Updated rate limit and recorded post for user ${this.userId} in r/${options.subreddit}`);
    } catch (error) {
      console.error('Failed to update rate limit:', error);
    }
  }

  /**
   * Get user's Reddit profile info
   */
  async getProfile(): Promise<RedditProfileData | null> {
    try {
      const user = await (this.reddit as unknown as {
        getMe(): Promise<{
          name: string;
          link_karma: number;
          comment_karma: number;
          created_utc: number;
          verified: boolean;
          is_gold: boolean;
          has_mail: boolean;
        }>;
      }).getMe();

      const totalKarma = (user.link_karma ?? 0) + (user.comment_karma ?? 0);

      return {
        username: user.name,
        karma: Number.isFinite(totalKarma) ? totalKarma : 0,
        createdUtc: typeof user.created_utc === 'number' ? user.created_utc : 0,
        verified: user.verified ?? false,
        goldStatus: user.is_gold ?? false,
        hasMail: user.has_mail ?? false,
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
      await (this.reddit as unknown as {
        getMe(): Promise<unknown>;
      }).getMe();
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
      await (this.reddit as unknown as {
        getMe(): Promise<unknown>;
      }).getMe();
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Check shadowban status by comparing private vs public submission feeds
   */
  async checkShadowbanStatus(): Promise<ShadowbanCheckApiResponse> {
    try {
      console.log(`Checking shadowban status for user ${this.userId}`);
      
      // Get user profile for username
      const profile = await this.getProfile();
      if (!profile) {
        throw new Error('Unable to fetch Reddit profile for shadowban check');
      }

      const username = profile.username;
      const checkedAt = new Date().toISOString();

      // Get private submissions from authenticated API (last 25 posts)
      const privateSubmissions = await this.getPrivateSubmissions();
      
      // Get public submissions from Reddit's public JSON API
      const publicSubmissions = await this.getPublicSubmissions(username);
      
      // Compare submissions to find missing ones (potential shadowban evidence)
      const privateIds = new Set(privateSubmissions.map(s => s.id));
      const publicIds = new Set(publicSubmissions.map(s => s.id));
      
      const missingSubmissionIds = Array.from(privateIds).filter(id => !publicIds.has(id));
      
      // Determine shadowban status
      let status: ShadowbanStatusType = 'unknown';
      let reason: string | undefined;

      if (privateSubmissions.length === 0) {
        status = 'unknown';
        reason = 'No recent submissions found to analyze';
      } else if (missingSubmissionIds.length === 0) {
        status = 'clear';
        reason = 'All recent submissions are publicly visible';
      } else if (missingSubmissionIds.length === privateSubmissions.length) {
        status = 'suspected';
        reason = 'All recent submissions are missing from public view';
      } else if (missingSubmissionIds.length >= privateSubmissions.length * 0.5) {
        status = 'suspected';
        reason = `${missingSubmissionIds.length} of ${privateSubmissions.length} recent submissions are missing from public view`;
      } else {
        status = 'clear';
        reason = `Most submissions are publicly visible (${privateSubmissions.length - missingSubmissionIds.length}/${privateSubmissions.length})`;
      }

      const evidence: ShadowbanEvidenceResponse = {
        username,
        checkedAt,
        privateCount: privateSubmissions.length,
        publicCount: publicSubmissions.length,
        privateSubmissions,
        publicSubmissions,
        missingSubmissionIds
      };

      console.log(`Shadowban check completed for ${username}: ${status} (${missingSubmissionIds.length} missing submissions)`);

      return {
        status,
        reason,
        evidence
      };

    } catch (error) {
      console.error('Shadowban check failed:', error);
      
      // Return unknown status with error info
      return {
        status: 'unknown',
        reason: error instanceof Error ? error.message : 'Unknown error during shadowban check',
        evidence: {
          username: 'unknown',
          checkedAt: new Date().toISOString(),
          privateCount: 0,
          publicCount: 0,
          privateSubmissions: [],
          publicSubmissions: [],
          missingSubmissionIds: []
        }
      };
    }
  }

  /**
   * Get private submissions from authenticated Reddit API
   */
  private async getPrivateSubmissions(): Promise<ShadowbanSubmissionSummary[]> {
    try {
      const user = await (this.reddit as unknown as {
        getMe(): Promise<{
          getSubmissions(options: { limit: number }): Promise<Array<{
            id: string;
            created_utc: number;
            permalink: string;
            title: string;
            subreddit: { display_name: string };
          }>>;
        }>;
      }).getMe();

      const submissions = await user.getSubmissions({ limit: 25 });
      
      return submissions.map(submission => ({
        id: submission.id,
        createdUtc: submission.created_utc,
        permalink: submission.permalink,
        title: submission.title,
        subreddit: submission.subreddit.display_name
      }));

    } catch (error) {
      console.error('Failed to fetch private submissions:', error);
      return [];
    }
  }

  /**
   * Get public submissions from Reddit's public JSON API
   */
  private async getPublicSubmissions(username: string): Promise<ShadowbanSubmissionSummary[]> {
    try {
      const url = `https://www.reddit.com/user/${username}/submitted.json?limit=25`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': REDDIT_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`Reddit API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as {
        data: {
          children: Array<{
            data: {
              id: string;
              created_utc: number;
              permalink: string;
              title: string;
              subreddit: string;
            };
          }>;
        };
      };

      return data.data.children.map(child => ({
        id: child.data.id,
        createdUtc: child.data.created_utc,
        permalink: child.data.permalink,
        title: child.data.title,
        subreddit: child.data.subreddit
      }));

    } catch (error) {
      console.error('Failed to fetch public submissions:', error);
      return [];
    }
  }
}

/**
 * Get user's Reddit community eligibility based on their profile and account settings
 */
export async function getUserRedditCommunityEligibility(
  userId: number
): Promise<RedditCommunityEligibility | null> {
  const redditManager = await RedditManager.forUser(userId);

  if (!redditManager) {
    return null;
  }

  const [account] = await db
    .select({ metadata: creatorAccounts.metadata })
    .from(creatorAccounts)
    .where(
      and(
        eq(creatorAccounts.userId, userId),
        eq(creatorAccounts.platform, 'reddit'),
        eq(creatorAccounts.isActive, true)
      )
    )
    .limit(1);

  const metadataVerified = extractVerifiedFromMetadata(account?.metadata);

  const profile = await redditManager.getProfile();

  if (!profile) {
    return {
      karma: null,
      accountAgeDays: null,
      verified: metadataVerified ?? false,
      communities: [],
      profileLoaded: false,
    };
  }

  const karmaValue = Number.isFinite(profile.karma) ? profile.karma : null;
  const accountAgeDays = calculateAccountAgeDays(profile.createdUtc);
  const verified = metadataVerified ?? profile.verified;

  const communities = await getEligibleCommunitiesForUser({
    karma: karmaValue ?? undefined,
    accountAgeDays: accountAgeDays ?? undefined,
    verified,
  });

  return {
    karma: karmaValue,
    accountAgeDays,
    verified,
    communities,
    profileLoaded: true,
  };
}

/**
 * Initialize Reddit OAuth flow
 */
export function getRedditAuthUrl(state: string): string {
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
    client_id: REDDIT_CLIENT_ID,
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
        'Authorization': `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
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