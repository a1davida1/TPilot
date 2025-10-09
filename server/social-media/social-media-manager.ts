import { InstagramAPI } from './instagram-api.js';
import { TwitterAPI } from './twitter-api.js';
import { TikTokAPI } from './tiktok-api.js';
import { YouTubeAPI } from './youtube-api.js';
import { LinkedInAPI } from './linkedin-api.js';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './../lib/logger-utils.js';
export type Platform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'linkedin';

export interface PostContent {
  text: string;
  mediaUrls?: string[];
  hashtags?: string[];
  title?: string; // For YouTube
  description?: string; // For YouTube
}

export interface PostResult {
  success: boolean;
  platform: Platform;
  clientKey: string;
  postId?: string;
  error?: string;
}

export interface EngagementMetrics {
  platform: Platform;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  retweets?: number; // Twitter specific
  quotes?: number; // Twitter specific
}

// Unified Social Media Manager
type SocialMediaApiClient =
  | InstagramAPI
  | TwitterAPI
  | TikTokAPI
  | YouTubeAPI
  | LinkedInAPI;

export interface PlatformTarget {
  platform: Platform;
  key: string;
}

export class SocialMediaManager {
  private apis: Map<Platform, Map<string, SocialMediaApiClient>> = new Map();

  constructor() {}

  // Connect a social media account
  connectAccount(platform: Platform, key: string, credentials: Record<string, string>) {
    const platformClients = this.ensurePlatformMap(platform);
    const client = this.createClient(platform, credentials);
    platformClients.set(key, client);
  }

  registerClients(targets: Array<PlatformTarget & { credentials: Record<string, string> }>) {
    for (const target of targets) {
      this.connectAccount(target.platform, target.key, target.credentials);
    }
  }

  getClient(platform: Platform, key: string): SocialMediaApiClient {
    const platformClients = this.apis.get(platform);
    if (!platformClients) {
      throw new Error(`No clients registered for ${platform}`);
    }

    const client = platformClients.get(key);
    if (!client) {
      throw new Error(`No client registered for ${platform} using key "${key}"`);
    }

    return client;
  }

  // Post content to a specific platform
  async postToPlatform(platform: Platform, key: string, content: PostContent): Promise<PostResult> {
    try {
      const api = this.getClient(platform, key);

      switch (platform) {
        case 'instagram': {
          const result = await (api as InstagramAPI).createPost({
            imageUrl: content.mediaUrls?.[0],
            videoUrl: content.mediaUrls?.find(url => url.includes('.mp4')),
            caption: content.text,
            hashtags: content.hashtags,
          });
          return { ...result, clientKey: key };
        }

        case 'twitter': {
          const twitterApi = api as TwitterAPI;
          const mediaIds: string[] = [];
          if (content.mediaUrls?.length) {
            for (const mediaUrl of content.mediaUrls) {
              const mediaType = mediaUrl.includes('.mp4') ? 'video' : 'image';
              const uploadResult = await twitterApi.uploadMedia(mediaUrl, mediaType);
              if (uploadResult.success && uploadResult.mediaId) {
                mediaIds.push(uploadResult.mediaId);
              }
            }
          }
          const result = await twitterApi.createTweet({
            text: content.hashtags
              ? `${content.text}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`
              : content.text,
            mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
          });
          return { ...result, clientKey: key };
        }

        case 'tiktok': {
          if (!content.mediaUrls?.[0]?.includes('.mp4')) {
            return {
              success: false,
              platform,
              clientKey: key,
              error: 'TikTok requires video content',
            };
          }
          const tiktokResult = await (api as TikTokAPI).createPost({
            videoUrl: content.mediaUrls[0],
            caption: content.text,
            hashtags: content.hashtags,
          });
          return { ...tiktokResult, clientKey: key };
        }

        case 'youtube': {
          if (!content.mediaUrls?.[0]?.includes('.mp4')) {
            return {
              success: false,
              platform,
              clientKey: key,
              error: 'YouTube requires video content',
            };
          }
          const youtubeResult = await (api as YouTubeAPI).createPost({
            videoUrl: content.mediaUrls[0],
            title: content.title || content.text.substring(0, 100),
            description: content.description || content.text,
            tags: content.hashtags,
          });
          return { ...youtubeResult, clientKey: key };
        }
        case 'linkedin': {
          const result = await (api as LinkedInAPI).createPost({
            text: content.text,
            mediaUrls: content.mediaUrls,
            hashtags: content.hashtags,
          });
          return { ...result, clientKey: key };
        }
        default:
          return {
            success: false,
            platform,
            clientKey: key,
            error: `Posting not implemented for ${platform}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        platform,
        clientKey: key,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Post to multiple platforms simultaneously
  async postToMultiplePlatforms(
    targets: PlatformTarget[],
    content: PostContent
  ): Promise<PostResult[]> {
    const promises = targets.map(target =>
      this.postToPlatform(target.platform, target.key, content)
    );

    return await Promise.allSettled(promises).then(results =>
      targets.map((target, index) => {
        const result = results[index];
        if (result?.status === 'fulfilled') {
          return result.value;
        }

        const message =
          result && result.status === 'rejected' && result.reason?.message
            ? result.reason.message
            : 'Failed to post';

        return {
          success: false,
          platform: target.platform,
          clientKey: target.key,
          error: message,
        };
      })
    );
  }

  // Get engagement metrics for a post
  async getPostMetrics(platform: Platform, key: string, postId: string): Promise<EngagementMetrics | null> {
    const api = this.getClient(platform, key);
    try {
      let result;
      switch (platform) {
        case 'instagram':
          result = await (api as InstagramAPI).getPostMetrics?.(postId);
          break;
        case 'twitter':
          result = await (api as TwitterAPI).getUserMetrics?.(postId);
          break;
        case 'tiktok':
          result = await (api as TikTokAPI).getPostMetrics?.(postId);
          break;
        case 'youtube':
          result = await (api as YouTubeAPI).getVideoMetrics?.(postId);
          break;
      }
      if (!result?.success) {
        return null;
      }

      // Normalize metrics across platforms
      const metrics = result.metrics;
      switch (platform) {
        case 'instagram':
          return {
            platform,
            likes: metrics.find((m: { name: string; values: { value: number }[] }) => m.name === 'likes')?.values[0]?.value || 0,
            comments: metrics.find((m: { name: string; values: { value: number }[] }) => m.name === 'comments')?.values[0]?.value || 0,
            shares: metrics.find((m: { name: string; values: { value: number }[] }) => m.name === 'shares')?.values[0]?.value || 0,
            views: metrics.find((m: { name: string; values: { value: number }[] }) => m.name === 'impressions')?.values[0]?.value || 0,
          };

        case 'twitter':
          return {
            platform,
            likes: metrics.like_count || 0,
            comments: metrics.reply_count || 0,
            shares: metrics.retweet_count || 0,
            views: 0, // Twitter doesn't provide view count in basic metrics
            retweets: metrics.retweet_count || 0,
            quotes: metrics.quote_count || 0,
          };

        case 'tiktok':
          return {
            platform,
            likes: metrics.like_count || 0,
            comments: metrics.comment_count || 0,
            shares: metrics.share_count || 0,
            views: metrics.view_count || 0,
          };

        case 'youtube':
          return {
            platform,
            likes: metrics.likeCount || 0,
            comments: metrics.commentCount || 0,
            shares: metrics.shareCount || 0,
            views: metrics.viewCount || 0,
          };

        default:
          return null;
      }
    } catch (error) {
      logger.error(...formatLogArgs(`Error fetching metrics for ${platform}:`, error));
      return null;
    }
  }

  // Get account metrics
  async getAccountMetrics(platform: Platform, key: string): Promise<unknown> {
    const api = this.getClient(platform, key);
    switch (platform) {
      case 'instagram':
        return await (api as InstagramAPI).getAccountInsights?.();
      case 'twitter':
        return await (api as TwitterAPI).getUserMetrics?.('me'); // Or specific user ID
      case 'tiktok':
        return await (api as TikTokAPI).getUserInfo?.();
      case 'youtube':
        return await (api as YouTubeAPI).getChannelMetrics?.();
      case 'linkedin':
        return await (api as LinkedInAPI).getAccountMetrics();
      default:
        return null;
    }
  }

  // Check if platform is connected
  isConnected(platform: Platform, key?: string): boolean {
    if (!this.apis.has(platform)) {
      return false;
    }

    if (typeof key === 'undefined') {
      return (this.apis.get(platform)?.size ?? 0) > 0;
    }

    return this.apis.get(platform)?.has(key) ?? false;
  }

  // Disconnect a platform
  disconnect(platform: Platform, key: string): void {
    const platformClients = this.apis.get(platform);
    if (!platformClients) {
      return;
    }

    platformClients.delete(key);
    if (platformClients.size === 0) {
      this.apis.delete(platform);
    }
  }

  // Get all connected platforms
  getConnectedPlatforms(): Platform[] {
    return Array.from(this.apis.entries())
      .filter(([, clients]) => clients.size > 0)
      .map(([platform]) => platform);
  }

  private ensurePlatformMap(platform: Platform): Map<string, SocialMediaApiClient> {
    const existing = this.apis.get(platform);
    if (existing) {
      return existing;
    }

    const created = new Map<string, SocialMediaApiClient>();
    this.apis.set(platform, created);
    return created;
  }

  private createClient(platform: Platform, credentials: Record<string, string>): SocialMediaApiClient {
    switch (platform) {
      case 'instagram':
        return new InstagramAPI(
          credentials.accessToken,
          credentials.businessAccountId
        );
      case 'twitter':
        return new TwitterAPI({
          accessToken: credentials.accessToken,
          accessTokenSecret: credentials.accessTokenSecret,
          consumerKey: credentials.consumerKey,
          consumerSecret: credentials.consumerSecret,
        });
      case 'tiktok':
        return new TikTokAPI(credentials.accessToken);
      case 'youtube':
        return new YouTubeAPI(credentials.accessToken);
      case 'linkedin':
        return new LinkedInAPI(credentials.accessToken);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }
}

// Create a singleton instance
export const socialMediaManager = new SocialMediaManager();