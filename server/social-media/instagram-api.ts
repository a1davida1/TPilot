import { z } from "zod";
import { logger } from '../bootstrap/logger.js';

// Instagram Business API Integration
export class InstagramAPI {
  private accessToken: string;
  private businessAccountId: string;

  constructor(accessToken: string, businessAccountId: string) {
    this.accessToken = accessToken;
    this.businessAccountId = businessAccountId;
  }

  // Post content to Instagram
  async createPost(content: {
    imageUrl?: string;
    videoUrl?: string;
    caption: string;
    hashtags?: string[];
  }) {
    const caption = content.hashtags 
      ? `${content.caption}\n\n${content.hashtags.map(tag => `#${tag}`).join(' ')}`
      : content.caption;

    try {
      // Step 1: Create media container
      const mediaType = content.videoUrl ? 'VIDEO' : 'IMAGE';
      const mediaUrl = content.videoUrl || content.imageUrl;
      
      const containerResponse = await fetch(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/media`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: mediaType === 'IMAGE' ? mediaUrl : undefined,
            video_url: mediaType === 'VIDEO' ? mediaUrl : undefined,
            media_type: mediaType,
            caption: caption,
            access_token: this.accessToken,
          }),
        }
      );

      if (!containerResponse.ok) {
        throw new Error(`Failed to create media container: ${containerResponse.statusText}`);
      }

      const containerData = await containerResponse.json();
      const containerId = containerData.id;

      // Step 2: Publish the media
      const publishResponse = await fetch(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/media_publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creation_id: containerId,
            access_token: this.accessToken,
          }),
        }
      );

      if (!publishResponse.ok) {
        throw new Error(`Failed to publish media: ${publishResponse.statusText}`);
      }

      const publishData = await publishResponse.json();
      return {
        success: true,
        postId: publishData.id,
        platform: 'instagram' as const,
      };
    } catch (error) {
      logger.error('Instagram API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'instagram' as const,
      };
    }
  }

  // Get post engagement metrics
  async getPostMetrics(postId: string) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${postId}/insights?metric=engagement,impressions,reach,likes,comments,shares&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        metrics: data.data,
        platform: 'instagram' as const,
      };
    } catch (error) {
      logger.error('Instagram Metrics Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'instagram' as const,
      };
    }
  }

  // Get account insights
  async getAccountInsights() {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.businessAccountId}/insights?metric=follower_count,impressions,reach,profile_views&period=day&access_token=${this.accessToken}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        insights: data.data,
        platform: 'instagram' as const,
      };
    } catch (error) {
      logger.error('Instagram Insights Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        platform: 'instagram' as const,
      };
    }
  }
}

// Instagram API response schemas
export const InstagramPostSchema = z.object({
  success: z.boolean(),
  postId: z.string().optional(),
  error: z.string().optional(),
  platform: z.literal('instagram'),
});

export const InstagramMetricsSchema = z.object({
  success: z.boolean(),
  metrics: z.array(z.object({
    name: z.string(),
    values: z.array(z.object({
      value: z.number(),
      end_time: z.string(),
    })),
  })).optional(),
  error: z.string().optional(),
  platform: z.literal('instagram'),
});

export type InstagramPostResponse = z.infer<typeof InstagramPostSchema>;
export type InstagramMetricsResponse = z.infer<typeof InstagramMetricsSchema>;