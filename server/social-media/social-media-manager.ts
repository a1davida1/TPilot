import { InstagramAPI } from './instagram-api.js';
import { TwitterAPI } from './twitter-api.js';
import { TikTokAPI } from './tiktok-api.js';
import { YouTubeAPI } from './youtube-api.js';
import { LinkedInAPI } from './linkedin-api.js';

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
export class SocialMediaManager {
  private apis: Map<Platform,
    InstagramAPI | TwitterAPI | TikTokAPI | YouTubeAPI | LinkedInAPI
  > = new Map();

  constructor() {}

  // Connect a social media account
  connectAccount(platform: Platform, credentials: Record<string, string>) {
    switch (platform) {
      case 'instagram':
        this.apis.set(platform, new InstagramAPI(
          credentials.accessToken,
          credentials.businessAccountId
        ));
        break;
      case 'twitter':
        this.apis.set(platform, new TwitterAPI({
          accessToken: credentials.accessToken,
          accessTokenSecret: credentials.accessTokenSecret,
          consumerKey: credentials.consumerKey,
          consumerSecret: credentials.consumerSecret,
        }));
        break;
      case 'tiktok':
        this.apis.set(platform, new TikTokAPI(credentials.accessToken));
        break;
      case 'youtube':
        this.apis.set(platform, new YouTubeAPI(credentials.accessToken));
        break;
      case 'linkedin':
        this.apis.set(platform, new LinkedInAPI(credentials.accessToken));
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  // Post content to a specific platform
  async postToPlatform(platform: Platform, content: PostContent): Promise<PostResult> {
    const api = this.apis.get(platform);
    if (!api) {
      return {
        success: false,
        platform,
        error: `${platform} not connected`,
      };
    }

    try {
      switch (platform) {
        case 'instagram':
          return await (api as InstagramAPI).createPost({
            imageUrl: content.mediaUrls?.[0],
            videoUrl: content.mediaUrls?.find(url => url.includes('.mp4')),
            caption: content.text,
            hashtags: content.hashtags,
          });

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
          return await twitterApi.createTweet({
            text: content.hashtags
              ? `${content.text}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`
              : content.text,
            mediaIds: mediaIds.length > 0 ? mediaIds : undefined,
          });
        }

        case 'tiktok':
          if (!content.mediaUrls?.[0]?.includes('.mp4')) {
            return {
              success: false,
              platform,
              error: 'TikTok requires video content',
            };
          }
          return await (api as TikTokAPI).createPost({
            videoUrl: content.mediaUrls[0],
            caption: content.text,
            hashtags: content.hashtags,
          });

        case 'youtube':
          if (!content.mediaUrls?.[0]?.includes('.mp4')) {
            return {
              success: false,
              platform,
              error: 'YouTube requires video content',
            };
          }
          return await (api as YouTubeAPI).createPost({
            videoUrl: content.mediaUrls[0],
            title: content.title || content.text.substring(0, 100),
            description: content.description || content.text,
            tags: content.hashtags,
          });
        case 'linkedin':
          return await (api as LinkedInAPI).createPost({
            text: content.text,
            mediaUrls: content.mediaUrls,
            hashtags: content.hashtags,
          });
        default:
          return {
            success: false,
            platform,
            error: `Posting not implemented for ${platform}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        platform,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Post to multiple platforms simultaneously
  async postToMultiplePlatforms(
    platforms: Platform[],
    content: PostContent
  ): Promise<PostResult[]> {
    const promises = platforms.map(platform => 
      this.postToPlatform(platform, content)
    );
    
    return await Promise.allSettled(promises).then(results =>
      results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            success: false,
            platform: platforms[index],
            error: result.reason?.message || 'Failed to post',
          };
        }
      })
    );
  }

  // Get engagement metrics for a post
  async getPostMetrics(platform: Platform, postId: string): Promise<EngagementMetrics | null> {
    const api = this.apis.get(platform);
    if (!api) {
      console.error(`${platform} not connected`);
      return null;
    }

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
      console.error(`Error fetching metrics for ${platform}:`, error);
      return null;
    }
  }

  // Get account metrics
  async getAccountMetrics(platform: Platform): Promise<unknown> {
    const api = this.apis.get(platform);
    if (!api) {
      throw new Error(`${platform} not connected`);
    }

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
  isConnected(platform: Platform): boolean {
    return this.apis.has(platform);
  }

  // Disconnect a platform
  disconnect(platform: Platform): void {
    this.apis.delete(platform);
  }

  // Get all connected platforms
  getConnectedPlatforms(): Platform[] {
    return Array.from(this.apis.keys());
  }
}

// Create a singleton instance
export const socialMediaManager = new SocialMediaManager();